/**
 * API Data Layer — server-side data fetching for Trust API v1.
 *
 * All functions are pure async, no React/wagmi. They fetch from Hasura GraphQL
 * and reuse existing scoring engines (zero duplication of business logic).
 */

import { APP_CONFIG } from './app-config'
import { AGENT_WHERE_STR, SKILL_WHERE_STR } from './gql-filters'
import { calculateTrustScoreFromStakes } from './trust-score-engine'
import { calculateHybridScore, getHybridLevel } from './hybrid-trust'
import { calculateSkillBreakdown } from './skill-trust'
import { fetchAgentSkillTriples } from './intuition'
import {
  aggregateDomains,
  scoreDomainAgents,
  cleanDomainName,
  type DomainTripleData,
} from './domain-scoring'
import { fetchEvaluatorLeaderboard, fetchStakerPositions } from './evaluator-data'
import { calculateEvaluatorScore, EVALUATOR_TIER_CONFIG, type EvaluatorTier } from './evaluator-score'
import { calculateTier, calculateTierProgress, getAgentAgeDays } from './trust-tiers'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL
const TRUST_PREDICATE_ID = '0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba'

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data as T
}

function parseBigInt(val?: string | null): bigint {
  try { return BigInt(val || '0') } catch { return 0n }
}

function weiToFloat(wei: bigint): number {
  return Math.round((Number(wei) / 1e18) * 1e6) / 1e6
}

function cleanLabel(label: string): string {
  return label.replace(/^(INTU:|Agent:|Skill:)/i, '').trim()
}

function momentumLabel(momentum: number): string {
  if (momentum > 2) return 'rising'
  if (momentum > 0.5) return 'slightly_rising'
  if (momentum < -2) return 'falling'
  if (momentum < -0.5) return 'slightly_falling'
  return 'stable'
}

type AgentRow = {
  term_id: string
  label: string
  type: string
  emoji?: string
  created_at: string
  creator?: { label: string; id?: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string | null } | null } | null }
  as_subject_triples?: Array<{ counter_term_id: string }> | null
  subjectTriplesCount?: Array<{ id: string }>
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export type AgentApiItem = {
  id: string
  name: string
  agentScore: number
  trustTier: string
  momentum: number
  momentumDirection: string
  supportStake: number
  opposeStake: number
  stakerCount: number
  skillCount: number
  createdAt: string
}

async function fetchAgentRows(limit = 200): Promise<AgentRow[]> {
  const data = await gql<{ atoms: AgentRow[] }>(`
    query ApiAgents {
      atoms(
        where: ${AGENT_WHERE_STR}
        limit: ${limit}
        order_by: { created_at: desc }
      ) {
        term_id
        label
        type
        emoji
        created_at
        creator { label id }
        positions_aggregate {
          aggregate {
            count
            sum { shares }
          }
        }
        as_subject_triples(
          where: { predicate_id: { _eq: "${TRUST_PREDICATE_ID}" } }
          limit: 1
        ) { counter_term_id }
      }
    }
  `)
  return data?.atoms || []
}

async function batchFetchOpposeShares(rows: AgentRow[]): Promise<Map<string, bigint>> {
  const counterTermIds = rows
    .map(a => a.as_subject_triples?.[0]?.counter_term_id)
    .filter((id): id is string => !!id)

  const opposeMap = new Map<string, bigint>()
  if (counterTermIds.length === 0) return opposeMap

  const data = await gql<{ positions: Array<{ term_id: string; shares: string }> }>(
    `{ positions(where: { term_id: { _in: ${JSON.stringify(counterTermIds)} } }) { term_id shares } }`
  )
  for (const pos of data?.positions ?? []) {
    const prev = opposeMap.get(pos.term_id) || 0n
    try { opposeMap.set(pos.term_id, prev + parseBigInt(pos.shares)) } catch { /* skip */ }
  }
  return opposeMap
}

function rowToAgentItem(row: AgentRow, opposeWei: bigint): AgentApiItem {
  const supportWei = parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)
  const stakerCount = row.positions_aggregate?.aggregate?.count || 0
  const totalWei = supportWei + opposeWei
  const supportRatio = totalWei > 0n ? Number((supportWei * 100n) / totalWei) : 50

  const trustResult = calculateTrustScoreFromStakes(supportWei, opposeWei)
  const agentScore = calculateHybridScore(trustResult.score, trustResult.score, supportRatio)
  const totalStakeTtrust = weiToFloat(supportWei + opposeWei)
  const ageDays = getAgentAgeDays(row.created_at)
  const trustTier = calculateTier(stakerCount, totalStakeTtrust, supportRatio, ageDays)

  return {
    id: row.term_id,
    name: cleanLabel(row.label),
    agentScore,
    trustTier: trustTier.tier,
    momentum: Math.round(trustResult.momentum * 10) / 10,
    momentumDirection: momentumLabel(trustResult.momentum),
    supportStake: weiToFloat(supportWei),
    opposeStake: weiToFloat(opposeWei),
    stakerCount,
    skillCount: 0, // enriched separately when needed
    createdAt: row.created_at,
  }
}

export async function getAgentsWithScores(options: {
  sort?: 'score' | 'stakers' | 'newest'
  limit?: number
  offset?: number
  minTrust?: number
} = {}): Promise<{ agents: AgentApiItem[]; total: number }> {
  const { sort = 'score', limit = 20, offset = 0, minTrust = 0 } = options

  const rows = await fetchAgentRows(200)
  const opposeMap = await batchFetchOpposeShares(rows)

  let items = rows.map(row => {
    const ctid = row.as_subject_triples?.[0]?.counter_term_id
    const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n
    return rowToAgentItem(row, opposeWei)
  })

  if (minTrust > 0) {
    items = items.filter(a => a.agentScore >= minTrust)
  }

  if (sort === 'score') {
    items.sort((a, b) => b.agentScore - a.agentScore)
  } else if (sort === 'stakers') {
    items.sort((a, b) => b.stakerCount - a.stakerCount)
  }
  // 'newest' = keep default desc created_at order from GraphQL

  const total = items.length
  return { agents: items.slice(offset, offset + limit), total }
}

// ─── Agent Detail ─────────────────────────────────────────────────────────────

export type AgentDetailApiItem = AgentApiItem & {
  supportRatio: number
  skillBreakdown: Array<{
    skillName: string
    score: number
    supportStake: number
    opposeStake: number
    stakerCount: number
    level: string
  }>
  hasRadar: boolean
}

export async function getAgentDetail(termId: string): Promise<AgentDetailApiItem | null> {
  const rows = await fetchAgentRows(200)
  const row = rows.find(r => r.term_id === termId)
  if (!row) return null

  const opposeMap = await batchFetchOpposeShares([row])
  const ctid = row.as_subject_triples?.[0]?.counter_term_id
  const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n

  const base = rowToAgentItem(row, opposeWei)

  const supportWei = parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)
  const totalWei = supportWei + opposeWei
  const supportRatio = totalWei > 0n ? Math.round(Number((supportWei * 100n) / totalWei) * 10) / 10 : 50

  const skillTriples = await fetchAgentSkillTriples(termId)
  const skillBreakdownResult = calculateSkillBreakdown(skillTriples)

  const skillBreakdown = skillBreakdownResult.skills.map(s => ({
    skillName: s.skillName,
    score: s.score,
    supportStake: weiToFloat(s.supportShares),
    opposeStake: weiToFloat(s.opposeShares),
    stakerCount: s.stakerCount,
    level: s.level,
  }))

  const agentScore = skillBreakdownResult.hasSkills
    ? skillBreakdownResult.overallScore
    : base.agentScore

  return {
    ...base,
    id: termId,
    agentScore,
    skillCount: skillBreakdown.length,
    supportRatio,
    skillBreakdown,
    hasRadar: skillBreakdown.length >= 3,
  }
}

// ─── Agent Trust Breakdown ────────────────────────────────────────────────────

export type AgentTrustBreakdown = {
  agentId: string
  agentName: string
  agentScore: number
  trustScore: {
    raw: number
    confidence: number
    anchored: number
    momentum: number
  }
  compositeScore: {
    total: number
    signalRatio: number
    stakerDiversity: number
    stability: number
    priceRetention: number
  }
  softGate: {
    supportRatio: number
    scaleFactor: number
    applied: boolean
  }
  antiManipulation: {
    diversityWeightedRatio: number
    whaleDetected: boolean
    largestStakerShare: number
    evaluatorWeightsApplied: boolean
  }
  tier: {
    current: string
    nextTier: string | null
    requirements: Record<string, string>
  }
}

export async function getAgentTrustBreakdown(termId: string): Promise<AgentTrustBreakdown | null> {
  // Fetch atom data (no vault field — Hasura schema exposes positions at top level)
  const data = await gql<{ atoms: AgentRow[] }>(`
    query ApiAgentTrust {
      atoms(
        where: { _and: [${AGENT_WHERE_STR}, { term_id: { _eq: "${termId}" } }] }
        limit: 1
      ) {
        term_id
        label
        created_at
        positions_aggregate {
          aggregate { count sum { shares } }
        }
        as_subject_triples(
          where: { predicate_id: { _eq: "${TRUST_PREDICATE_ID}" } }
          limit: 1
        ) { counter_term_id }
      }
    }
  `)

  const row = data?.atoms?.[0]
  if (!row) return null

  const [opposeMap, positionsData] = await Promise.all([
    batchFetchOpposeShares([row]),
    gql<{ positions: Array<{ account_id: string; shares: string }> }>(
      `{ positions(where: { term_id: { _eq: "${termId}" } } order_by: { shares: desc }) { account_id shares } }`
    ),
  ])

  const ctid = row.as_subject_triples?.[0]?.counter_term_id
  const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n
  const supportWei = parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)
  const stakerCount = row.positions_aggregate?.aggregate?.count || 0

  const totalWei = supportWei + opposeWei
  const supportRatio = totalWei > 0n ? Number((supportWei * 100n) / totalWei) : 50

  const trustResult = calculateTrustScoreFromStakes(supportWei, opposeWei)
  const agentScore = calculateHybridScore(trustResult.score, trustResult.score, supportRatio)

  // Soft gate analysis
  const scaleFactor = supportRatio < 50 ? supportRatio / 50 : 1.0
  const softGateApplied = supportRatio < 50

  // Whale detection from positions (top-level query)
  const positions = positionsData?.positions || []
  const totalSupply = Number(supportWei) // support vault supply
  let largestShare = 0
  if (positions.length > 0 && totalSupply > 0) {
    const largest = Math.max(...positions.map(p => {
      try { return Number(BigInt(p.shares)) } catch { return 0 }
    }))
    largestShare = Math.round((largest / totalSupply) * 100) / 100
  }
  const whaleDetected = largestShare > 0.20

  // Diversity-weighted ratio (simplified: support ratio as proxy)
  const diversityWeightedRatio = Math.round(supportRatio * 10) / 10

  // Composite score approximation (full composite needs historical signal data)
  const stakerDiversity = stakerCount <= 1 ? 0
    : Math.min(100, (Math.log2(stakerCount) / Math.log2(100)) * 100)
  const compositeApprox = Math.round(
    trustResult.score * 0.40 + stakerDiversity * 0.25 + 70 * 0.25 + 100 * 0.10
  )

  // Tier info
  const totalStakeTtrust = weiToFloat(totalWei)
  const ageDays = getAgentAgeDays(row.created_at)
  const tierProgress = calculateTierProgress(stakerCount, totalStakeTtrust, supportRatio, ageDays)
  const currentTier = tierProgress.currentTier
  const nextTier = tierProgress.nextTier
  const progress = tierProgress.progress

  const tierRequirements: Record<string, string> = nextTier ? {
    stakers: `${progress.stakers.current}/${progress.stakers.required}`,
    stake: `${progress.totalStake.current.toFixed(4)}/${progress.totalStake.required} tTRUST`,
    ratio: `${Math.round(progress.trustRatio.current)}%/${progress.trustRatio.required}%`,
    age: `${Math.round(progress.ageDays.current)}/${progress.ageDays.required} days`,
  } : {}

  return {
    agentId: termId,
    agentName: cleanLabel(row.label),
    agentScore,
    trustScore: {
      raw: Math.round(trustResult.baseScore * 10) / 10,
      confidence: Math.round(trustResult.confidence * 100) / 100,
      anchored: Math.round(trustResult.anchoredScore * 10) / 10,
      momentum: Math.round(trustResult.momentum * 10) / 10,
    },
    compositeScore: {
      total: compositeApprox,
      signalRatio: Math.round(supportRatio),
      stakerDiversity: Math.round(stakerDiversity),
      stability: 70,
      priceRetention: 100,
    },
    softGate: {
      supportRatio: Math.round(supportRatio * 10) / 10,
      scaleFactor: Math.round(scaleFactor * 100) / 100,
      applied: softGateApplied,
    },
    antiManipulation: {
      diversityWeightedRatio,
      whaleDetected,
      largestStakerShare: largestShare,
      evaluatorWeightsApplied: false,
    },
    tier: {
      current: currentTier.tier,
      nextTier: nextTier?.tier || null,
      requirements: tierRequirements,
    },
  }
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export type SkillApiItem = {
  id: string
  name: string
  agentCount: number
  totalStake: number
  totalStakers: number
}

async function fetchDomainTriplesInternal(): Promise<DomainTripleData[]> {
  // Step 1: fetch all hasAgentSkill triples
  const res = await gql<{
    triples: Array<{
      term_id: string
      counter_term_id: string | null
      subject: { term_id: string; label: string }
      predicate: { label: string }
      object: { term_id: string; label: string }
    }>
  }>(`
    query GetAllDomainTriples {
      triples(
        where: {
          _or: [
            { predicate: { label: { _eq: "hasAgentSkill" } } }
            { predicate: { label: { _eq: "has-agent-skill" } } }
            { predicate: { label: { _eq: "isTrustedFor" } } }
          ]
        }
        limit: 500
      ) {
        term_id
        counter_term_id
        subject { term_id label }
        predicate { label }
        object { term_id label }
      }
    }
  `)

  const triples = res?.triples || []
  if (triples.length === 0) return []

  const vaultIds: string[] = []
  for (const t of triples) {
    vaultIds.push(t.term_id)
    if (t.counter_term_id) vaultIds.push(t.counter_term_id)
  }

  const posData = await gql<{ positions: Array<{ term_id: string; shares: string }> }>(
    `query GetDomainPositions($vaultIds: [String!]!) {
       positions(where: { term_id: { _in: $vaultIds } }) { term_id shares }
     }`,
    { vaultIds }
  )
  const positions = posData?.positions || []

  const vaultMap = new Map<string, { totalShares: bigint; count: number }>()
  for (const pos of positions) {
    if (!pos.shares) continue
    const prev = vaultMap.get(pos.term_id) || { totalShares: 0n, count: 0 }
    try {
      vaultMap.set(pos.term_id, { totalShares: prev.totalShares + parseBigInt(pos.shares), count: prev.count + 1 })
    } catch { /* skip */ }
  }

  return triples.map(t => {
    const forVault = vaultMap.get(t.term_id) || { totalShares: 0n, count: 0 }
    const againstVault = t.counter_term_id
      ? (vaultMap.get(t.counter_term_id) || { totalShares: 0n, count: 0 })
      : { totalShares: 0n, count: 0 }

    return {
      tripleId: t.term_id,
      agentId: t.subject?.term_id || '',
      agentName: t.subject?.label || 'Unknown',
      skillId: t.object?.term_id || '',
      skillName: t.object?.label || 'Unknown',
      supportShares: forVault.totalShares,
      opposeShares: againstVault.totalShares,
      supportPositionCount: forVault.count,
      opposePositionCount: againstVault.count,
    }
  })
}

export async function getSkills(): Promise<SkillApiItem[]> {
  const data = await gql<{ atoms: Array<{ term_id: string; label: string }> }>(`
    query ApiSkills {
      atoms(
        where: ${SKILL_WHERE_STR}
        limit: 200
        order_by: { created_at: desc }
      ) {
        term_id
        label
      }
    }
  `)
  const skillAtoms = data?.atoms || []

  // Get domain triples to compute agent count + stake per skill
  const domainTriples = await fetchDomainTriplesInternal()
  const domains = aggregateDomains(domainTriples)

  const domainMap = new Map(domains.map(d => [d.id, d]))

  return skillAtoms.map(atom => {
    const domain = domainMap.get(atom.term_id)
    return {
      id: atom.term_id,
      name: cleanDomainName(atom.label),
      agentCount: domain?.agentCount || 0,
      totalStake: domain ? weiToFloat(domain.totalShares) : 0,
      totalStakers: domain?.totalStakers || 0,
    }
  })
}

export type SkillDetailApiItem = SkillApiItem & {
  agents: Array<{
    agentId: string
    agentName: string
    domainScore: number
    rank: number
    stakerCount: number
  }>
}

export async function getSkillDetail(skillTermId: string): Promise<SkillDetailApiItem | null> {
  const skills = await getSkills()
  const skill = skills.find(s => s.id === skillTermId)
  if (!skill) return null

  const domainTriples = await fetchDomainTriplesInternal()
  const filtered = domainTriples.filter(t => t.skillId === skillTermId)
  const agents = scoreDomainAgents(filtered)

  return {
    ...skill,
    agents: agents.map(a => ({
      agentId: a.agentId,
      agentName: a.agentName,
      domainScore: a.domainScore,
      rank: a.rank,
      stakerCount: a.stakerCount,
    })),
  }
}

// ─── Domains ─────────────────────────────────────────────────────────────────

export async function getDomains() {
  const domainTriples = await fetchDomainTriplesInternal()
  const domains = aggregateDomains(domainTriples)

  return domains.map(d => ({
    id: d.id,
    name: d.name,
    agentCount: d.agentCount,
    totalStake: weiToFloat(d.totalShares),
    totalStakers: d.totalStakers,
    topAgent: d.topAgent,
    topAgentScore: d.topAgentScore,
  }))
}

export async function getDomainAgents(
  domainId: string,
  options: { minTrust?: number; limit?: number } = {}
): Promise<{
  domain: { id: string; name: string } | null
  agents: Array<{
    rank: number; agentId: string; agentName: string
    domainScore: number; supportRatio: number; stakerCount: number
    level: string; supportStake: number; opposeStake: number
  }>
  total: number
}> {
  const { minTrust = 0, limit = 20 } = options

  const domainTriples = await fetchDomainTriplesInternal()
  const domainTriple = domainTriples.find(t => t.skillId === domainId)

  if (!domainTriple && domainTriples.filter(t => t.skillId === domainId).length === 0) {
    return { domain: null, agents: [], total: 0 }
  }

  const filtered = domainTriples.filter(t => t.skillId === domainId)
  let agents = scoreDomainAgents(filtered)

  if (minTrust > 0) {
    agents = agents.filter(a => a.domainScore >= minTrust)
  }

  const total = agents.length
  const domainName = domainTriple ? cleanDomainName(domainTriple.skillName) : ''

  return {
    domain: { id: domainId, name: domainName },
    agents: agents.slice(0, limit).map(a => ({
      rank: a.rank,
      agentId: a.agentId,
      agentName: a.agentName,
      domainScore: a.domainScore,
      supportRatio: a.supportRatio,
      stakerCount: a.stakerCount,
      level: a.level,
      supportStake: weiToFloat(a.supportShares),
      opposeStake: weiToFloat(a.opposeShares),
    })),
    total,
  }
}

// ─── Evaluators ──────────────────────────────────────────────────────────────

export async function getEvaluators(options: {
  minAccuracy?: number
  tiers?: EvaluatorTier[]
  limit?: number
} = {}) {
  const { minAccuracy = 0, tiers, limit = 50 } = options

  let profiles = await fetchEvaluatorLeaderboard()

  if (minAccuracy > 0) {
    profiles = profiles.filter(p => p.adjustedAccuracy >= minAccuracy)
  }
  if (tiers && tiers.length > 0) {
    profiles = profiles.filter(p => tiers.includes(p.evaluatorTier))
  }

  return profiles.slice(0, limit).map((p, i) => {
    const tierConfig = EVALUATOR_TIER_CONFIG[p.evaluatorTier]
    return {
      rank: i + 1,
      address: p.address,
      tier: p.evaluatorTier,
      tierIcon: tierConfig.icon,
      accuracy: p.rawAccuracy,
      evaluatorWeight: p.evaluatorWeight,
      totalEvaluations: p.totalPositions,
      correctEvaluations: p.goodPicks,
      streakCount: p.streakCount,
      bestPick: p.bestPick,
    }
  })
}

/**
 * Alias used by MCP handler — wraps getEvaluators with single-tier string param.
 */
export async function getEvaluatorLeaderboard(options: {
  minAccuracy?: number
  tier?: string
  limit?: number
} = {}) {
  const { minAccuracy, tier, limit } = options
  const tiers = tier ? [tier as EvaluatorTier] : undefined
  return getEvaluators({ minAccuracy, tiers, limit })
}

export async function getEvaluatorProfile(address: string) {
  // Fetch leaderboard and individual positions in parallel
  const [leaderboard, positions] = await Promise.all([
    fetchEvaluatorLeaderboard(),
    fetchStakerPositions(address),
  ])

  const leaderboardEntry = leaderboard.find(p => p.address.toLowerCase() === address.toLowerCase())

  // Must have at least one data source
  if (!leaderboardEntry && positions.length === 0) return null

  // Prefer leaderboard (has all data); fall back to computed from positions
  const profile = leaderboardEntry ?? calculateEvaluatorScore(address, positions)
  const tierConfig = EVALUATOR_TIER_CONFIG[profile.evaluatorTier]

  const trackRecord = positions.filter(p => !p.isCreator).map(p => ({
    agentName: p.agentName,
    side: p.side,
    currentTrust: p.currentTrustScore,
    correct:
      (p.side === 'support' && p.currentTrustScore > 50) ||
      (p.side === 'oppose' && p.currentTrustScore < 50),
  }))

  return {
    address: profile.address,
    tier: profile.evaluatorTier,
    tierIcon: tierConfig.icon,
    accuracy: profile.rawAccuracy,
    adjustedAccuracy: profile.adjustedAccuracy,
    confidence: profile.confidence,
    evaluatorWeight: profile.evaluatorWeight,
    totalEvaluations: profile.totalPositions,
    correctEvaluations: profile.goodPicks,
    streakCount: profile.streakCount,
    bestPick: profile.bestPick,
    worstPick: profile.worstPick,
    trackRecord,
  }
}

// ─── Trust Query ─────────────────────────────────────────────────────────────

export async function trustQuery(params: {
  skill?: string
  minTrust?: number
  minStakers?: number
  sort?: 'score' | 'stakers'
  limit?: number
}) {
  const { skill, minTrust = 0, minStakers = 0, sort = 'score', limit = 10 } = params

  if (skill) {
    // Domain-scoped query
    const domainTriples = await fetchDomainTriplesInternal()

    // Match domain by name (case-insensitive, slug-friendly)
    const normalizeSkill = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, '-')
    const skillNorm = normalizeSkill(skill)

    const matchingSkillIds = new Set<string>()
    for (const t of domainTriples) {
      const nameNorm = normalizeSkill(cleanDomainName(t.skillName))
      if (nameNorm === skillNorm || nameNorm.includes(skillNorm) || skillNorm.includes(nameNorm)) {
        matchingSkillIds.add(t.skillId)
      }
    }

    if (matchingSkillIds.size === 0) {
      return { query: params, results: [], total: 0 }
    }

    const filtered = domainTriples.filter(t => matchingSkillIds.has(t.skillId))
    let agents = scoreDomainAgents(filtered)

    if (minTrust > 0) agents = agents.filter(a => a.domainScore >= minTrust)
    if (minStakers > 0) agents = agents.filter(a => a.stakerCount >= minStakers)
    if (sort === 'stakers') agents.sort((a, b) => b.stakerCount - a.stakerCount)

    const domainId = [...matchingSkillIds][0]
    const domainName = cleanDomainName(domainTriples.find(t => t.skillId === domainId)?.skillName || skill)

    const results = agents.slice(0, limit).map(a => ({
      agentId: a.agentId,
      agentName: a.agentName,
      score: a.domainScore,
      stakerCount: a.stakerCount,
      domain: domainName,
      level: a.level,
    }))

    return { query: params, results, total: agents.length }
  } else {
    // Global agent query
    const { agents } = await getAgentsWithScores({ sort, limit: 200, minTrust })
    let filtered = agents
    if (minStakers > 0) filtered = filtered.filter(a => a.stakerCount >= minStakers)

    const results = filtered.slice(0, limit).map(a => ({
      agentId: a.id,
      agentName: a.name,
      score: a.agentScore,
      stakerCount: a.stakerCount,
      domain: null,
      level: getHybridLevel(a.agentScore),
    }))

    return { query: params, results, total: filtered.length }
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getPlatformStats() {
  const [agentRows, skillData, evaluatorProfiles, domainTriples] = await Promise.all([
    fetchAgentRows(500),
    gql<{ atoms: Array<{ term_id: string }> }>(`
      query ApiSkillCount {
        atoms(where: ${SKILL_WHERE_STR} limit: 500) { term_id }
      }
    `),
    fetchEvaluatorLeaderboard(),
    fetchDomainTriplesInternal(),
  ])

  const opposeMap = await batchFetchOpposeShares(agentRows)

  let totalStakedWei = 0n
  const stakerSet = new Set<string>()
  let topAgentScore = 0
  let topAgentName = ''

  for (const row of agentRows) {
    const supportWei = parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)
    const ctid = row.as_subject_triples?.[0]?.counter_term_id
    const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n
    totalStakedWei += supportWei
    const stakerCount = row.positions_aggregate?.aggregate?.count || 0

    const supportRatio = (supportWei + opposeWei) > 0n
      ? Number((supportWei * 100n) / (supportWei + opposeWei)) : 50
    const tr = calculateTrustScoreFromStakes(supportWei, opposeWei)
    const score = calculateHybridScore(tr.score, tr.score, supportRatio)

    if (score > topAgentScore) {
      topAgentScore = score
      topAgentName = cleanLabel(row.label)
    }

    // Count unique stakers (use staker count as proxy — no address list in batch)
    for (let i = 0; i < stakerCount; i++) {
      stakerSet.add(`${row.term_id}-${i}`) // approximate uniqueness
    }
  }

  const domains = aggregateDomains(domainTriples)
  const topDomain = domains[0] || null

  // Approximate active stakers from evaluator data (more accurate)
  const activeStakers = evaluatorProfiles.length || stakerSet.size

  // Fetch claim count
  let claimCount = 0
  try {
    const claimData = await gql<{ triples_aggregate: { aggregate: { count: number } } }>(`
      { triples_aggregate { aggregate { count } } }
    `)
    claimCount = claimData?.triples_aggregate?.aggregate?.count || 0
  } catch { /* non-critical */ }

  return {
    agents: agentRows.length,
    skills: skillData?.atoms?.length || 0,
    domains: domains.length,
    claims: claimCount,
    evaluators: evaluatorProfiles.length,
    totalStaked: weiToFloat(totalStakedWei),
    activeStakers,
    topDomain: topDomain
      ? { name: topDomain.name, agentCount: topDomain.agentCount }
      : null,
    topAgent: topAgentName
      ? { name: topAgentName, score: topAgentScore }
      : null,
  }
}
