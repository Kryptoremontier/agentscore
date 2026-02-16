'use client'

import { useQuery } from '@tanstack/react-query'
import { graphqlRequest } from '@/lib/graphql-client'
import { AGENT_QUERIES, type GraphQLAtom } from '@/lib/graphql'
import type { TrustLevel } from '@/types/agent'

interface TrustScoreBreakdown {
  score: number
  level: TrustLevel
  positiveStake: bigint
  negativeStake: bigint
  netStake: bigint
  totalStakers: number
  positiveStakers: number
  negativeStakers: number
  percentile: number
  trend: 'up' | 'down' | 'stable'
  trendValue: number
}

interface UseTrustScoreResult {
  trustScore: TrustScoreBreakdown | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useTrustScore(agentId: string | undefined): UseTrustScoreResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trustScore', agentId],
    queryFn: async () => {
      if (!agentId) return null

      const response = await graphqlRequest<{
        atom: GraphQLAtom
      }>(AGENT_QUERIES.GET_TRUST_POSITIONS, {
        id: agentId,
      })

      return response.atom
    },
    enabled: !!agentId,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  })

  const trustScore = data ? calculateTrustScoreBreakdown(data) : null

  return {
    trustScore,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}

function calculateTrustScoreBreakdown(atom: GraphQLAtom): TrustScoreBreakdown {
  let positiveStake = BigInt(0)
  let negativeStake = BigInt(0)
  const positiveStakers = new Set<string>()
  const negativeStakers = new Set<string>()

  // Analyze attestations
  atom.subjectTriples?.forEach(triple => {
    const stake = BigInt(triple.vault.totalShares || '0')
    const predicateLabel = triple.predicate.label

    // Track stakers
    triple.vault.positions?.forEach(position => {
      if (isPositivePredicate(predicateLabel)) {
        positiveStakers.add(position.user.address)
      } else if (isNegativePredicate(predicateLabel)) {
        negativeStakers.add(position.user.address)
      }
    })

    // Calculate stakes
    if (isPositivePredicate(predicateLabel)) {
      positiveStake += stake
    } else if (isNegativePredicate(predicateLabel)) {
      negativeStake += stake
    }
  })

  // Calculate score
  const total = positiveStake + negativeStake
  const score = total > BigInt(0)
    ? Math.round(Number(positiveStake * BigInt(100) / total))
    : 50

  // Determine level
  const level = getTrustLevel(score)

  // Calculate net stake
  const netStake = positiveStake - negativeStake

  // Mock trend calculation (would compare with historical data)
  const trend = score > 70 ? 'up' : score < 30 ? 'down' : 'stable'
  const trendValue = trend === 'up' ? 5.2 : trend === 'down' ? -3.8 : 0

  // Mock percentile (would compare with other agents)
  const percentile = Math.max(1, 100 - Math.floor(score * 0.8))

  return {
    score,
    level,
    positiveStake,
    negativeStake,
    netStake,
    totalStakers: positiveStakers.size + negativeStakers.size,
    positiveStakers: positiveStakers.size,
    negativeStakers: negativeStakers.size,
    percentile,
    trend,
    trendValue,
  }
}

function getTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'moderate'
  if (score >= 30) return 'low'
  return 'critical'
}

function isPositivePredicate(label: string): boolean {
  return ['trusts', 'verified_by', 'vouches_for'].includes(label)
}

function isNegativePredicate(label: string): boolean {
  return ['distrusts', 'reported_for_scam', 'reported_for_spam', 'reported_for_injection'].includes(label)
}