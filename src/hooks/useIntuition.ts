/**
 * React hooks for Intuition Protocol
 *
 * Real SDK integration using @0xintuition/sdk
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePublicClient, useWalletClient, useAccount } from 'wagmi'
import { parseEther } from 'viem'
import {
  createWriteConfig,
  createReadConfig,
  createSimpleAtom,
  createAgentAtom,
  createAccountAtom,
  depositToVault,
  redeemFromVault,
  getAtom,
  searchGraph,
  parseStakeAmount,
  DEFAULT_ATOM_DEPOSIT,
  DEFAULT_STAKE_AMOUNT,
  type AgentMetadata,
  type WriteConfig,
  type ReadConfig,
} from '@/lib/intuition'

// ============================================================================
// Configuration Hooks
// ============================================================================

/**
 * Get WriteConfig for mutations
 */
function useWriteConfig(): WriteConfig | null {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  if (!publicClient || !walletClient) return null

  return createWriteConfig(walletClient, publicClient)
}

/**
 * Get ReadConfig for queries
 */
function useReadConfig(): ReadConfig | null {
  const publicClient = usePublicClient()

  if (!publicClient) return null

  return createReadConfig(publicClient)
}

// ============================================================================
// Query Hooks - Reading Data
// ============================================================================

/**
 * Get single Atom details
 */
export function useAtom(atomId?: `0x${string}`) {
  const config = useReadConfig()

  return useQuery({
    queryKey: ['atom', atomId],
    queryFn: async () => {
      if (!atomId || !config) return null
      return await getAtom(config, atomId)
    },
    enabled: !!atomId && !!config,
  })
}

/**
 * Search Atoms globally
 */
export function useSearchAtoms(query: string, enabled = true) {
  const config = useReadConfig()

  return useQuery({
    queryKey: ['atoms', 'search', query],
    queryFn: async () => {
      if (!config) return null
      return await searchGraph(config, query, {
        atomsLimit: 50,
        triplesLimit: 0,
      })
    },
    enabled: enabled && !!query && !!config,
    staleTime: 30000, // Cache for 30s
  })
}

// ============================================================================
// Mutation Hooks - Writing Data
// ============================================================================

/**
 * Create simple text Atom
 */
export function useCreateSimpleAtom() {
  const config = useWriteConfig()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      text,
      deposit,
    }: {
      text: string
      deposit?: bigint
    }) => {
      if (!config) throw new Error('Wallet not connected')
      return await createSimpleAtom(config, text, deposit || DEFAULT_ATOM_DEPOSIT)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atoms'] })
    },
  })
}

/**
 * Create Atom from Ethereum account
 */
export function useCreateAccountAtom() {
  const config = useWriteConfig()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      address,
      deposit,
    }: {
      address: `0x${string}`
      deposit?: bigint
    }) => {
      if (!config) throw new Error('Wallet not connected')
      return await createAccountAtom(config, address, deposit || DEFAULT_ATOM_DEPOSIT)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atoms'] })
    },
  })
}

/**
 * Create Agent Atom with metadata
 */
export function useCreateAgent() {
  const config = useWriteConfig()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      metadata,
      deposit,
    }: {
      metadata: AgentMetadata
      deposit?: bigint
    }) => {
      if (!config) throw new Error('Wallet not connected')
      return await createAgentAtom(config, metadata, deposit || DEFAULT_ATOM_DEPOSIT)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atoms'] })
    },
  })
}

// ============================================================================
// Staking Hooks
// ============================================================================

/**
 * Deposit (stake) to vault
 */
export function useDeposit() {
  const config = useWriteConfig()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
    }: {
      vaultId: `0x${string}`
      amount: bigint
    }) => {
      if (!config) throw new Error('Wallet not connected')
      return await depositToVault(config, vaultId, amount)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['atom', variables.vaultId] })
      queryClient.invalidateQueries({ queryKey: ['atoms'] })
    },
  })
}

/**
 * Redeem (unstake) from vault
 */
export function useRedeem() {
  const config = useWriteConfig()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vaultId,
      shares,
    }: {
      vaultId: `0x${string}`
      shares: bigint
    }) => {
      if (!config) throw new Error('Wallet not connected')
      return await redeemFromVault(config, vaultId, shares)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['atom', variables.vaultId] })
      queryClient.invalidateQueries({ queryKey: ['atoms'] })
    },
  })
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * All-in-one Intuition hook
 */
export function useIntuition() {
  const { address, isConnected } = useAccount()
  const createSimple = useCreateSimpleAtom()
  const createAccount = useCreateAccountAtom()
  const createAgent = useCreateAgent()
  const deposit = useDeposit()
  const redeem = useRedeem()

  return {
    // Connection state
    isConnected,
    address,

    // Create Atoms
    createSimpleAtom: createSimple.mutate,
    createSimpleAtomAsync: createSimple.mutateAsync,
    isCreatingSimple: createSimple.isPending,

    createAccountAtom: createAccount.mutate,
    createAccountAtomAsync: createAccount.mutateAsync,
    isCreatingAccount: createAccount.isPending,

    createAgent: createAgent.mutate,
    createAgentAsync: createAgent.mutateAsync,
    isCreatingAgent: createAgent.isPending,
    createAgentError: createAgent.error,

    // Staking
    deposit: deposit.mutate,
    depositAsync: deposit.mutateAsync,
    isDepositing: deposit.isPending,
    depositError: deposit.error,

    redeem: redeem.mutate,
    redeemAsync: redeem.mutateAsync,
    isRedeeming: redeem.isPending,
    redeemError: redeem.error,

    // Combined state
    isLoading:
      createSimple.isPending ||
      createAccount.isPending ||
      createAgent.isPending ||
      deposit.isPending ||
      redeem.isPending,

    error:
      createSimple.error ||
      createAccount.error ||
      createAgent.error ||
      deposit.error ||
      redeem.error,
  }
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Quick stake hook with ETH amount parsing
 */
export function useStake() {
  const { deposit, isDepositing, depositError } = useIntuition()

  const stake = (vaultId: `0x${string}`, ethAmount: string) => {
    const amount = parseStakeAmount(ethAmount)
    if (amount === BigInt(0)) {
      throw new Error('Invalid amount')
    }
    deposit({ vaultId, amount })
  }

  return {
    stake,
    isStaking: isDepositing,
    stakeError: depositError,
  }
}

/**
 * Quick unstake hook
 */
export function useUnstake() {
  const { redeem, isRedeeming, redeemError } = useIntuition()

  const unstake = (vaultId: `0x${string}`, shares: bigint) => {
    redeem({ vaultId, shares })
  }

  return {
    unstake,
    isUnstaking: isRedeeming,
    unstakeError: redeemError,
  }
}
