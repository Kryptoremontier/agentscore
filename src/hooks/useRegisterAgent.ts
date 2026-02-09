'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useIntuition } from './useIntuition'
import type { AgentPlatform, VerificationLevel } from '@/types/agent'

interface RegisterAgentData {
  name: string
  description: string
  platform: AgentPlatform
  walletAddress?: string
  verificationLevel?: VerificationLevel
  tags?: string[]
  website?: string
  documentation?: string
}

interface UseRegisterAgentResult {
  registerAgent: (data: RegisterAgentData) => Promise<string>
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
}

export function useRegisterAgent(): UseRegisterAgentResult {
  const queryClient = useQueryClient()
  const { createAtom, isReady } = useIntuition()

  const {
    mutateAsync: registerAgent,
    isPending,
    isError,
    error,
    isSuccess,
  } = useMutation({
    mutationFn: async (data: RegisterAgentData) => {
      if (!isReady) {
        throw new Error('Wallet not connected or chain not supported')
      }

      // Prepare atom data
      const atomData = {
        '@type': 'AIAgent',
        '@context': 'https://agentscore.intuition.systems',
        name: data.name,
        description: data.description,
        platform: data.platform,
        walletAddress: data.walletAddress,
        verificationLevel: data.verificationLevel || 'none',
        tags: data.tags || [],
        website: data.website,
        documentation: data.documentation,
        createdAt: new Date().toISOString(),
      }

      // Create atom on-chain
      const result = await createAtom(atomData)

      if (!result.state?.vaultId) {
        throw new Error('Failed to create agent atom')
      }

      // Return the atom ID
      return result.state.vaultId.toString()
    },
    onSuccess: (atomId) => {
      // Invalidate agents list to include new agent
      queryClient.invalidateQueries({ queryKey: ['agents'] })

      // Prefetch the new agent data
      queryClient.prefetchQuery({
        queryKey: ['agent', atomId],
        queryFn: () => Promise.resolve(null), // Will be fetched when navigating
      })
    },
  })

  return {
    registerAgent: (data: RegisterAgentData) => registerAgent(data),
    isLoading: isPending,
    isError,
    error: error as Error | null,
    isSuccess,
  }
}