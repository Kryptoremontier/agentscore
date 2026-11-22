/**
 * "Your trust" (Etap 9c): the connected wallet's trust in one agent, and taking it back.
 *
 * Trust in an agent for a trust context = this wallet's shares on the triple
 * `<agent> — is skilled in — <context>` (the attestation; lib/attestation-reader.ts). The rows come
 * from the indexer (which triples, which curve) and their amounts from the chain (`getShares`), so
 * what the block shows is what the wallet holds when it was read. The preview of what comes back is
 * the contract's own `previewRedeem`. No amount is ever estimated: a read that fails is an error.
 *
 * Taking trust back = `redeem` on the triple's vault, sent DIRECTLY to MultiVault (CLAUDE.md: redeem
 * goes direct, no FeeProxy, no fee) through `redeemFromVault` in lib/intuition.ts.
 *
 * After the transaction, who trusts it and the tier are read again (the same reader and rule as
 * every agent surface: fetchAgentAttestations → summarizeAttesters → calculateAgentTier), with the
 * time of that read.
 */

import { getAddress, type PublicClient } from 'viem'
import { MultiVaultAbi } from '@0xintuition/protocol'
import { gqlRequest } from './gql-pager'
import { CANONICAL_DOMAINS_REGISTRY, IS_SKILLED_IN, type CanonicalDomainDef } from './canonical-domains'
import { getMultiVaultAddress, redeemFromVault, type WriteConfig } from './intuition'
import { fetchAgentAttestations, summarizeAttesters } from './agent-profile'
import { calculateAgentTier, type AgentTierResult } from './agent-tier'
import { isLivePosition } from './live-position'

export interface YourTrustRow {
  /** The attestation triple — its vault is what the wallet holds shares in. */
  tripleId: `0x${string}`
  curveId: bigint
  context: CanonicalDomainDef
  /** Shares this wallet holds, read from the chain (wei). */
  shares: bigint
}

export interface IndexedTriple { term_id: string; object_id: string }
export interface IndexedPosition { term_id: string; curve_id: string | number; shares: string }

const CONTEXT_BY_ID: ReadonlyMap<string, CanonicalDomainDef> = new Map(CANONICAL_DOMAINS_REGISTRY.map((d) => [d.termId, d]))
const CONTEXT_ORDER: ReadonlyMap<string, number> = new Map(CANONICAL_DOMAINS_REGISTRY.map((d, i) => [d.termId, i]))

function toBigInt(v: string | number | bigint): bigint | null {
  try { return BigInt(v) } catch { return null }
}

/**
 * The rows the indexer says this wallet has: one per (trust context, curve) with live shares, in the
 * registry's order. Pure. `shares` here is the indexer's; readYourTrust replaces it with the chain's.
 */
export function rowsFromIndex(triples: readonly IndexedTriple[], positions: readonly IndexedPosition[]): YourTrustRow[] {
  const contextOf = new Map<string, CanonicalDomainDef>()
  for (const t of triples ?? []) {
    const ctx = CONTEXT_BY_ID.get(t?.object_id)
    if (t?.term_id && ctx) contextOf.set(t.term_id.toLowerCase(), ctx)
  }
  const rows = new Map<string, YourTrustRow>()
  for (const p of positions ?? []) {
    const ctx = p?.term_id ? contextOf.get(p.term_id.toLowerCase()) : undefined
    const shares = toBigInt(p?.shares ?? '0')
    const curveId = toBigInt(p?.curve_id ?? 1)
    if (!ctx || shares === null || curveId === null || !isLivePosition({ shares })) continue
    const key = `${p.term_id.toLowerCase()}:${curveId}`
    const prev = rows.get(key)
    rows.set(key, { tripleId: p.term_id as `0x${string}`, curveId, context: ctx, shares: (prev?.shares ?? 0n) + shares })
  }
  return [...rows.values()].sort((a, b) => (CONTEXT_ORDER.get(a.context.termId) ?? 0) - (CONTEXT_ORDER.get(b.context.termId) ?? 0) || Number(a.curveId - b.curveId))
}

const TRIPLES_QUERY = `
  query YourTrustTriples($subject: String!, $pred: String!, $contexts: [String!]!) {
    triples(where: { subject_id: { _eq: $subject }, predicate_id: { _eq: $pred }, object_id: { _in: $contexts } }, limit: 100) {
      term_id
      object_id
    }
  }
`
const POSITIONS_QUERY = `
  query YourTrustPositions($vaults: [String!]!, $wallet: String!) {
    positions(where: { term_id: { _in: $vaults }, account_id: { _eq: $wallet } }, limit: 100) {
      term_id
      curve_id
      shares
    }
  }
`

/**
 * This wallet's trust in this agent, one row per trust context. Two indexer reads (the agent's
 * attestation triples, then this wallet's positions on them — never a deep join), then the chain's
 * `getShares` for every row; rows the chain says are empty are dropped (the indexer may lag a
 * withdrawal). Throws when any read fails: `[]` means "no trust", never "couldn't read".
 */
export async function readYourTrust(publicClient: PublicClient, agentId: string, wallet: string): Promise<YourTrustRow[]> {
  const account = getAddress(wallet) // Hasura stores addresses checksummed
  const { triples } = await gqlRequest<{ triples: IndexedTriple[] }>(TRIPLES_QUERY, {
    subject: agentId,
    pred: IS_SKILLED_IN.termId,
    contexts: CANONICAL_DOMAINS_REGISTRY.map((d) => d.termId),
  })
  if (triples.length === 0) return []
  const { positions } = await gqlRequest<{ positions: IndexedPosition[] }>(POSITIONS_QUERY, {
    vaults: triples.map((t) => t.term_id),
    wallet: account,
  })
  const indexed = rowsFromIndex(triples, positions)
  if (indexed.length === 0) return []
  const multiVault = getMultiVaultAddress(publicClient.chain?.id)
  const onChain = await Promise.all(indexed.map((r) => publicClient.readContract({
    address: multiVault,
    abi: MultiVaultAbi,
    functionName: 'getShares',
    args: [account, r.tripleId, r.curveId],
  }) as Promise<bigint>))
  return indexed.map((r, i) => ({ ...r, shares: onChain[i] })).filter((r) => r.shares > 0n)
}

/** What comes back if this row is withdrawn now: the contract's `previewRedeem` (after its fees), wei. Throws on a failed read. */
export async function previewWithdraw(publicClient: PublicClient, row: YourTrustRow): Promise<bigint> {
  const [assetsAfterFees] = await publicClient.readContract({
    address: getMultiVaultAddress(publicClient.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'previewRedeem',
    args: [row.tripleId, row.curveId, row.shares],
  }) as readonly [bigint, bigint]
  return assetsAfterFees
}

/**
 * Take this trust back: redeem every share of the row, straight on MultiVault (no FeeProxy, no fee),
 * to the signing wallet.
 */
export function withdrawTrust(cfg: WriteConfig, row: YourTrustRow) {
  const account = cfg.walletClient.account?.address
  if (!account) throw new Error('No account address available')
  return redeemFromVault(cfg, row.tripleId, row.shares, account, row.curveId)
}

export interface TrustNow {
  people: number
  tier: AgentTierResult
  /** When the read behind these numbers was made (ms since epoch). */
  readAt: number
  /** The indexer no longer shows this wallet's trust in the withdrawn context. */
  caughtUp: boolean
}

/** Who trusts it and the tier, read now — the reader and rule every agent surface uses. Throws on a failed read. */
export async function readTrustNow(agentId: string, wallet: string, contextTermId: string): Promise<TrustNow> {
  const entries = await fetchAgentAttestations(agentId)
  const readAt = Date.now()
  const attesters = summarizeAttesters(entries)
  const lower = wallet.toLowerCase()
  const entry = entries.find((e) => e.domain.termId === contextTermId)
  const stillThere = !!entry?.attesterStakes.some((s) => s.wallet.toLowerCase() === lower && isLivePosition({ shares: s.shares }))
  return { people: attesters.length, tier: calculateAgentTier(attesters), readAt, caughtUp: !stillThere }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * After a withdrawal: read until the indexer has caught up with it (or the tries run out), and
 * return the last good read. Throws only if every read failed.
 */
export async function waitForTrustNow(
  agentId: string,
  wallet: string,
  contextTermId: string,
  opts: { tries?: number; delayMs?: number; isCancelled?: () => boolean } = {},
): Promise<TrustNow> {
  const tries = opts.tries ?? 8
  const delayMs = opts.delayMs ?? 2_500
  let last: TrustNow | null = null
  let lastError: unknown = null
  for (let i = 0; i < tries; i++) {
    if (opts.isCancelled?.()) break
    try {
      last = await readTrustNow(agentId, wallet, contextTermId)
      if (last.caughtUp) return last
    } catch (err) {
      lastError = err
    }
    if (i < tries - 1) await sleep(delayMs)
  }
  if (last) return last
  throw lastError ?? new Error('trust not read')
}
