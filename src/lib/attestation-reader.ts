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
import { fetchAllRows, SERVER_ROW_CAP } from './gql-pager'
import { fetchVaultPositions } from './vault-positions'
import { isLivePosition } from './live-position'
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
  /** Live support position count (a wallet may hold several) — 0-share rows are not counted. */
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

/**
 * THE attester rule (thesis §4 rule 5, §8 mine 6): a position is an
 * attestation only while it holds shares. The indexer keeps a wallet's
 * position row after a full redeem, with shares "0" (477 such rows on testnet,
 * 2026-09-26), so having a position row does not make a wallet an attester.
 * A wallet counts only if it holds shares > 0 when we read. One that redeemed
 * and bought back holds shares again, so it counts.
 *
 * Every attester count and every tTRUST-attested sum goes through this
 * predicate, via aggregateAttestations (raw positions) and summarizeAttesters
 * (agent-profile.ts). Callers pass RAW positions and never filter on their own
 * (REPO_MAP §7 rule 4). It lives in live-position.ts with the vault staker
 * counts derived from the same rule, and is re-exported here.
 */
export { isLivePosition }

const DOMAIN_BY_TERM_ID: ReadonlyMap<string, CanonicalDomainDef> = new Map(
  CANONICAL_DOMAINS_REGISTRY.map((d) => [d.termId, d]),
)

/**
 * Aggregate raw attestations per (agent, domain). Pure: same input → same
 * output. Multiple triples for one pair merge; multiple positions from the
 * same wallet count as ONE attester (dedup by lowercased address). Rows whose
 * domainTermId is not in the canonical registry are skipped.
 *
 * Only live positions count (isLivePosition): a 0-share row adds no
 * attester, no stake and no position. A pair with ZERO live support
 * positions yields NO entry: per the thesis the attestation is triple +
 * staked positions. So a triple that was never staked (live on testnet:
 * 9ytshade.eth → Social, no deposit ever indexed) or whose every position
 * was sold out is not an attestation. Sorted by score desc, then agent name.
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
      if (!p?.wallet || !isLivePosition(p)) continue
      const lower = p.wallet.toLowerCase()
      if (!e.attesters.has(lower)) e.attesters.set(lower, p.wallet)
      e.stakeByWallet.set(lower, (e.stakeByWallet.get(lower) ?? 0n) + p.shares)
      e.totalStake += p.shares
      e.positionCount++
    }
    for (const p of r.opposePositions ?? []) {
      // A 0-share row adds 0n either way; the check keeps both sides on one rule.
      if (!p?.wallet || !isLivePosition(p)) continue
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

// Ceiling for the paged triple read below (our cap, reported by the pager — the endpoint's own
// 250-triple cap never truncates silently). Live 2026-09-26: 3 triples, 2 positions.
const ATTESTATION_TRIPLES_MAX = 5_000

/** Subject ids per request pair (triples, then their positions) in the bulk read. */
export const ATTESTATION_SUBJECT_CHUNK = 200

/**
 * The ONE raw attestation read: `is skilled in` × canonical-bucket triples
 * (optionally for a set of subjects), and every position on their vaults +
 * counter-vaults — both paged to their aggregate counts (lib/gql-pager.ts).
 * Rows are RAW (0-share positions included): aggregateAttestations applies
 * the live rule (REPO_MAP §7 rule 4). Throws on any failure or a read that
 * didn't reach the end.
 */
async function readRawAttestations(subjectIds?: readonly string[]): Promise<RawAttestation[]> {
  const bucketIds = CANONICAL_DOMAINS_REGISTRY.map((d) => d.termId)
  const subjectFilter = subjectIds ? ', subject_id: { _in: $subjects }' : ''
  const subjectVar = subjectIds ? ', $subjects: [String!]!' : ''
  const tripleWhere = `{ predicate_id: { _eq: $pred }, object_id: { _in: $buckets }${subjectFilter} }`
  const tripleVars = {
    pred: IS_SKILLED_IN.termId,
    buckets: bucketIds,
    ...(subjectIds ? { subjects: [...subjectIds] } : {}),
  }
  const triplePage = await fetchAllRows<TripleRow>({
    query: `
      query GetAttestationTriples($pred: String!, $buckets: [String!]!${subjectVar}, $limit: Int!, $offset: Int!) {
        triples(where: ${tripleWhere}, order_by: { term_id: asc }, limit: $limit, offset: $offset) {
          term_id
          counter_term_id
          subject { term_id label }
          object { term_id }
        }
      }
    `,
    field: 'triples',
    countQuery: `
      query GetAttestationTripleCount($pred: String!, $buckets: [String!]!${subjectVar}) {
        triples_aggregate(where: ${tripleWhere}) { aggregate { count } }
      }
    `,
    countField: 'triples_aggregate',
    variables: tripleVars,
    pageSize: SERVER_ROW_CAP.triples,
    maxRows: ATTESTATION_TRIPLES_MAX,
  })
  if (triplePage.truncated !== false) throw new Error('attestation triples not read to the end')
  const triples = triplePage.rows
  if (triples.length === 0) return []

  const vaultIds: string[] = []
  for (const t of triples) {
    vaultIds.push(t.term_id)
    if (t.counter_term_id) vaultIds.push(t.counter_term_id)
  }

  const positions: PositionRow[] = await fetchVaultPositions(vaultIds)

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

  return triples.map((t) => ({
    tripleId: t.term_id,
    agentId: t.subject?.term_id ?? '',
    agentName: t.subject?.label ?? 'Unknown',
    domainTermId: t.object?.term_id ?? '',
    supportPositions: byVault.get(t.term_id) ?? [],
    opposePositions: t.counter_term_id ? (byVault.get(t.counter_term_id) ?? []) : [],
  }))
}

/**
 * Fetch attestations from the app's GraphQL endpoint and aggregate them —
 * corpus-wide by default, or for one subject atom via `options.subjectId`.
 * Triples and positions are paged to their aggregate counts (lib/gql-pager.ts).
 * THROWS on any transport/GraphQL error or a read that didn't reach the end
 * (REPO_MAP §7 rule 5): `[]` means "no attestations", never "couldn't read
 * them". Callers render their own unavailable state (fetchAgentProfileVector
 * → null, /domains → Attested tier unavailable).
 */
export async function fetchAttestations(options: FetchAttestationsOptions = {}): Promise<AttestedEntry[]> {
  if (!APP_CONFIG.GRAPHQL_URL) return []
  return aggregateAttestations(await readRawAttestations(options.subjectId ? [options.subjectId] : undefined))
}

/**
 * Attestations for many subjects at once (the /agents list, REST/MCP corpus):
 * two paged reads — triples, then their positions — per ATTESTATION_SUBJECT_CHUNK
 * ids, never one request per row. Same raw read and the same aggregateAttestations
 * as fetchAttestations({ subjectId }), so the list and the modal count an agent's
 * attesters identically. Every requested id is in the map ([] = no attestations).
 * Throws if any chunk fails: a partial map is never returned as complete.
 */
export async function fetchAttestationsForSubjects(subjectIds: readonly string[]): Promise<Map<string, AttestedEntry[]>> {
  const ids = [...new Set(subjectIds.filter(Boolean))]
  const out = new Map<string, AttestedEntry[]>(ids.map((id) => [id, []]))
  if (ids.length === 0 || !APP_CONFIG.GRAPHQL_URL) return out
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += ATTESTATION_SUBJECT_CHUNK) chunks.push(ids.slice(i, i + ATTESTATION_SUBJECT_CHUNK))
  const raw = (await Promise.all(chunks.map((c) => readRawAttestations(c)))).flat()
  for (const entry of aggregateAttestations(raw)) {
    const list = out.get(entry.agentId)
    if (list) list.push(entry)
  }
  return out
}

/** Truncated wallet form for the "attested by" UI: 0x1392...0006. */
export function truncateWallet(address: string): string {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
