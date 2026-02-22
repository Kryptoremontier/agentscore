'use client'

import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { graphqlRequest } from '@/lib/graphql-client'
import { AGENT_QUERIES, type GraphQLAtom } from '@/lib/graphql'
import type { TrustLevel } from '@/types/agent'
import { calculateAgentTrustScore, summarizeTrustStakes } from '@/lib/trust-score-engine'
import type { TrustFlowSnapshot } from '@/lib/trust-score-engine'
import { findTrustTriple } from '@/lib/intuition'
import { blendFlowSnapshots, fetchRecentTrustFlow } from '@/lib/trust-flow'

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
  baseScore: number
  anchoredScore: number
  confidence: number
  momentum: number
  flow24hSignedTtrust: number
  flow7dSignedTtrust: number
}

interface TrustScoreQueryData {
  atom: GraphQLAtom | null
  flow24h: TrustFlowSnapshot
  flow7d: TrustFlowSnapshot
}

interface UseTrustScoreResult {
  trustScore: TrustScoreBreakdown | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useTrustScore(agentId: string | undefined): UseTrustScoreResult {
  const publicClient = usePublicClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trustScore', agentId, publicClient?.chain?.id],
    queryFn: async () => {
      if (!agentId) return { atom: null, flow24h: {}, flow7d: {} } as TrustScoreQueryData

      const response = await graphqlRequest<{
        atom: GraphQLAtom
      }>(AGENT_QUERIES.GET_TRUST_POSITIONS, {
        atomId: agentId,
      })

      const atom = response.atom
      if (!atom || !publicClient) {
        return { atom, flow24h: {}, flow7d: {} } as TrustScoreQueryData
      }

      const supportTermId = getTermIdCandidate(atom.id, agentId)
      if (!supportTermId) {
        return { atom, flow24h: {}, flow7d: {} } as TrustScoreQueryData
      }

      let opposeTermId: `0x${string}` | null = null
      const triple = await findTrustTriple(supportTermId)
      if (triple?.counterTermId) opposeTermId = triple.counterTermId

      const [flow24h, flow7d] = await Promise.all([
        fetchRecentTrustFlow(publicClient, supportTermId, opposeTermId, 24),
        fetchRecentTrustFlow(publicClient, supportTermId, opposeTermId, 24 * 7),
      ])

      return { atom, flow24h, flow7d } as TrustScoreQueryData
    },
    enabled: !!agentId,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  })

  const trustScore = data?.atom ? calculateTrustScoreBreakdown(data.atom, data.flow24h, data.flow7d) : null

  return {
    trustScore,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}

function calculateTrustScoreBreakdown(
  atom: GraphQLAtom,
  flow24h: TrustFlowSnapshot = {},
  flow7d: TrustFlowSnapshot = {}
): TrustScoreBreakdown {
  const blendedFlow = blendFlowSnapshots(flow24h, flow7d)
  const trust = calculateAgentTrustScore(atom, blendedFlow)
  const summary = summarizeTrustStakes(atom)

  const positiveStake = trust.supportStake
  const negativeStake = trust.opposeStake
  const netStake = trust.netStake

  const trend: 'up' | 'down' | 'stable' = trust.momentum > 0.15
    ? 'up'
    : trust.momentum < -0.15
      ? 'down'
      : 'stable'
  const trendValue = Number(trust.momentum.toFixed(2))

  // Mock percentile (would compare with other agents)
  const percentile = Math.max(1, 100 - Math.floor(trust.score * 0.8))

  return {
    score: trust.score,
    level: trust.level,
    positiveStake,
    negativeStake,
    netStake,
    totalStakers: summary.supportStakers.size + summary.opposeStakers.size,
    positiveStakers: summary.supportStakers.size,
    negativeStakers: summary.opposeStakers.size,
    percentile,
    trend,
    trendValue,
    baseScore: trust.baseScore,
    anchoredScore: trust.anchoredScore,
    confidence: trust.confidence,
    momentum: trust.momentum,
    flow24hSignedTtrust: toSignedFlowTtrust(flow24h),
    flow7dSignedTtrust: toSignedFlowTtrust(flow7d),
  }
}

function toSignedFlowTtrust(flow: TrustFlowSnapshot): number {
  const signed =
    (flow.buySupportWei ?? BigInt(0)) -
    (flow.sellSupportWei ?? BigInt(0)) -
    (flow.buyOpposeWei ?? BigInt(0)) +
    (flow.sellOpposeWei ?? BigInt(0))
  return Number(signed) / 1e18
}

function getTermIdCandidate(...values: Array<string | undefined>): `0x${string}` | null {
  for (const value of values) {
    if (!value) continue
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
      return value as `0x${string}`
    }
  }
  return null
}