'use client'

import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useCallback } from 'react'
import {
  createAtomFromString,
  createTripleStatement,
  getAtomDetails,
  getTripleDetails,
  getMultiVaultAddressFromChainId,
} from '@0xintuition/sdk'
import type { WalletClient, PublicClient } from 'viem'

export function useIntuition() {
  const { address, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const multiVaultAddress = chain?.id
    ? getMultiVaultAddressFromChainId(chain.id)
    : undefined

  const createAtom = useCallback(
    async (atomData: string | object) => {
      if (!walletClient || !publicClient || !multiVaultAddress) {
        throw new Error('Wallet not connected or chain not supported')
      }

      const data = typeof atomData === 'string'
        ? atomData
        : JSON.stringify(atomData)

      const result = await createAtomFromString(
        {
          walletClient: walletClient as WalletClient,
          publicClient: publicClient as PublicClient,
          address: multiVaultAddress,
        },
        data
      )

      return result
    },
    [walletClient, publicClient, multiVaultAddress]
  )

  const createTriple = useCallback(
    async (subjectId: bigint, predicateId: bigint, objectId: bigint, stakeAmount: bigint) => {
      if (!walletClient || !publicClient || !multiVaultAddress) {
        throw new Error('Wallet not connected or chain not supported')
      }

      const result = await createTripleStatement(
        {
          walletClient: walletClient as WalletClient,
          publicClient: publicClient as PublicClient,
          address: multiVaultAddress,
        },
        {
          args: [subjectId, predicateId, objectId] as any,
          value: stakeAmount,
        }
      )

      return result
    },
    [walletClient, publicClient, multiVaultAddress]
  )

  const getAtom = useCallback(
    async (atomId: bigint) => {
      if (!publicClient || !multiVaultAddress) {
        throw new Error('Chain not supported')
      }

      const result = await getAtomDetails({
        publicClient: publicClient as PublicClient,
        address: multiVaultAddress,
        atomId
      } as any)

      return result
    },
    [publicClient, multiVaultAddress]
  )

  const getTriple = useCallback(
    async (tripleId: bigint) => {
      if (!publicClient || !multiVaultAddress) {
        throw new Error('Chain not supported')
      }

      const result = await getTripleDetails({
        publicClient: publicClient as PublicClient,
        address: multiVaultAddress,
        tripleId
      } as any)

      return result
    },
    [publicClient, multiVaultAddress]
  )

  return {
    // SDK functions
    createAtom,
    createTriple,
    getAtom,
    getTriple,

    // Connection state
    isConnected: !!address,
    address,
    chain,
    multiVaultAddress,

    // Ready state
    isReady: !!walletClient && !!publicClient && !!multiVaultAddress,
  }
}