'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile, RegisteredAgent, AgentSupport, UserStats } from '@/types/user'
import { calculateExpertLevel, autoBuildBadges } from '@/lib/badges'
import { getAddress } from 'viem'
import { APP_CONFIG } from '@/lib/app-config'
import { AGENT_WHERE_OBJ, SKILL_WHERE_OBJ } from '@/lib/gql-filters'
import { getUserRegistrationsByType } from '@/lib/registrant-store'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

const PROFILE_STORAGE_KEY = 'agent_score_profiles'

interface ProfileMeta {
  name?: string
  bio?: string
  avatar?: string
  website?: string
  twitter?: string
  farcaster?: string
}

function loadProfileMeta(address: string): ProfileMeta {
  if (typeof window === 'undefined') return {}
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}')
    return all[address.toLowerCase()] || {}
  } catch { return {} }
}

function saveProfileMeta(address: string, meta: ProfileMeta) {
  if (typeof window === 'undefined') return
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}')
    all[address.toLowerCase()] = meta
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

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

interface GqlAtomData {
  term_id: string
  label: string
  emoji: string | null
  created_at: string
  positions_aggregate: { aggregate: { count: number; sum: { shares: string } | null } }
}

interface GqlAtomDataWithFirstPos extends GqlAtomData {
  firstPosition: { account_id: string }[]
}

interface GqlProfileData {
  myAgents: GqlAtomData[]
  ownedAgentAtoms: GqlAtomDataWithFirstPos[]
  mySkillAtoms: GqlAtomData[]
  ownedSkillAtoms: GqlAtomDataWithFirstPos[]
  mySkills: { aggregate: { count: number } }
  myClaims: { aggregate: { count: number } }
  myPositions: GqlPosition[]
  mySignals: { aggregate: { count: number } }
  myReports: { aggregate: { count: number } }
}

async function fetchProfileData(address: `0x${string}`): Promise<UserProfile> {
  const checksummed = getAddress(address)
  const addrLc = address.toLowerCase()

  // localStorage count for claims (triples are harder to detect via positions)
  const localClaimsCount = getUserRegistrationsByType(address, 'claim').length

  const data = await gql<GqlProfileData>(`
    query ProfileData($address: String!) {
      myAgents: atoms(
        where: {
          label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" }
          creator_id: { _eq: $address }
        }
        order_by: { created_at: desc }
      ) {
        term_id label emoji created_at
        positions_aggregate { aggregate { count sum { shares } } }
      }

      ownedAgentAtoms: atoms(
        where: {
          label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" }
          positions: { account_id: { _eq: $address } }
        }
        order_by: { created_at: desc }
      ) {
        term_id label emoji created_at
        positions_aggregate { aggregate { count sum { shares } } }
        firstPosition: positions(order_by: { created_at: asc }, limit: 1) {
          account_id
        }
      }

      mySkillAtoms: atoms(
        where: {
          label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" }
          creator_id: { _eq: $address }
        }
        order_by: { created_at: desc }
      ) {
        term_id label emoji created_at
        positions_aggregate { aggregate { count sum { shares } } }
      }

      ownedSkillAtoms: atoms(
        where: {
          label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" }
          positions: { account_id: { _eq: $address } }
        }
        order_by: { created_at: desc }
      ) {
        term_id label emoji created_at
        positions_aggregate { aggregate { count sum { shares } } }
        firstPosition: positions(order_by: { created_at: asc }, limit: 1) {
          account_id
        }
      }

      myPositions: positions(
        where: {
          account_id: { _eq: $address }
          shares: { _gt: "0" }
        }
        order_by: { updated_at: desc }
      ) {
        term_id shares updated_at
        vault {
          term_id total_shares
          term {
            id type
            atom { term_id label emoji }
            triple {
              term_id counter_term_id
              subject { term_id label emoji }
              predicate { label }
              object { label }
            }
          }
        }
      }

      mySkills: atoms_aggregate(
        where: {
          label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" }
          creator_id: { _eq: $address }
        }
      ) { aggregate { count } }

      myClaims: triples_aggregate(
        where: {
          creator_id: { _eq: $address }
          _or: [
            { subject: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } }
            { subject: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } }
          ]
        }
      ) { aggregate { count } }

      mySignals: signals_aggregate(
        where: { account_id: { _eq: $address } }
      ) { aggregate { count } }

      myReports: triples_aggregate(
        where: {
          creator_id: { _eq: $address }
          predicate: { label: { _ilike: "reported_for_%" } }
        }
      ) { aggregate { count } }
    }
  `, { address: checksummed })

  // Merge sources, deduplicate by term_id:
  // 1. myAgents: legacy (creator_id = user, pre-FeeProxy)
  // 2. ownedAgentAtoms filtered to first-position-holder = user (FeeProxy registrations)
  const firstPositionAgents = (data.ownedAgentAtoms || []).filter(
    a => a.firstPosition?.[0]?.account_id?.toLowerCase() === addrLc
  )
  const agentMap = new Map<string, GqlAtomData>()
  for (const a of [...(data.myAgents || []), ...firstPositionAgents]) {
    if (!agentMap.has(a.term_id)) agentMap.set(a.term_id, a)
  }

  const firstPositionSkills = (data.ownedSkillAtoms || []).filter(
    a => a.firstPosition?.[0]?.account_id?.toLowerCase() === addrLc
  )
  const skillMap = new Map<string, GqlAtomData>()
  for (const a of [...(data.mySkillAtoms || []), ...firstPositionSkills]) {
    if (!skillMap.has(a.term_id)) skillMap.set(a.term_id, a)
  }

  const registeredAgents: RegisteredAgent[] = Array.from(agentMap.values()).map(a => ({
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

  // Warstwa 1+2: skills i claims łączą creator_id (legacy) z localStorage (FeeProxy)
  const legacySkillsCount = data.mySkills?.aggregate?.count || 0
  const totalSkillsRegistered = Math.max(legacySkillsCount, skillMap.size)

  const legacyClaimsCount = data.myClaims?.aggregate?.count || 0
  const totalClaimsCreated = Math.max(legacyClaimsCount, localClaimsCount)

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
    totalAgentsRegistered: agentMap.size,
    totalSkillsRegistered,
    totalClaimsCreated,
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

  const meta = loadProfileMeta(address)

  return {
    address,
    name: meta.name,
    bio: meta.bio,
    avatar: meta.avatar,
    website: meta.website,
    twitter: meta.twitter,
    farcaster: meta.farcaster,
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
    totalSkillsRegistered: 0,
    totalClaimsCreated: 0,
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
      const merged = { ...(profile || emptyProfile(address!)), ...updates }
      if (address) {
        saveProfileMeta(address, {
          name: merged.name,
          bio: merged.bio,
          avatar: merged.avatar,
          website: merged.website,
          twitter: merged.twitter,
          farcaster: merged.farcaster,
        })
      }
      return merged
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
