/**
 * On-Chain Pricing Service
 *
 * Reads share prices, deposit/redeem previews directly from MultiVault contract.
 * Replaces local bonding-curve.ts approximations with real on-chain data.
 *
 * All monetary values are in wei (18 decimals) unless noted otherwise.
 */

import { type PublicClient } from 'viem'
import { MultiVaultAbi } from '@0xintuition/protocol'
import { getMultiVaultAddress } from './intuition'

const CURVE_ID = 1n

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown
  ts: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 15_000 // 15s — matches typical polling interval

function cached<T>(key: string): T | null {
  const e = cache.get(key)
  if (e && Date.now() - e.ts < CACHE_TTL) return e.value as T
  return null
}

function setCache(key: string, value: unknown) {
  cache.set(key, { value, ts: Date.now() })
}

// ── Core reads ───────────────────────────────────────────────────────────────

/**
 * Current marginal share price (wei per share).
 */
export async function getOnChainSharePrice(
  pub: PublicClient,
  termId: `0x${string}`,
): Promise<bigint> {
  const k = `price-${termId}`
  const c = cached<bigint>(k)
  if (c !== null) return c

  const price = await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'currentSharePrice',
    args: [termId, CURVE_ID],
  }) as bigint

  setCache(k, price)
  return price
}

/**
 * Current share price as a float (tTRUST per share).
 */
export async function getSharePriceFloat(
  pub: PublicClient,
  termId: `0x${string}`,
): Promise<number> {
  const wei = await getOnChainSharePrice(pub, termId)
  return Number(wei) / 1e18
}

/**
 * Preview a deposit: how many shares will the user receive after protocol fees?
 * Returns { shares, assetsAfterFees } in wei.
 */
export async function previewDeposit(
  pub: PublicClient,
  termId: `0x${string}`,
  assetsWei: bigint,
): Promise<{ shares: bigint; assetsAfterFees: bigint }> {
  const result = await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'previewDeposit',
    args: [termId, CURVE_ID, assetsWei],
  }) as readonly [bigint, bigint]

  return { shares: result[0], assetsAfterFees: result[1] }
}

/**
 * Preview a redeem: how much tTRUST will the user get back after protocol fees?
 * Returns { assetsAfterFees, sharesUsed } in wei.
 */
export async function previewRedeem(
  pub: PublicClient,
  termId: `0x${string}`,
  sharesWei: bigint,
): Promise<{ assetsAfterFees: bigint; sharesUsed: bigint }> {
  const result = await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'previewRedeem',
    args: [termId, CURVE_ID, sharesWei],
  }) as readonly [bigint, bigint]

  return { assetsAfterFees: result[0], sharesUsed: result[1] }
}

/**
 * How many shares correspond to `assetsWei` at current price? (no fee deduction)
 */
export async function convertToShares(
  pub: PublicClient,
  termId: `0x${string}`,
  assetsWei: bigint,
): Promise<bigint> {
  return await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'convertToShares',
    args: [termId, CURVE_ID, assetsWei],
  }) as bigint
}

/**
 * How much tTRUST are `sharesWei` worth at current price? (no fee deduction)
 */
export async function convertToAssets(
  pub: PublicClient,
  termId: `0x${string}`,
  sharesWei: bigint,
): Promise<bigint> {
  return await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'convertToAssets',
    args: [termId, CURVE_ID, sharesWei],
  }) as bigint
}

/**
 * Vault totals: { totalAssets, totalShares } in wei.
 */
export async function getVaultState(
  pub: PublicClient,
  termId: `0x${string}`,
): Promise<{ totalAssets: bigint; totalShares: bigint }> {
  const k = `vault-${termId}`
  const c = cached<{ totalAssets: bigint; totalShares: bigint }>(k)
  if (c !== null) return c

  const result = await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'getVault',
    args: [termId, CURVE_ID],
  }) as readonly [bigint, bigint]

  const state = { totalAssets: result[0], totalShares: result[1] }
  setCache(k, state)
  return state
}

/**
 * How many shares does a specific account hold in a vault?
 */
export async function getUserShares(
  pub: PublicClient,
  account: `0x${string}`,
  termId: `0x${string}`,
): Promise<bigint> {
  return await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'getShares',
    args: [account, termId, CURVE_ID],
  }) as bigint
}

/**
 * Max shares the user can redeem right now.
 */
export async function getMaxRedeem(
  pub: PublicClient,
  account: `0x${string}`,
  termId: `0x${string}`,
): Promise<bigint> {
  return await pub.readContract({
    address: getMultiVaultAddress(pub.chain?.id),
    abi: MultiVaultAbi,
    functionName: 'maxRedeem',
    args: [account, termId, CURVE_ID],
  }) as bigint
}

// ── Convenience helpers for UI ───────────────────────────────────────────────

/**
 * Float helpers for display — call these from React components.
 */
export function weiToFloat(wei: bigint): number {
  return Number(wei) / 1e18
}

export function floatToWei(f: number): bigint {
  return BigInt(Math.floor(f * 1e18))
}
