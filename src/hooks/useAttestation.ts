'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { parseEther } from 'viem'
import { graphqlRequest } from '@/lib/graphql-client'
import { AGENT_QUERIES, type GraphQLTriple } from '@/lib/graphql'
import { transformTripleToAttestation } from '@/lib/transform'
import { useIntuition } from './useIntuition'
import { PREDICATE_ATOMS, OBJECT_ATOMS } from '@/lib/constants'
import { agentIdToAtomId } from '@/lib/utils'
import type { Attestation, AttestationPredicate, ReportType } from '@/types/attestation'

interface UseAttestationOptions {
  agentId?: string
  predicate?: AttestationPredicate
  page?: number
  pageSize?: number
}

interface UseAttestationResult {
  attestations: Attestation[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  // Mutations
  trustAgent: (agentId: string, amount: string) => Promise<void>
  distrustAgent: (agentId: string, amount: string) => Promise<void>
  reportAgent: (agentId: string, reportType: ReportType, amount: string) => Promise<void>
}

export function useAttestation(options: UseAttestationOptions = {}): UseAttestationResult {
  const {
    agentId,
    predicate,
    page = 1,
    pageSize = 50,
  } = options

  const skip = (page - 1) * pageSize
  const queryClient = useQueryClient()
  const { createTriple, isReady } = useIntuition()

  // Query attestations
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attestations', agentId, predicate, page, pageSize],
    queryFn: async () => {
      // Map predicate to predicate atom ID
      const predicateId = predicate ? (PREDICATE_ATOMS as any)[predicate] : undefined

      const response = await graphqlRequest<{
        triples: GraphQLTriple[]
      }>(AGENT_QUERIES.GET_ATTESTATIONS, {
        subjectId: agentId,
        predicateId: predicateId?.toString(),
        first: pageSize,
        skip,
      })

      return response.triples
    },
    enabled: !!agentId,
    staleTime: 30_000,
  })

  const attestations = data?.map(transformTripleToAttestation) || []

  // Trust agent mutation
  const { mutateAsync: trustAgent } = useMutation({
    mutationFn: async ({ agentId, amount }: { agentId: string; amount: string }) => {
      if (!isReady) throw new Error('Wallet not connected')

      const agentAtomId = agentIdToAtomId(agentId)
      const stakeAmount = parseEther(amount)

      await createTriple(
        agentAtomId,
        PREDICATE_ATOMS.trusts,
        OBJECT_ATOMS.trustworthy,
        stakeAmount
      )
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] })
      queryClient.invalidateQueries({ queryKey: ['attestations'] })
    },
  })

  // Distrust agent mutation
  const { mutateAsync: distrustAgent } = useMutation({
    mutationFn: async ({ agentId, amount }: { agentId: string; amount: string }) => {
      if (!isReady) throw new Error('Wallet not connected')

      const agentAtomId = agentIdToAtomId(agentId)
      const stakeAmount = parseEther(amount)

      await createTriple(
        agentAtomId,
        PREDICATE_ATOMS.distrusts,
        OBJECT_ATOMS.scammer,
        stakeAmount
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] })
      queryClient.invalidateQueries({ queryKey: ['attestations'] })
    },
  })

  // Report agent mutation
  const { mutateAsync: reportAgent } = useMutation({
    mutationFn: async ({
      agentId,
      reportType,
      amount,
    }: {
      agentId: string
      reportType: ReportType
      amount: string
    }) => {
      if (!isReady) throw new Error('Wallet not connected')

      const agentAtomId = agentIdToAtomId(agentId)
      const stakeAmount = parseEther(amount)

      // Map report type to predicate atom
      const predicateMap: Record<ReportType, keyof typeof PREDICATE_ATOMS> = {
        scam: 'reported_for_scam',
        spam: 'reported_for_spam',
        prompt_injection: 'reported_for_injection',
        impersonation: 'reported_for_injection', // Using injection as placeholder
        other: 'reported_for_spam', // Using spam as placeholder
      }

      const predicateKey = predicateMap[reportType]
      const predicateAtom = PREDICATE_ATOMS[predicateKey]

      await createTriple(
        agentAtomId,
        predicateAtom,
        OBJECT_ATOMS.scammer, // Generic negative object
        stakeAmount
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] })
      queryClient.invalidateQueries({ queryKey: ['attestations'] })
    },
  })

  return {
    attestations,
    totalCount: attestations.length, // Would come from GraphQL connection
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    // Wrapped mutations
    trustAgent: (agentId: string, amount: string) => trustAgent({ agentId, amount }),
    distrustAgent: (agentId: string, amount: string) => distrustAgent({ agentId, amount }),
    reportAgent: (agentId: string, reportType: ReportType, amount: string) =>
      reportAgent({ agentId, reportType, amount }),
  }
}