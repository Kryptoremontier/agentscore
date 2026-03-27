'use client'

import { useState, useEffect } from 'react'
import { fetchStakerPositions } from '@/lib/evaluator-data'
import { calculateEvaluatorScore, type EvaluatorProfile } from '@/lib/evaluator-score'

/**
 * Fetch and compute evaluator profile for a single wallet.
 * Auto-fetches when walletAddress changes.
 * Returns null while loading or if wallet is not connected.
 */
export function useEvaluatorScore(walletAddress: string | undefined): {
  profile: EvaluatorProfile | null
  loading: boolean
  error: string | null
  refresh: () => void
} {
  const [profile, setProfile] = useState<EvaluatorProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    if (!walletAddress) {
      setProfile(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchStakerPositions(walletAddress)
      .then(positions => {
        if (cancelled) return
        setProfile(calculateEvaluatorScore(walletAddress, positions))
      })
      .catch(err => {
        if (cancelled) return
        console.warn('[useEvaluatorScore]', err)
        setError(err?.message || 'Failed to fetch evaluator data')
        // Still set a default profile so UI doesn't break
        setProfile(calculateEvaluatorScore(walletAddress, []))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [walletAddress, rev])

  return {
    profile,
    loading,
    error,
    refresh: () => setRev(r => r + 1),
  }
}

/**
 * Fetch evaluator weights for a list of staker addresses.
 * Used to show evaluator badges next to staker names, and to pass
 * evaluatorWeights into calculateDiversityWeightedRatio().
 *
 * Batched but limited to 20 addresses to avoid overloading the API.
 */
export function useAgentStakerWeights(stakerAddresses: string[]): {
  weights: Map<string, number>
  loading: boolean
} {
  const [weights, setWeights] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)

  // Stable key to avoid re-fetching on every render
  const key = stakerAddresses.slice(0, 20).join(',')

  useEffect(() => {
    if (!key) return

    let cancelled = false
    setLoading(true)

    const batch = stakerAddresses.slice(0, 20)

    Promise.all(
      batch.map(async addr => {
        const positions = await fetchStakerPositions(addr)
        const profile = calculateEvaluatorScore(addr, positions)
        return [addr.toLowerCase(), profile.evaluatorWeight] as [string, number]
      })
    )
      .then(entries => {
        if (cancelled) return
        setWeights(new Map(entries))
      })
      .catch(err => {
        console.warn('[useAgentStakerWeights]', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return { weights, loading }
}
