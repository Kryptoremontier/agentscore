'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import type { PublicClient } from 'viem'
import {
  getOnChainSharePrice,
  getSharePriceFloat,
  previewDeposit,
  previewRedeem,
  getVaultState,
  getUserShares,
  weiToFloat,
  floatToWei,
} from '@/lib/on-chain-pricing'

// ── Share Price Hook ────────────────────────────────────────────────────────

interface SharePriceResult {
  price: number        // float (tTRUST per share)
  priceWei: bigint     // wei
  loading: boolean
  error: string | null
}

/**
 * Fetches the current on-chain share price for a vault.
 * Refreshes when termId changes or on manual refresh.
 */
export function useSharePrice(termId?: string): SharePriceResult & { refresh: () => void } {
  const pub = usePublicClient()
  const [state, setState] = useState<SharePriceResult>({
    price: 0, priceWei: 0n, loading: false, error: null,
  })

  const fetch = useCallback(async () => {
    if (!termId || !pub) return
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const hex = termId.startsWith('0x') ? termId as `0x${string}` : `0x${termId}` as `0x${string}`
      const priceWei = await getOnChainSharePrice(pub, hex)
      setState({ price: Number(priceWei) / 1e18, priceWei, loading: false, error: null })
    } catch (e: any) {
      setState(s => ({ ...s, loading: false, error: e?.message || 'Failed to fetch price' }))
    }
  }, [termId, pub])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refresh: fetch }
}

// ── Buy Preview Hook ────────────────────────────────────────────────────────

interface BuyPreview {
  shares: bigint
  sharesFloat: number
  assetsAfterFees: bigint
  fee: number          // float
  avgPrice: number     // float
  loading: boolean
  error: string | null
}

/**
 * Previews a deposit: how many shares for a given tTRUST amount?
 * Debounced — only fetches when amount stabilizes for 300ms.
 */
export function useBuyPreview(termId?: string, amountFloat?: number): BuyPreview {
  const pub = usePublicClient()
  const [state, setState] = useState<BuyPreview>({
    shares: 0n, sharesFloat: 0, assetsAfterFees: 0n, fee: 0, avgPrice: 0,
    loading: false, error: null,
  })

  useEffect(() => {
    if (!termId || !pub || !amountFloat || amountFloat <= 0) {
      setState({ shares: 0n, sharesFloat: 0, assetsAfterFees: 0n, fee: 0, avgPrice: 0, loading: false, error: null })
      return
    }

    const timer = setTimeout(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      try {
        const hex = termId.startsWith('0x') ? termId as `0x${string}` : `0x${termId}` as `0x${string}`
        const assetsWei = floatToWei(amountFloat)
        const result = await previewDeposit(pub, hex, assetsWei)
        const sharesF = weiToFloat(result.shares)
        const assetsAfterF = weiToFloat(result.assetsAfterFees)
        const feeF = amountFloat - assetsAfterF
        const avgP = sharesF > 0 ? assetsAfterF / sharesF : 0
        setState({
          shares: result.shares,
          sharesFloat: sharesF,
          assetsAfterFees: result.assetsAfterFees,
          fee: feeF,
          avgPrice: avgP,
          loading: false,
          error: null,
        })
      } catch (e: any) {
        setState(s => ({ ...s, loading: false, error: e?.message || 'Preview failed' }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [termId, pub, amountFloat])

  return state
}

// ── Sell Preview Hook ───────────────────────────────────────────────────────

interface SellPreview {
  assetsAfterFees: bigint
  assetsFloat: number  // net proceeds
  grossFloat: number   // before fee
  fee: number          // float
  loading: boolean
  error: string | null
}

/**
 * Previews a redeem: how much tTRUST for selling N shares?
 */
export function useSellPreview(termId?: string, sharesFloat?: number): SellPreview {
  const pub = usePublicClient()
  const [state, setState] = useState<SellPreview>({
    assetsAfterFees: 0n, assetsFloat: 0, grossFloat: 0, fee: 0,
    loading: false, error: null,
  })

  useEffect(() => {
    if (!termId || !pub || !sharesFloat || sharesFloat <= 0) {
      setState({ assetsAfterFees: 0n, assetsFloat: 0, grossFloat: 0, fee: 0, loading: false, error: null })
      return
    }

    const timer = setTimeout(async () => {
      setState(s => ({ ...s, loading: true, error: null }))
      try {
        const hex = termId.startsWith('0x') ? termId as `0x${string}` : `0x${termId}` as `0x${string}`
        const sharesWei = floatToWei(sharesFloat)
        const result = await previewRedeem(pub, hex, sharesWei)
        const netF = weiToFloat(result.assetsAfterFees)
        // Gross ≈ net / (1 - protocolFee). On-chain fee is baked into result.
        // We don't know exact fee %, so estimate: gross = net * ~1.05 (5% Intuition fee)
        // Better: just show net proceeds — that's what user actually gets
        setState({
          assetsAfterFees: result.assetsAfterFees,
          assetsFloat: netF,
          grossFloat: netF, // on-chain already deducted fee
          fee: 0, // not separately available from previewRedeem
          loading: false,
          error: null,
        })
      } catch (e: any) {
        setState(s => ({ ...s, loading: false, error: e?.message || 'Preview failed' }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [termId, pub, sharesFloat])

  return state
}

// ── Position Value Helper ───────────────────────────────────────────────────

/**
 * Get the current tTRUST value of a share position using on-chain convertToAssets.
 * This is a one-shot async function (not a hook) for use in effects/callbacks.
 */
export async function getPositionValue(
  pub: PublicClient,
  termId: `0x${string}`,
  sharesWei: bigint,
): Promise<{ valueWei: bigint; valueFloat: number }> {
  const { convertToAssets } = await import('@/lib/on-chain-pricing')
  const valueWei = await convertToAssets(pub, termId, sharesWei)
  return { valueWei, valueFloat: weiToFloat(valueWei) }
}
