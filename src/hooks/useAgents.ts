'use client'

import { useQuery } from '@tanstack/react-query'
import { graphqlRequest } from '@/lib/graphql-client'
import { AGENT_QUERIES, type GraphQLAtom } from '@/lib/graphql'
import { transformAtomToAgent } from '@/lib/transform'
import type { Agent, AgentPlatform, TrustLevel } from '@/types/agent'

interface UseAgentsOptions {
  page?: number
  pageSize?: number
  orderBy?: 'trust_score' | 'created_at' | 'attestations' | 'stake'
  orderDirection?: 'asc' | 'desc'
  platforms?: AgentPlatform[]
  trustLevels?: TrustLevel[]
  verified?: boolean | null
  search?: string
}

interface UseAgentsResult {
  agents: Agent[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useAgents(options: UseAgentsOptions = {}): UseAgentsResult {
  const {
    page = 1,
    pageSize = 12,
    orderBy = 'trust_score',
    orderDirection = 'desc',
    platforms = [],
    trustLevels = [],
    verified = null,
    search = '',
  } = options

  const skip = (page - 1) * pageSize

  // Build GraphQL where clause
  const where: any = {}

  if (platforms.length > 0) {
    where.atomData_contains = platforms.map(p => `"platform":"${p}"`).join('|')
  }

  if (search) {
    where.OR = [
      { label_contains_nocase: search },
      { atomData_contains_nocase: search },
    ]
  }

  // Map orderBy to GraphQL field
  const orderByField = {
    trust_score: 'vault__totalShares',
    created_at: 'createdAt',
    attestations: 'triples',
    stake: 'vault__totalShares',
  }[orderBy]

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agents', page, pageSize, orderBy, orderDirection, platforms, trustLevels, verified, search],
    queryFn: async () => {
      const response = await graphqlRequest<{
        atoms: GraphQLAtom[]
        atomsConnection: { totalCount: number }
      }>(AGENT_QUERIES.GET_AGENTS, {
        first: pageSize,
        skip,
        orderBy: orderByField,
        orderDirection,
        where: Object.keys(where).length > 0 ? where : undefined,
      })

      return response
    },
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  })

  // Transform GraphQL atoms to agents
  const agents = data?.atoms.map(transformAtomToAgent) || []

  // Filter by trust levels on client side (since we calculate trust score)
  const filteredAgents = agents.filter(agent => {
    if (trustLevels.length > 0) {
      const level = getTrustLevelFromScore(agent.trustScore)
      if (!trustLevels.includes(level)) return false
    }

    if (verified !== null) {
      const isVerified = agent.verificationLevel !== 'none'
      if (verified !== isVerified) return false
    }

    return true
  })

  return {
    agents: filteredAgents,
    totalCount: data?.atomsConnection.totalCount || 0,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}

function getTrustLevelFromScore(score: number): TrustLevel {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'moderate'
  if (score >= 30) return 'low'
  return 'critical'
}