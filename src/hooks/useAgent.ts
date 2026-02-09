'use client'

import { useQuery } from '@tanstack/react-query'
import { graphqlRequest } from '@/lib/graphql-client'
import { AGENT_QUERIES, type GraphQLAtom } from '@/lib/graphql'
import { transformAtomToAgent } from '@/lib/transform'
import type { Agent } from '@/types/agent'

interface UseAgentResult {
  agent: Agent | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useAgent(agentId: string | undefined): UseAgentResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      if (!agentId) return null

      const response = await graphqlRequest<{
        atom: GraphQLAtom
      }>(AGENT_QUERIES.GET_AGENT_BY_ID, {
        id: agentId,
      })

      return response.atom
    },
    enabled: !!agentId,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute
  })

  const agent = data ? transformAtomToAgent(data) : null

  return {
    agent,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}