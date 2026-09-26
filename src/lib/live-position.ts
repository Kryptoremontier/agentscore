/**
 * The live-position rule and the counts derived from it — one module
 * (REPO_MAP §7 rule 4). Callers pass RAW position rows (0-share rows
 * included, exactly as the indexer returns them) and never filter on their own.
 *
 * Thesis §4 rule 5 / §8 mine 6: a position is a stake only while it holds
 * shares. The indexer keeps a wallet's row after a full redeem, with
 * shares "0" (477 such rows on testnet, 2026-09-26; 4 of them on agent atom
 * vaults), so having a row does not make a wallet a staker.
 */

/** THE rule: a position counts only while it holds shares (> 0) at read time. */
export function isLivePosition(p: { shares: bigint }): boolean {
  return p.shares > 0n
}

/** A position row as the indexer returns it (shares as a decimal string). */
export interface PositionLike {
  term_id: string
  account_id: string | null
  shares: string | bigint | null | undefined
}

function sharesOf(p: PositionLike): bigint {
  if (typeof p.shares === 'bigint') return p.shares
  try { return BigInt(p.shares || '0') } catch { return 0n }
}

/** Rows that hold shares right now — for lists that show positions (the modal's positions table). */
export function livePositions<P extends PositionLike>(positions: readonly P[]): P[] {
  return positions.filter((p) => !!p?.account_id && isLivePosition({ shares: sharesOf(p) }))
}

/**
 * Distinct wallets (lowercased) holding a live position on any of `vaultIds`.
 * An agent's stakers are this set over its atom vault + its trust
 * counter-vault: a wallet on both sides, or on two bonding curves, is one staker.
 */
export function liveStakerWallets(positions: readonly PositionLike[], vaultIds: readonly (string | null | undefined)[]): Set<string> {
  const vaults = new Set(vaultIds.filter((v): v is string => !!v).map((v) => v.toLowerCase()))
  const out = new Set<string>()
  for (const p of positions) {
    if (!p?.account_id || !p.term_id || !vaults.has(p.term_id.toLowerCase())) continue
    if (!isLivePosition({ shares: sharesOf(p) })) continue
    out.add(p.account_id.toLowerCase())
  }
  return out
}

/**
 * THE staker count for an agent on every surface (list card, list row, modal,
 * /agents/[id], REST `stakerCount`, MCP `stakers`/`stakerCount`): distinct
 * wallets with a live position on its atom vault or its trust counter-vault.
 */
export function countLiveStakers(
  positions: readonly PositionLike[],
  agent: { atomId: string; counterId?: string | null },
): number {
  return liveStakerWallets(positions, [agent.atomId, agent.counterId]).size
}
