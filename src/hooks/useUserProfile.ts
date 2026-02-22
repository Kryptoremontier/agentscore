'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile, RegisteredAgent, AgentSupport, UserStats } from '@/types/user'
import { calculateExpertLevel, autoBuildBadges } from '@/lib/badges'
import { getAddress } from 'viem'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data as T
}

interface GqlAtom { term_id: string; label: string; emoji: string | null }

interface GqlPosition {
  term_id: string
  shares: string
  updated_at: string
  vault: {
    term_id: string
    total_shares: string
    term: {
      id: string
      type: string
      atom: GqlAtom | null
      triple: {
        term_id: string
        counter_term_id: string
        subject: GqlAtom
        predicate: { label: string }
        object: { label: string }
      } | null
    }
  }
}

interface GqlProfileData {
  myAgents: Array<{
    term_id: string
    label: string
    emoji: string | null
    created_at: string
    positions_aggregate: { aggregate: { count: number; sum: { shares: string } | null } }
  }>
  myPositions: GqlPosition[]
  mySignals: { aggregate: { count: number } }
  myReports: { aggregate: { count: number } }
}

async function fetchProfileData(address: `0x${string}`): Promise<UserProfile> {
  const checksummed = getAddress(address)

  const data = await gql<GqlProfileData>(`
    query ProfileData($address: String!) {
      myAgents: atoms(
        where: {
          label: { _ilike: "Agent:%" }
          creator_id: { _eq: $address }
        }
        order_by: { created_at: desc }
      ) {
        term_id
        label
        emoji
        created_at
        positions_aggregate {
          aggregate {
            count
            sum { shares }
          }
        }
      }

      myPositions: positions(
        where: {
          account_id: { _eq: $address }
          shares: { _gt: "0" }
        }
        order_by: { updated_at: desc }
      ) {
        term_id
        shares
        updated_at
        vault {
          term_id
          total_shares
          term {
            id
            type
            atom { term_id label emoji }
            triple {
              term_id
              counter_term_id
              subject { term_id label emoji }
              predicate { label }
              object { label }
            }
          }
        }
      }

      mySignals: signals_aggregate(
        where: { account_id: { _eq: $address } }
      ) {
        aggregate { count }
      }

      myReports: triples_aggregate(
        where: {
          creator_id: { _eq: $address }
          predicate: { label: { _ilike: "reported_for_%" } }
        }
      ) {
        aggregate { count }
      }
    }
  `, { address: checksummed })

  const registeredAgents: RegisteredAgent[] = (data.myAgents || []).map(a => ({
    termId: a.term_id,
    label: a.label,
    emoji: a.emoji || undefined,
    createdAt: a.created_at,
    trustScore: 50,
    stakers: a.positions_aggregate?.aggregate?.count || 0,
    totalStaked: a.positions_aggregate?.aggregate?.sum?.shares || '0',
  }))

  const agentPositions: AgentSupport[] = []
  const seenKeys = new Set<string>()
  let totalStaked = BigInt(0)

  for (const pos of (data.myPositions || [])) {
    const shares = BigInt(pos.shares || '0')
    if (shares <= 0n) continue
    totalStaked += shares

    const term = pos.vault?.term
    if (!term) continue

    if (term.atom && term.atom.label?.startsWith('Agent:')) {
      const key = `atom-${term.atom.term_id}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        agentPositions.push({
          agentTermId: term.atom.term_id,
          agentLabel: term.atom.label,
          agentEmoji: term.atom.emoji || undefined,
          shares: pos.shares,
          side: 'for',
          updatedAt: pos.updated_at,
        })
      }
    }

    if (term.triple && term.triple.subject?.label?.startsWith('Agent:')) {
      const t = term.triple
      const isForVault = t.term_id === pos.vault.term_id
      const side = isForVault ? 'for' : 'against'
      const key = `triple-${t.subject.term_id}-${side}`

      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        agentPositions.push({
          agentTermId: t.subject.term_id,
          agentLabel: t.subject.label,
          agentEmoji: t.subject.emoji || undefined,
          shares: pos.shares,
          side,
          updatedAt: pos.updated_at,
        })
      }
    }
  }

  const totalSignals = data.mySignals?.aggregate?.count || 0
  const totalAttestations = agentPositions.length
  const reportsSubmitted = data.myReports?.aggregate?.count || 0
  const totalPositions = (data.myPositions || []).filter(p => BigInt(p.shares || '0') > 0n).length
  const tTrustStakedNum = Number(totalStaked) / 1e18

  const earliestDate = [
    ...registeredAgents.map(a => a.createdAt),
    ...agentPositions.map(p => p.updatedAt),
  ]
    .filter(Boolean)
    .map(d => new Date(d).getTime())
    .sort((a, b) => a - b)[0]

  const daysActive = earliestDate
    ? Math.max(1, Math.floor((Date.now() - earliestDate) / 86_400_000))
    : 0

  const stats: UserStats = {
    totalAgentsRegistered: registeredAgents.length,
    totalTrustStaked: totalStaked,
    totalAttestations,
    trustReceived: BigInt(0),
    reputation: 50,
    totalSignals,
    agentsSupported: agentPositions.filter(p => p.side === 'for').length,
    totalPositions,
    reportsSubmitted,
    daysActive,
    tTrustStakedNum,
  }

  const badges = autoBuildBadges(stats)
  const expertLevel = calculateExpertLevel(badges)

  stats.reputation = Math.min(100, Math.round(
    50
    + (registeredAgents.length * 2)
    + (agentPositions.length * 1.5)
    + (totalSignals * 0.3)
    + (badges.length * 5)
    + Math.min(10, daysActive * 0.5)
  ))

  return {
    address,
    stats,
    badges,
    expertLevel,
    registeredAgents,
    supportedAgents: agentPositions,
    joinedAt: earliestDate ? new Date(earliestDate) : new Date(),
    lastActiveAt: new Date(),
  }
}

const emptyProfile = (address: `0x${string}`): UserProfile => ({
  address,
  stats: {
    totalAgentsRegistered: 0,
    totalTrustStaked: BigInt(0),
    totalAttestations: 0,
    trustReceived: BigInt(0),
    reputation: 50,
    totalSignals: 0,
    agentsSupported: 0,
    totalPositions: 0,
    reportsSubmitted: 0,
    daysActive: 0,
    tTrustStakedNum: 0,
  },
  badges: [],
  expertLevel: 'newcomer',
  registeredAgents: [],
  supportedAgents: [],
  joinedAt: new Date(),
  lastActiveAt: new Date(),
})

export function useUserProfile(address?: `0x${string}`) {
  const queryClient = useQueryClient()

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['userProfile', address],
    queryFn: () => fetchProfileData(address!),
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      return { ...(profile || emptyProfile(address!)), ...updates }
    },
    onSuccess: (newProfile) => {
      queryClient.setQueryData(['userProfile', address], newProfile)
    },
  })

  return {
    profile: profile || emptyProfile(address || '0x0000000000000000000000000000000000000000' as `0x${string}`),
    isLoading,
    error,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
