/**
 * Attestation Reader — the read side of the Trust Stack's core data unit:
 *
 *   [agent] — is skilled in — [canonical domain] + staked positions
 *
 * ETAP 2a. Fetches attestation triples (predicate `is skilled in` by term_id,
 * object IN the canonical bucket registry — single source: canonical-domains.ts)
 * together with per-wallet positions on each triple vault and counter-vault,
 * then aggregates per (agent, domain).
 *
 * Aggregation is a PURE function (aggregateAttestations) — unit-testable,
 * no I/O. fetchAttestations() is the thin I/O wrapper around it.
 *
 * Scoring (v1, thesis §6): simple and honest — f(distinctAttesters, totalStake).
 * Shape adapted from lib/domain-score.ts (PoC): independence dominates money.
 * This module does NOT touch the live scoring engines.
 */

import { APP_CONFIG } from './app-config'
import {
  CANONICAL_DOMAINS_REGISTRY,
  IS_SKILLED_IN,
  type CanonicalDomainDef,
} from './canonical-domains'

// ─── Types ───────────────────────────────────────────────────────────────────

/** One staked position on an attestation vault. */
export interface AttesterPosition {
  /** Staker wallet address (as returned by the indexer — checksummed). */
  wallet: string
  shares: bigint
}

/** One attestation triple with its vault positions, pre-aggregation. */
export interface RawAttestation {
  tripleId: string
  agentId: string
  agentName: string
  /** Canonical bucket atom term_id (the attestation object). */
  domainTermId: string
  supportPositions: AttesterPosition[]
  opposePositions: AttesterPosition[]
}

/** Aggregated attested entry: one (agent, domain) pair. */
export interface AttestedEntry {
  agentId: string
  agentName: string
  domain: CanonicalDomainDef
  /** Distinct wallets with a support position — dedup by wallet (sybil-safe). */
  distinctAttesters: number
  /** Distinct attester wallets (support side), first-seen casing preserved. */
  attesters: string[]
  /**
   * Per-attester support stake (ETAP 3 profile): one row per distinct wallet,
   * shares summed across that wallet's positions. Same order as `attesters`.
   * Answers "according to WHOM, with how much" on the agent profile.
   */
  attesterStakes: Array<{ wallet: string; shares: bigint }>
  /** Total support shares across all positions. */
  totalStake: bigint
  /** Total counter-vault shares. */
  opposeStake: bigint
  /** Raw support position count (a wallet may hold several). */
  positionCount: number
  /** Attested score v1 — see scoreAttestation. */
  score: number
}

// ─── Scoring v1 ──────────────────────────────────────────────────────────────

/**
 * v1 weights — same principle as domain-score.ts (PoC): each INDEPENDENT
 * attester is worth far more than any amount of extra money.
 *   score = distinctAttesters × DISTINCT_ATTESTER_WEIGHT + stakePoints
 *   stakePoints = min(STAKE_POINTS_CAP, log10(1 + totalStake / STAKE_SCALE))
 * STAKE_POINTS_CAP < DISTINCT_ATTESTER_WEIGHT guarantees N+1 attesters always
 * outrank N attesters regardless of stake size. STAKE_SCALE anchors the log
 * curve at the typical smallest testnet attest stake (0.0001 tTRUST).
 * Placeholder shape, NOT the final formula.
 */
export const DISTINCT_ATTESTER_WEIGHT = 10
export const STAKE_POINTS_CAP = 9
export const STAKE_SCALE_WEI = 100_000_000_000_000n // 0.0001 tTRUST

export function scoreAttestation(distinctAttesters: number, totalStake: bigint): number {
  const stakeUnits = Number(totalStake) / Number(STAKE_SCALE_WEI)
  const stakePoints = Math.min(STAKE_POINTS_CAP, Math.log10(1 + stakeUnits))
  return Math.round((distinctAttesters * DISTINCT_ATTESTER_WEIGHT + stakePoints) * 10) / 10
}

// ─── Pure aggregation ────────────────────────────────────────────────────────

const DOMAIN_BY_TERM_ID: ReadonlyMap<string, CanonicalDomainDef> = new Map(
  CANONICAL_DOMAINS_REGISTRY.map((d) => [d.termId, d]),
)

/**
 * Aggregate raw attestations per (agent, domain). Pure: same input → same
 * output. Multiple triples for one pair merge; multiple positions from the
 * same wallet count as ONE attester (dedup by lowercased address). Rows whose
 * domainTermId is not in the canonical registry are skipped.
 *
 * A pair with ZERO support positions yields NO entry: per the thesis the
 * attestation is triple + staked positions — a triple whose stake was fully
 * redeemed (live on testnet: 9ytshade.eth → Social) is not an attestation.
 * Sorted by score desc, then agent name.
 */
export function aggregateAttestations(raw: readonly RawAttestation[]): AttestedEntry[] {
  const acc = new Map<string, {
    agentId: string
    agentName: string
    domain: CanonicalDomainDef
    attesters: Map<string, string> // lowercased → first-seen casing
    stakeByWallet: Map<string, bigint> // lowercased → summed support shares
    totalStake: bigint
    opposeStake: bigint
    positionCount: number
  }>()

  for (const r of raw ?? []) {
    if (!r?.agentId || !r.domainTermId) continue
    const domain = DOMAIN_BY_TERM_ID.get(r.domainTermId)
    if (!domain) continue

    const key = `${r.agentId}:${r.domainTermId}`
    let e = acc.get(key)
    if (!e) {
      e = {
        agentId: r.agentId,
        agentName: r.agentName || 'Unknown',
        domain,
        attesters: new Map(),
        stakeByWallet: new Map(),
        totalStake: 0n,
        opposeStake: 0n,
        positionCount: 0,
      }
      acc.set(key, e)
    }

    for (const p of r.supportPositions ?? []) {
      if (!p?.wallet) continue
      const lower = p.wallet.toLowerCase()
      if (!e.attesters.has(lower)) e.attesters.set(lower, p.wallet)
      e.stakeByWallet.set(lower, (e.stakeByWallet.get(lower) ?? 0n) + p.shares)
      e.totalStake += p.shares
      e.positionCount++
    }
    for (const p of r.opposePositions ?? []) {
      if (!p?.wallet) continue
      e.opposeStake += p.shares
    }
  }

  const entries: AttestedEntry[] = []
  for (const e of acc.values()) {
    const distinctAttesters = e.attesters.size
    if (distinctAttesters === 0) continue
    entries.push({
      agentId: e.agentId,
      agentName: e.agentName,
      domain: e.domain,
      distinctAttesters,
      attesters: [...e.attesters.values()],
      attesterStakes: [...e.attesters.entries()].map(([lower, wallet]) => ({
        wallet,
        shares: e.stakeByWallet.get(lower) ?? 0n,
      })),
      totalStake: e.totalStake,
      opposeStake: e.opposeStake,
      positionCount: e.positionCount,
      score: scoreAttestation(distinctAttesters, e.totalStake),
    })
  }

  entries.sort((a, b) => b.score - a.score || a.agentName.localeCompare(b.agentName))
  return entries
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

interface TripleRow {
  term_id: string
  counter_term_id: string | null
  subject: { term_id: string | null; label: string | null } | null
  object: { term_id: string | null } | null
}

interface PositionRow {
  term_id: string
  shares: string
  account_id: string | null
}

export interface FetchAttestationsOptions {
  /**
   * Restrict to attestations whose SUBJECT is this atom (ETAP 3 agent
   * profile). Omit for the corpus-wide read used by /domains.
   */
  subjectId?: string
}

/**
 * Fetch attestations from the app's GraphQL endpoint and aggregate them —
 * corpus-wide by default, or for one subject atom via `options.subjectId`.
 * Graceful degradation: returns [] on any transport/GraphQL error (the
 * Attested tier renders its empty states; it must never crash the page).
 */
export async function fetchAttestations(options: FetchAttestationsOptions = {}): Promise<AttestedEntry[]> {
  const url = APP_CONFIG.GRAPHQL_URL
  if (!url) return []
  try {
    const bucketIds = CANONICAL_DOMAINS_REGISTRY.map((d) => d.termId)
    const subjectFilter = options.subjectId ? ', subject_id: { _eq: $subject }' : ''
    const subjectVar = options.subjectId ? ', $subject: String!' : ''
    const tripleRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetAttestationTriples($pred: String!, $buckets: [String!]!${subjectVar}) {
            triples(
              where: { predicate_id: { _eq: $pred }, object_id: { _in: $buckets }${subjectFilter} }
              limit: 500
            ) {
              term_id
              counter_term_id
              subject { term_id label }
              object { term_id }
            }
          }
        `,
        variables: {
          pred: IS_SKILLED_IN.termId,
          buckets: bucketIds,
          ...(options.subjectId ? { subject: options.subjectId } : {}),
        },
      }),
    })
    const tripleData = await tripleRes.json()
    if (tripleData.errors) {
      console.warn('[fetchAttestations] GraphQL error:', tripleData.errors[0]?.message)
      return []
    }
    const triples: TripleRow[] = tripleData?.data?.triples ?? []
    if (triples.length === 0) return []

    const vaultIds: string[] = []
    for (const t of triples) {
      vaultIds.push(t.term_id)
      if (t.counter_term_id) vaultIds.push(t.counter_term_id)
    }

    const posRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetAttestationPositions($vaultIds: [String!]!) {
            positions(where: { term_id: { _in: $vaultIds } }) {
              term_id
              shares
              account_id
            }
          }
        `,
        variables: { vaultIds },
      }),
    })
    const posData = await posRes.json()
    if (posData.errors) {
      console.warn('[fetchAttestations] GraphQL error (positions):', posData.errors[0]?.message)
      return []
    }
    const positions: PositionRow[] = posData?.data?.positions ?? []

    const byVault = new Map<string, AttesterPosition[]>()
    for (const p of positions) {
      if (!p?.account_id || !p.shares) continue
      let shares: bigint
      try {
        shares = BigInt(p.shares)
      } catch {
        continue
      }
      const arr = byVault.get(p.term_id) ?? []
      arr.push({ wallet: p.account_id, shares })
      byVault.set(p.term_id, arr)
    }

    const raw: RawAttestation[] = triples.map((t) => ({
      tripleId: t.term_id,
      agentId: t.subject?.term_id ?? '',
      agentName: t.subject?.label ?? 'Unknown',
      domainTermId: t.object?.term_id ?? '',
      supportPositions: byVault.get(t.term_id) ?? [],
      opposePositions: t.counter_term_id ? (byVault.get(t.counter_term_id) ?? []) : [],
    }))

    return aggregateAttestations(raw)
  } catch (err) {
    console.warn('[fetchAttestations] Network error:', err)
    return []
  }
}

/** Truncated wallet form for the "attested by" UI: 0x1392...0006. */
export function truncateWallet(address: string): string {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
