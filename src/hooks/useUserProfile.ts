'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile, RegisteredAgent, AgentSupport, UserStats, PnLPosition } from '@/types/user'
import { calculateExpertLevel, autoBuildBadges } from '@/lib/badges'
import { getAddress } from 'viem'
import { APP_CONFIG } from '@/lib/app-config'
import { AGENT_WHERE_OBJ, SKILL_WHERE_OBJ, AGENT_ATOM_INLINE, SKILL_ATOM_INLINE } from '@/lib/gql-filters'
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

// ─── Types for the two-phase fetch ────────────────────────────────────────────

interface GqlMetaData {
  myAgents: GqlAtomData[]
  ownedAgentAtoms: GqlAtomDataWithFirstPos[]
  mySkillAtoms: GqlAtomData[]
  ownedSkillAtoms: GqlAtomDataWithFirstPos[]
  mySkills: { aggregate: { count: number } }
  myClaims: { aggregate: { count: number } }
  mySignals: { aggregate: { count: number } }
  myReports: { aggregate: { count: number } }
}

// ─── Phase 1 — atoms + aggregates (fast, ~200ms, no deep position JOINs) ─────

async function fetchProfileMeta(address: `0x${string}`): Promise<{
  agentMap: Map<string, GqlAtomData>
  skillMap: Map<string, GqlAtomData>
  legacySkillsCount: number
  legacyClaimsCount: number
  totalSignals: number
  reportsSubmitted: number
  addrLc: string
}> {
  const checksummed = getAddress(address)
  const addrLc = address.toLowerCase()

  const data = await gql<GqlMetaData>(`
    query ProfileMeta($address: String!) {
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
          ${AGENT_ATOM_INLINE}
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
          ${SKILL_ATOM_INLINE}
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

      mySkills: atoms_aggregate(
        where: {
          ${SKILL_ATOM_INLINE}
          creator_id: { _eq: $address }
        }
      ) { aggregate { count } }

      myClaims: triples_aggregate(
        where: {
          creator_id: { _eq: $address }
          _or: [
            { subject: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } }
            { subject: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } }
            { subject: { as_subject_triples: { predicate_id: { _eq: "0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba" } } } }
            { subject: { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } } }
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

  return {
    agentMap,
    skillMap,
    legacySkillsCount: data.mySkills?.aggregate?.count || 0,
    legacyClaimsCount: data.myClaims?.aggregate?.count || 0,
    totalSignals: data.mySignals?.aggregate?.count || 0,
    reportsSubmitted: data.myReports?.aggregate?.count || 0,
    addrLc,
  }
}

// ─── Phase 2 — positions (lazy, deep nested, only for Supporting / PnL tabs) ──

interface GqlPositionsData {
  myPositions: GqlPosition[]
}

async function fetchProfilePositions(
  address: `0x${string}`,
  platformAtomIds: Set<string>,
  agentMap: Map<string, GqlAtomData>,
  skillMap: Map<string, GqlAtomData>,
): Promise<{ agentPositions: AgentSupport[]; pnlPositions: PnLPosition[]; totalStaked: bigint }> {
  const checksummed = getAddress(address)
  const addrLcForQuery = checksummed.toLowerCase()

  const data = await gql<GqlPositionsData>(`
    query ProfilePositions($address: String!, $addressLc: String!) {
      myPositions: positions(
        where: {
          _and: [
            { shares: { _gt: "0" } },
            { _or: [
              { account_id: { _eq: $address } },
              { account_id: { _eq: $addressLc } }
            ]}
          ]
        }
        order_by: { updated_at: desc }
        limit: 200
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
    }
  `, { address: checksummed, addressLc: addrLcForQuery })

  const pnlPositions: PnLPosition[] = []
  const agentPositions: AgentSupport[] = []
  const seenKeys = new Set<string>()
  let totalStaked = BigInt(0)

  for (const pos of (data.myPositions || [])) {
    const shares = BigInt(pos.shares || '0')
    if (shares <= 0n) continue
    const term = pos.vault?.term
    if (!term) continue

    const atomLabel = term.atom?.label || ''
    const atomTermId = term.atom?.term_id || ''
    const tripleSubjectLabel = term.triple?.subject?.label || ''
    const tripleSubjectTermId = term.triple?.subject?.term_id || ''
    const isIntuScoped =
      atomLabel.startsWith(APP_CONFIG.AGENT_PREFIX) ||
      atomLabel.startsWith(APP_CONFIG.SKILL_PREFIX) ||
      tripleSubjectLabel.startsWith(APP_CONFIG.AGENT_PREFIX) ||
      tripleSubjectLabel.startsWith(APP_CONFIG.SKILL_PREFIX) ||
      platformAtomIds.has(atomTermId) ||
      platformAtomIds.has(tripleSubjectTermId)

    if (!isIntuScoped) continue
    totalStaked += shares

    const isAgentAtom =
      term.atom?.label?.startsWith(APP_CONFIG.AGENT_PREFIX) ||
      agentMap.has(atomTermId)

    if (term.atom && isAgentAtom) {
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

    const isAgentTripleSubject =
      term.triple?.subject?.label?.startsWith(APP_CONFIG.AGENT_PREFIX) ||
      agentMap.has(tripleSubjectTermId)

    if (term.triple && isAgentTripleSubject) {
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

    const totalShares = pos.vault?.total_shares || '0'
    if (term.atom) {
      const label = term.atom.label || ''
      const tid = term.atom.term_id || ''
      const type = (label.startsWith(APP_CONFIG.AGENT_PREFIX) || agentMap.has(tid))
        ? 'agent'
        : (label.startsWith(APP_CONFIG.SKILL_PREFIX) || skillMap.has(tid))
          ? 'skill'
          : null
      if (type) {
        pnlPositions.push({
          termId: pos.term_id,
          vaultTermId: pos.vault.term_id,
          label,
          emoji: term.atom.emoji || undefined,
          type,
          side: 'for',
          shares: pos.shares,
          totalShares,
          updatedAt: pos.updated_at,
        })
      }
    } else if (term.triple) {
      const t = term.triple
      const subjectLabel = t.subject?.label || ''
      const subjectTermId = t.subject?.term_id || ''
      if (
        subjectLabel.startsWith(APP_CONFIG.AGENT_PREFIX) ||
        subjectLabel.startsWith(APP_CONFIG.SKILL_PREFIX) ||
        platformAtomIds.has(subjectTermId)
      ) {
        const isForVault = t.term_id === pos.vault.term_id
        const side = isForVault ? 'for' : 'against'
        pnlPositions.push({
          termId: pos.term_id,
          vaultTermId: pos.vault.term_id,
          label: `${subjectLabel} ${t.predicate?.label || ''} ${t.object?.label || ''}`.trim(),
          type: 'claim',
          side,
          shares: pos.shares,
          totalShares,
          updatedAt: pos.updated_at,
          claimSubject: subjectLabel,
          claimPredicate: t.predicate?.label,
          claimObject: t.object?.label,
        })
      }
    }
  }

  return { agentPositions, pnlPositions, totalStaked }
}

// ─── Assemble full profile from meta + optional positions ─────────────────────

function assembleProfile(
  address: `0x${string}`,
  meta: Awaited<ReturnType<typeof fetchProfileMeta>>,
  positions: { agentPositions: AgentSupport[]; pnlPositions: PnLPosition[]; totalStaked: bigint } | null,
  localClaimsCount: number,
): UserProfile {
  const { agentMap, skillMap, legacySkillsCount, legacyClaimsCount, totalSignals, reportsSubmitted } = meta
  const agentPositions = positions?.agentPositions ?? []
  const pnlPositions = positions?.pnlPositions ?? []
  const totalStaked = positions?.totalStaked ?? BigInt(0)

  const registeredAgents: RegisteredAgent[] = Array.from(agentMap.values()).map(a => ({
    termId: a.term_id,
    label: a.label,
    emoji: a.emoji || undefined,
    createdAt: a.created_at,
    trustScore: 50,
    stakers: a.positions_aggregate?.aggregate?.count || 0,
    totalStaked: a.positions_aggregate?.aggregate?.sum?.shares || '0',
  }))

  const totalSkillsRegistered = Math.max(legacySkillsCount, skillMap.size)
  const totalClaimsCreated = Math.max(legacyClaimsCount, localClaimsCount)
  const totalPositions = pnlPositions.length
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
    totalAgentsRegistered: agentMap.size,
    totalSkillsRegistered,
    totalClaimsCreated,
    totalTrustStaked: totalStaked,
    totalAttestations: agentPositions.length,
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

  const profileMeta = loadProfileMeta(address)

  return {
    address,
    name: profileMeta.name,
    bio: profileMeta.bio,
    avatar: profileMeta.avatar,
    website: profileMeta.website,
    twitter: profileMeta.twitter,
    farcaster: profileMeta.farcaster,
    stats,
    badges,
    expertLevel,
    registeredAgents,
    supportedAgents: agentPositions,
    pnlPositions,
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
  pnlPositions: [],
  joinedAt: new Date(),
  lastActiveAt: new Date(),
})

/**
 * Two-phase profile loader:
 *   Phase 1 (always): atoms + aggregates — fast, no deep position JOINs.
 *   Phase 2 (lazy):   positions — triggered only when Supporting or P&L tab is active.
 *
 * Pass `activeTab` so the hook knows when to fire the slow positions query.
 * The page renders immediately after Phase 1; Supporting/PnL tabs show their
 * own skeleton only while Phase 2 is in flight.
 */
export function useUserProfile(address?: `0x${string}`, activeTab?: string) {
  const queryClient = useQueryClient()
  const needsPositions = activeTab === 'supporting' || activeTab === 'pnl'

  // Phase 1 — fast query
  const metaQuery = useQuery({
    queryKey: ['userProfileMeta', address],
    queryFn: () => fetchProfileMeta(address!),
    enabled: !!address,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  // Phase 2 — lazy positions query (fires when user navigates to Supporting/PnL)
  const positionsQuery = useQuery({
    queryKey: ['userProfilePositions', address],
    queryFn: () => {
      const meta = metaQuery.data!
      const platformAtomIds = new Set<string>([
        ...Array.from(meta.agentMap.keys()),
        ...Array.from(meta.skillMap.keys()),
      ])
      return fetchProfilePositions(address!, platformAtomIds, meta.agentMap, meta.skillMap)
    },
    enabled: !!address && needsPositions && !!metaQuery.data,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  const localClaimsCount = address ? getUserRegistrationsByType(address, 'claim').length : 0

  const profile = metaQuery.data
    ? assembleProfile(address!, metaQuery.data, positionsQuery.data ?? null, localClaimsCount)
    : emptyProfile(address || '0x0000000000000000000000000000000000000000' as `0x${string}`)

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const merged = { ...profile, ...updates }
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
      queryClient.setQueryData(['userProfileMeta', address], metaQuery.data)
      queryClient.setQueryData(['userProfile', address], newProfile)
    },
  })

  return {
    profile,
    // isLoading: true only until Phase 1 resolves — tabs that need positions
    // show their own skeleton via positionsLoading
    isLoading: metaQuery.isLoading,
    positionsLoading: needsPositions && positionsQuery.isLoading,
    error: metaQuery.error,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
