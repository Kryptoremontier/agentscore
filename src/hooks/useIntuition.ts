/**
 * Simplified React hooks for Intuition Protocol
 *
 * Uses simplified API - full GraphQL integration TBD
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePublicClient, useWalletClient } from 'wagmi'
import { parseEther } from 'viem'
import {
  createSimpleAgent,
  createAgentWithMetadata,
  stakeOnAtom,
  unstakeFromAtom,
  type SimpleAgentMetadata,
} from '@/lib/intuition-simple'

// ============================================================================
// Agent Creation
// ============================================================================

/**
 * Create a simple agent from name
 */
export function useCreateSimpleAgent() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      if (!publicClient || !walletClient) {
        throw new Error('Wallet not connected')
      }
      return await createSimpleAgent(publicClient, walletClient, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

/**
 * Create agent with full metadata
 */
export function useCreateAgentWithMetadata() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (metadata: SimpleAgentMetadata) => {
      if (!publicClient || !walletClient) {
        throw new Error('Wallet not connected')
      }
      return await createAgentWithMetadata(publicClient, walletClient, metadata)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

// ============================================================================
// Staking
// ============================================================================

/**
 * Stake on an agent (deposit to vault)
 */
export function useStake() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
    }: {
      vaultId: bigint
      amount: bigint
    }) => {
      if (!publicClient || !walletClient) {
        throw new Error('Wallet not connected')
      }
      return await stakeOnAtom(publicClient, walletClient, vaultId, amount)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['vault', variables.vaultId.toString()],
      })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

/**
 * Unstake from an agent (redeem from vault)
 */
export function useUnstake() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vaultId,
      shares,
    }: {
      vaultId: bigint
      shares: bigint
    }) => {
      if (!publicClient || !walletClient) {
        throw new Error('Wallet not connected')
      }
      return await unstakeFromAtom(publicClient, walletClient, vaultId, shares)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['vault', variables.vaultId.toString()],
      })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * All-in-one intuition hook
 */
export function useIntuition() {
  const createSimple = useCreateSimpleAgent()
  const createWithMetadata = useCreateAgentWithMetadata()
  const stake = useStake()
  const unstake = useUnstake()

  return {
    // Create
    createAgent: createSimple.mutate,
    createAgentAsync: createSimple.mutateAsync,
    createAgentWithMetadata: createWithMetadata.mutate,
    createAgentWithMetadataAsync: createWithMetadata.mutateAsync,
    isCreating: createSimple.isPending || createWithMetadata.isPending,
    createError: createSimple.error || createWithMetadata.error,

    // Stake
    stake: stake.mutate,
    stakeAsync: stake.mutateAsync,
    isStaking: stake.isPending,
    stakeError: stake.error,

    // Unstake
    unstake: unstake.mutate,
    unstakeAsync: unstake.mutateAsync,
    isUnstaking: unstake.isPending,
    unstakeError: unstake.error,

    // Combined state
    isLoading: createSimple.isPending || createWithMetadata.isPending || stake.isPending || unstake.isPending,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse ETH amount to wei
 */
export function parseStakeAmount(ethAmount: string): bigint {
  try {
    return parseEther(ethAmount)
  } catch {
    return BigInt(0)
  }
}
