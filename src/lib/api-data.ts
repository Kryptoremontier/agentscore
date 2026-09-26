/**
 * API Data Layer — server-side data fetching for Trust API v1.
 *
 * All functions are pure async, no React/wagmi. They fetch from Hasura GraphQL
 * and reuse existing scoring engines (zero duplication of business logic).
 */

import { createPublicClient, http } from 'viem'
import { intuitionTestnet } from '@0xintuition/protocol'
import { APP_CONFIG } from './app-config'
import { AGENT_WHERE_STR, SKILL_WHERE_STR } from './gql-filters'
import { calculateTrustScoreFromStakes } from './trust-score-engine'
import { scoreBasisOf, type ScoreBasis } from './score-basis'
import { calculateHybridScore, getHybridLevel } from './hybrid-trust'
import { calculateCompositeTrust, calculateStableDays, findPeakPrice } from './composite-trust'
import { calculateWeightedTrust } from './reputation-decay'
import { getOnChainSharePrice } from './on-chain-pricing'
import { computeScoreEnvelope } from './scoring/engine'
import { qualityCacheGet, qualityCacheSet } from './scoring/quality-cache'
import type { ScoreEnvelope } from './scoring/types'
import { calculateSkillBreakdown } from './skill-trust'
import { fetchAgentSkillTriples } from './intuition'
import {
  aggregateDomains,
  scoreDomainAgents,
  cleanDomainName,
  type DomainTripleData,
} from './domain-scoring'
import { refineSkillTriples, mapSkillToBucket } from './skill-domain-map'
import { fetchEvaluatorLeaderboard, fetchStakerPositions } from './evaluator-data'
import { calculateEvaluatorScore, EVALUATOR_TIER_CONFIG, type EvaluatorTier } from './evaluator-score'
import { getAttestationCount, getAttestationConfig } from './attestation-gate'
import { calculateAgentTier, AGENT_TIER_BASIS, type AgentTier, type AgentTierBasis } from './agent-tier'
import { fetchAttestations, fetchAttestationsForSubjects, type AttestedEntry } from './attestation-reader'
import { summarizeAttesters } from './agent-profile'
import { fetchCohortAgent } from './cohort-reader'
import { filterAgents, type AgentJunkReason } from './agent-junk-filter'
import { fetchAllRows, gqlRequest, SERVER_ROW_CAP, type GqlRequest, type PagedRows } from './gql-pager'
import { fetchVaultPositions, sumSharesByVault, vaultStakeStats, type VaultPosition } from './vault-positions'
import { countLiveStakers, liveStakerWallets } from './live-position'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL
const TRUST_PREDICATE_ID = '0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba'

// Server-side read-only viem client (no wallet, no wagmi).
// Used only in detail endpoints to fetch on-chain share price.
const serverPublicClient = createPublicClient({
  chain: intuitionTestnet,
  transport: http(
    process.env.NEXT_PUBLIC_INTUITION_RPC_URL || 'https://testnet.rpc.intuition.systems/http'
  ),
})

// ─── Internal helpers ─────────────────────────────────────────────────────────

// One transport (lib/gql-pager.ts): throws on HTTP errors (the endpoint rate-limits with a bare
// HTTP 429 — no `errors`, no `data`), GraphQL errors and a body without data. It used to return
// `undefined` for a 429, which `data?.atoms || []` turned into "Agent not found" on REST/MCP.
function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return gqlRequest<T>(query, variables, { cache: 'no-store', url: GRAPHQL_URL })
}

/** Paged reads (REPO_MAP §7 rule 1) go through the same transport. */
const pagedRequest: GqlRequest = (query, variables) => gql(query, variables)

function parseBigInt(val?: string | null): bigint {
  try { return BigInt(val || '0') } catch { return 0n }
}

function weiToFloat(wei: bigint): number {
  return Math.round((Number(wei) / 1e18) * 1e6) / 1e6
}

function cleanLabel(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') return 'Unnamed'
  try {
    const parsed = JSON.parse(label)
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.name === 'string') {
      return parsed.name
    }
  } catch {
    // not JSON — fall through
  }
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
  label: string | null
  data?: string | null
  type: string
  emoji?: string
  created_at: string
  creator?: { label: string; id?: string } | null
  /** Atom-vault support stake + last signal time. No row count: it counts 0-share rows (stakers come from agentVaultReads). */
  positions_aggregate?: { aggregate: { sum: { shares: string | null } | null; max: { created_at: string | null } | null } | null }
  as_subject_triples?: Array<{ counter_term_id: string }> | null
  subjectTriplesCount?: Array<{ id: string }>
}

/** True when `data` holds JSON atom bytes (schema.org or legacy custom JSON). */
function looksLikeJsonAtomPayload(data: string | null | undefined): boolean {
  if (!data || typeof data !== 'string') return false
  const trimmed = data.trimStart()
  if (!trimmed.startsWith('{')) return false
  if (trimmed.includes('@context') || trimmed.includes('@type')) return true
  try {
    const parsed = JSON.parse(trimmed) as { name?: unknown }
    return typeof parsed === 'object' && parsed !== null && typeof parsed.name === 'string'
  } catch {
    return false
  }
}

/**
 * Get the effective label/JSON for an atom row.
 * Hasura returns label = "json object" when the payload is too long;
 * actual content is then in the `data` field. When label is a short
 * display name but data holds full JSON (schema.org Thing), prefer data.
 *
 * Exported so components can use the same logic without duplicating it.
 */
export function effectiveLabel(row: { label?: string | null; data?: string | null }): string {
  const d = row.data
  if (looksLikeJsonAtomPayload(d)) return d!
  const l = row.label
  if (!l || l === 'json object' || l === '[json object]') {
    return row.data || ''
  }
  return l
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export type AgentApiItem = {
  id: string
  name: string
  rawLabel?: string    // original atom label — may be JSON (Phase 2A+) or plain string (legacy)
  score: ScoreEnvelope
  /**
   * Whether `score` is a measurement. 'prior' = the atom holds no stake
   * (support + oppose shares = 0): trustScore is the engine's neutral 50 anchor
   * and objectScore/agentScore rest on it — not a measurement. The envelope is
   * unchanged for existing consumers; honest consumers render 'prior' as "—".
   * Same rule as the UI: lib/score-basis.ts.
   */
  scoreBasis: ScoreBasis
  /** @deprecated Use score.objectScore ?? score.trustScore instead. Removed in next major. */
  agentScore: number
  /**
   * The agent tier — from attestations only (thesis §6 "Agent tiers";
   * lib/agent-tier.ts calculateAgentTier). null = the attestation read failed:
   * unknown, never a substituted "unverified".
   */
  trustTier: AgentTier | null
  /** What `trustTier` is computed from — always 'attestations' (never backing). */
  tierBasis: AgentTierBasis
  momentum: number
  momentumDirection: string
  supportStake: number
  opposeStake: number
  stakerCount: number
  skillCount: number
  createdAt: string
}

/** The AgentRow selection — one list for the corpus read and the single-agent read. */
const AGENT_ROW_FIELDS = `
  term_id
  label
  data
  type
  emoji
  created_at
  creator { label id }
  positions_aggregate {
    aggregate {
      sum { shares }
      max { created_at }
    }
  }
  as_subject_triples(
    where: { predicate_id: { _eq: "${TRUST_PREDICATE_ID}" } }
    limit: 1
  ) { counter_term_id }
`

/**
 * One AgentScore agent by term_id (same filter as the corpus). null only when
 * it isn't an AgentScore agent; a failed read throws. The detail used to scan
 * the capped corpus, so an agent past the cap answered 404.
 */
async function fetchAgentRow(termId: string): Promise<AgentRow | null> {
  const data = await gql<{ atoms: AgentRow[] }>(`
    query ApiAgent($id: String!) {
      atoms(where: { _and: [${AGENT_WHERE_STR}, { term_id: { _eq: $id } }] }, limit: 1) { ${AGENT_ROW_FIELDS} }
    }
  `, { id: termId })
  return data.atoms?.[0] ?? null
}

/**
 * AgentScore corpus rows, paged past the endpoint's 250-row cap up to `limit`
 * (our cap), with the aggregate on the SAME filter for total/truncation.
 */
async function fetchAgentRows(limit: number): Promise<PagedRows<AgentRow>> {
  return fetchAllRows<AgentRow>({
    // created_at ties are common — term_id makes the order unique so offset pages can't overlap.
    query: `
    query ApiAgents($limit: Int!, $offset: Int!) {
      atoms(
        where: ${AGENT_WHERE_STR}
        limit: $limit
        offset: $offset
        order_by: [{ created_at: desc }, { term_id: asc }]
      ) { ${AGENT_ROW_FIELDS} }
    }
  `,
    field: 'atoms',
    countQuery: `query ApiAgentsCount { atoms_aggregate(where: ${AGENT_WHERE_STR}) { aggregate { count } } }`,
    countField: 'atoms_aggregate',
    pageSize: SERVER_ROW_CAP.atoms,
    maxRows: limit,
    request: pagedRequest,
  })
}

interface AgentVaultReads {
  /** Every position on the agents' atom vaults + trust counter-vaults (0-share rows included, raw). */
  positions: VaultPosition[]
  /** term_id → oppose shares (the trust counter-vault's sum). */
  opposeWeiOf(row: AgentRow): bigint
  /** term_id → stakers: distinct wallets with a live position on the atom or counter-vault. */
  stakersOf(row: AgentRow): number
}

/**
 * One paged read of every position on the agents' atom vaults and trust
 * counter-vaults: oppose shares, and stakers counted with the one live rule
 * (lib/live-position.ts). `positions_aggregate.count` counted 0-share rows —
 * On-Chain Data Analyzer and Agent Avatar Coder showed 1 staker holding 0 shares.
 */
async function agentVaultReads(rows: AgentRow[]): Promise<AgentVaultReads> {
  const counterOf = (row: AgentRow) => row.as_subject_triples?.[0]?.counter_term_id ?? null
  const vaultIds = rows.flatMap(r => [r.term_id, counterOf(r)]).filter((id): id is string => !!id)
  // Paged: one request used to return at most 100 positions across ALL counter-vaults.
  const positions = vaultIds.length ? await fetchVaultPositions(vaultIds, { request: pagedRequest }) : []
  const sums = sumSharesByVault(positions)
  return {
    positions,
    opposeWeiOf: (row) => { const c = counterOf(row); return c ? (sums.get(c) ?? 0n) : 0n },
    stakersOf: (row) => countLiveStakers(positions, { atomId: row.term_id, counterId: counterOf(row) }),
  }
}

/**
 * Cap on the AgentScore corpus fetch. One constant for every path (list, detail,
 * stats) so /api/v1/agents and /api/v1/stats count the same rows — they used
 * 200 and 500 and could disagree once the corpus grew.
 */
const AGENT_CORPUS_LIMIT = 500

/** Our ceiling on the domain-claim triples read (the pager reports it; live 2026-09-26: 75). */
const DOMAIN_TRIPLES_MAX = 5_000

interface AgentCorpus {
  /** Post-junk items, in GraphQL order (created_at desc). */
  kept: AgentApiItem[]
  junk: Array<{ item: AgentApiItem; reason: AgentJunkReason }>
  /** Raw rows keyed by term_id — for callers that need fields beyond AgentApiItem. */
  rowsById: Map<string, AgentRow>
  /** REPO_MAP §7 rule 1: capped fetch reports its own truncation (null = count unknown). */
  truncated: boolean | null
  /** Raw positions on every corpus agent's atom vault + trust counter-vault. */
  positions: VaultPosition[]
}

/**
 * The ONE AgentScore corpus read shared by /api/v1/agents, /api/v1/stats and
 * MCP platform_stats: fetch → oppose shares → rowToAgentItem → filterAgents.
 * Every path passes the RAW label to the junk filter (REPO_MAP §7 rule 4).
 */
async function loadAgentCorpus(): Promise<AgentCorpus> {
  const corpus = await fetchAgentRows(AGENT_CORPUS_LIMIT)
  const rows = corpus.rows
  const [vault, attestations] = await Promise.all([
    agentVaultReads(rows),
    // The tier's only input. A failed read leaves every tier unknown (null), never "unverified".
    fetchAttestationsForSubjects(rows.map(r => r.term_id)).catch(() => null),
  ])

  const allItems = rows.map(row =>
    rowToAgentItem(row, vault.opposeWeiOf(row), vault.stakersOf(row), attestations ? (attestations.get(row.term_id) ?? []) : null))

  // Test fixtures + duplicate re-registrations, counted and surfaced
  // (thesis §6 — never silently dropped). See agent-junk-filter.ts. Pass the
  // RAW label (rawLabel = effectiveLabel(row), not the cleaned display name)
  // — agent-junk-filter.ts owns all fold-matching normalization itself now,
  // so this path and agents/page.tsx's client-side fetch can't drift apart
  // on how a label is read.
  const candidates = allItems.map(a => ({
    termId: a.id,
    label: a.rawLabel ?? a.name,
    stakerCount: a.stakerCount,
    totalStake: a.supportStake,
    createdAt: a.createdAt,
    original: a,
  }))
  const { kept, junk } = filterAgents(candidates)

  // From the pager: read to the end → false; stopped at our cap → the aggregate decides
  // (null if it failed). "Fewer rows than the cap" is not proof — the endpoint caps at 250.
  const truncated = corpus.truncated

  return {
    kept,
    junk: junk.map(j => ({ item: j.item, reason: j.reason })),
    rowsById: new Map(rows.map(r => [r.term_id, r])),
    truncated,
    positions: vault.positions,
  }
}

/**
 * Builds an AgentApiItem for list contexts.
 * - qualityScore is always null here: signal history is not fetched in bulk.
 *   score.objectScore will be null; consumers fall back to trustScore for display.
 * - For detail contexts use getAgentTrustBreakdown(), which fetches signal
 *   history and calls calculateCompositeTrust() for the full 4-pillar composite.
 */
function rowToAgentItem(row: AgentRow, opposeWei: bigint, stakerCount: number, attested: AttestedEntry[] | null): AgentApiItem {
  const supportWei = parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)
  const totalWei = supportWei + opposeWei
  const supportRatio = totalWei > 0n ? Number((supportWei * 100n) / totalWei) : 50

  const trustResult = calculateTrustScoreFromStakes(supportWei, opposeWei)
  // Tier from attestations only — backing on the atom vault never changes it (thesis §6).
  const trustTier = attested ? calculateAgentTier(summarizeAttesters(attested)).tier : null

  // Compound key: termId + lastSignalAt — any new stake invalidates automatically.
  const lastSignalAt = row.positions_aggregate?.aggregate?.max?.created_at ?? ''
  const cachedQuality = qualityCacheGet(`${row.term_id}:${lastSignalAt}`)
  const score = computeScoreEnvelope({
    objectType: 'agent',
    trustScore: trustResult.score,
    qualityScore: cachedQuality,
    supportRatio: supportRatio / 100,
    softGateActive: false,
  })
  const agentScore = score.objectScore ?? score.trustScore

  const effLabel = effectiveLabel(row)
  return {
    id: row.term_id,
    name: cleanLabel(effLabel),
    rawLabel: effLabel,
    score,
    scoreBasis: scoreBasisOf({ supportWei, opposeWei }),
    agentScore,
    trustTier,
    tierBasis: AGENT_TIER_BASIS,
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
  /** Debug/audit escape hatch — includes filtered test fixtures/duplicates, each tagged `junkReason`. */
  includeJunk?: boolean
} = {}): Promise<{
  agents: Array<AgentApiItem & { junkReason?: AgentJunkReason }>
  total: number
  junkFiltered: number
  /** The corpus fetch hit its cap (REPO_MAP §7 rule 1); null = unknown. */
  truncated: boolean | null
}> {
  const { sort = 'score', limit = 20, offset = 0, minTrust = 0, includeJunk = false } = options

  const { kept, junk, truncated } = await loadAgentCorpus()
  const junkFiltered = junk.length

  let items: Array<AgentApiItem & { junkReason?: AgentJunkReason }> = includeJunk
    ? [...kept, ...junk.map(j => ({ ...j.item, junkReason: j.reason }))]
    : [...kept]

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
  return { agents: items.slice(offset, offset + limit), total, junkFiltered, truncated }
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
  const row = await fetchAgentRow(termId)
  if (!row) return null

  const [vault, attested] = await Promise.all([
    agentVaultReads([row]),
    fetchAttestations({ subjectId: termId }).catch(() => null), // the tier's only input
  ])
  const opposeWei = vault.opposeWeiOf(row)

  const base = rowToAgentItem(row, opposeWei, vault.stakersOf(row), attested)

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

  // When skills exist, overallScore replaces qualityScore in the envelope — but only when some
  // skill triple holds stake. At zero stake every skill scores the engine's 50 prior, and 40% of
  // a prior would be published as part of a 'measured' AGENTSCORE (lib/score-basis.ts).
  const skillsMeasured = skillBreakdownResult.skills.some(s => s.supportShares + s.opposeShares > 0n)
  const detailScore = skillBreakdownResult.hasSkills && skillsMeasured
    ? computeScoreEnvelope({
        objectType: 'agent',
        trustScore: base.score.trustScore,
        qualityScore: skillBreakdownResult.overallScore,
        supportRatio: supportRatio / 100,
        softGateActive: false,
      })
    : base.score
  const agentScore = detailScore.objectScore ?? detailScore.trustScore

  return {
    ...base,
    id: termId,
    score: detailScore,
    agentScore,
    skillCount: skillBreakdown.length,
    supportRatio,
    skillBreakdown,
    hasRadar: skillBreakdown.length >= 3,
  }
}

// ─── ERC-8004 cohort agent detail ─────────────────────────────────────────────

/**
 * Detail for an ERC-8004 cohort agent — an agent outside the scored AgentScore corpus
 * (e.g. Captain Dackie, the first attested one). REST /api/v1/agents/:id and MCP
 * get_agent_trust fall back to it when getAgentDetail finds nothing, so an attested
 * agent is never a 404.
 *
 * Only what is read is present (REPO_MAP §7 rule 5): identity, declarations and the
 * attestation tier. No score, stake or staker fields — the cohort's vault is not
 * scored; `scoreBasis: null` says "not a scored AgentScore agent" (same as the timeline).
 * A failed attestation read → tier and counts null (unknown), never "unverified" / 0.
 * null = not a cohort agent. A failed identity read throws (→ 500, never 404).
 */
export interface CohortAgentDetail {
  id: string
  name: string
  origin: 'erc8004'
  caipIdentity: string
  createdAt: string
  /** null = the classification read failed (unknown, not "declares nothing"). */
  declaredDomains: string[] | null
  declaredSkills: string[] | null
  trustTier: AgentTier | null
  tierBasis: AgentTierBasis
  scoreBasis: null
  /** Distinct live attesters across all domains (summarizeAttesters). null = unread. */
  attesters: number | null
  attestedDomains: Array<{ domain: string; attesters: number; tTrustAttested: number }> | null
  tTrustAttested: number | null
}

export async function getCohortAgentDetail(termId: string): Promise<CohortAgentDetail | null> {
  const cohort = await fetchCohortAgent(termId)
  if (!cohort) return null
  const attested = await fetchAttestations({ subjectId: termId }).catch(() => null)
  const summary = attested ? summarizeAttesters(attested) : null
  return {
    id: termId,
    name: cohort.label,
    origin: 'erc8004',
    caipIdentity: cohort.caipIdentity,
    createdAt: cohort.createdAt,
    declaredDomains: cohort.declaredDomains,
    declaredSkills: cohort.declaredSkills,
    trustTier: summary ? calculateAgentTier(summary).tier : null,
    tierBasis: AGENT_TIER_BASIS,
    scoreBasis: null,
    attesters: summary ? summary.length : null,
    attestedDomains: attested
      ? attested.map(e => ({ domain: e.domain.label, attesters: e.distinctAttesters, tTrustAttested: weiToFloat(e.totalStake) }))
      : null,
    tTrustAttested: attested ? weiToFloat(attested.reduce((sum, e) => sum + e.totalStake, 0n)) : null,
  }
}

// ─── Agent Trust Breakdown ────────────────────────────────────────────────────

export type AgentTrustBreakdown = {
  agentId: string
  agentName: string
  score: ScoreEnvelope
  /** @deprecated Use score.objectScore ?? score.trustScore instead. Removed in next major. */
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
  /**
   * The agent tier and what the next rung needs — attestations only (thesis §6).
   * current null = the attestation read failed (unknown). requirements are
   * `attesters` and `tTrustAttested` toward nextTier.
   */
  tier: {
    current: AgentTier | null
    basis: AgentTierBasis
    nextTier: AgentTier | null
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
        data
        created_at
        positions_aggregate {
          aggregate { sum { shares } }
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

  const ctid = row.as_subject_triples?.[0]?.counter_term_id

  const termIds = ctid ? [termId, ctid] : [termId]
  const [positionsData, sharePriceWei, attested] = await Promise.all([
    fetchVaultPositions(termIds, { order: 'shares-desc', withMeta: true, request: pagedRequest })
      .then(positions => ({ positions })),
    getOnChainSharePrice(serverPublicClient, termId as `0x${string}`).catch(() => null),
    fetchAttestations({ subjectId: termId }).catch(() => null), // the tier's only input
  ])

  // Oppose and stakers from the same positions read — stakers through the one live rule.
  const opposeWei = ctid ? (sumSharesByVault(positionsData.positions).get(ctid) ?? 0n) : 0n
  const supportWei = parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)
  const stakerCount = countLiveStakers(positionsData.positions, { atomId: termId, counterId: ctid })

  const totalWei = supportWei + opposeWei
  const supportRatio = totalWei > 0n ? Number((supportWei * 100n) / totalWei) : 50

  const trustResult = calculateTrustScoreFromStakes(supportWei, opposeWei)

  // Soft gate was removed; trustScore already encodes oppose > support.
  const scaleFactor = 1.0
  const softGateApplied = false

  // Whale detection — support vault only (oppose shares must not be compared
  // against the support vault's totalSupply)
  const positions = positionsData?.positions || []
  const supportPositions = positions.filter(p => !ctid || p.term_id !== ctid)
  const totalSupply = Number(supportWei) // support vault supply
  let largestShare = 0
  if (supportPositions.length > 0 && totalSupply > 0) {
    const largest = Math.max(...supportPositions.map(p => {
      try { return Number(BigInt(p.shares)) } catch { return 0 }
    }))
    largestShare = Math.round((largest / totalSupply) * 100) / 100
  }
  const whaleDetected = largestShare > 0.20

  // Diversity-weighted ratio (simplified: support ratio as proxy)
  const diversityWeightedRatio = Math.round(supportRatio * 10) / 10

  // ── Full 4-pillar composite (detail endpoint only) ────────────────────────
  // Map positions to signal history — include both support and oppose vaults
  // so calculateWeightedTrust / calculateStableDays receive a meaningful ratio.
  const signals = positions.map(p => ({
    timestamp: p.created_at,
    side: (ctid && p.term_id === ctid) ? 'oppose' as const : 'support' as const,
    amount: Math.abs(Number(p.shares)) / 1e18,
    shares: Math.abs(Number(p.shares)) / 1e18,
  }))
  const weightedTrust = calculateWeightedTrust(signals)
  const stableDays = calculateStableDays(signals)

  // Anti-sybil: count qualified stakers from the support vault only
  const MIN_STAKE = 0.1
  const walletNetStake = new Map<string, number>()
  for (const p of positions) {
    if (!p.account_id || (ctid && p.term_id === ctid)) continue
    walletNetStake.set(
      p.account_id,
      (walletNetStake.get(p.account_id) ?? 0) + Math.abs(Number(p.shares)) / 1e18
    )
  }
  const qualifiedStakers = [...walletNetStake.values()].filter(v => v >= MIN_STAKE).length

  // Price retention: on-chain price (with 15s cache) vs. ATH from signal history
  const currentPrice = sharePriceWei !== null ? Number(sharePriceWei) / 1e18 : 0.001
  const peakPrice = Math.max(
    currentPrice,
    findPeakPrice(signals.filter(s => s.side === 'support'), 0.001, 0.0001)
  )

  const compositeResult = calculateCompositeTrust({
    weightedSignalRatio: weightedTrust.weightedRatio,
    uniqueStakers: qualifiedStakers,
    stableDays,
    currentPrice,
    peakPrice,
    recentSells: [],
  })

  // Compound key matches rowToAgentItem read key — automatic invalidation on new stake.
  const lastSignalAt = positions.length > 0
    ? positions.reduce((max, p) => (p.created_at > max ? p.created_at : max), '')
    : ''
  qualityCacheSet(`${termId}:${lastSignalAt}`, compositeResult.score)

  const breakdownScore = computeScoreEnvelope({
    objectType: 'agent',
    trustScore: trustResult.score,
    qualityScore: compositeResult.score,
    supportRatio: supportRatio / 100,
    softGateActive: softGateApplied,
  })
  const agentScore = breakdownScore.objectScore ?? breakdownScore.trustScore

  // Tier: attestations only (thesis §6) — stakers, stake, ratio and age are not inputs.
  const agentTier = attested ? calculateAgentTier(summarizeAttesters(attested)) : null
  const next = agentTier?.next ?? null
  const tierRequirements: Record<string, string> = agentTier && next ? {
    attesters: `${agentTier.attesters}/${next.minAttesters}`,
    tTrustAttested: `${(Number(agentTier.attestedWei) / 1e18).toFixed(4)}/${Number(next.minAttestedWei) / 1e18} tTRUST`,
  } : {}

  return {
    agentId: termId,
    agentName: cleanLabel(effectiveLabel(row)),
    score: breakdownScore,
    agentScore,
    trustScore: {
      raw: Math.round(trustResult.baseScore * 10) / 10,
      confidence: Math.round(trustResult.confidence * 100) / 100,
      anchored: Math.round(trustResult.anchoredScore * 10) / 10,
      momentum: Math.round(trustResult.momentum * 10) / 10,
    },
    compositeScore: {
      total: Math.round(compositeResult.score),
      signalRatio: compositeResult.breakdown.signalScore,
      stakerDiversity: compositeResult.breakdown.stakerScore,
      stability: Math.round(compositeResult.breakdown.stabilityScore),
      priceRetention: compositeResult.breakdown.priceScore,
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
      current: agentTier?.tier ?? null,
      basis: AGENT_TIER_BASIS,
      nextTier: next?.tier ?? null,
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

// Faza 0.5a — skill-domain predicate, matched by TERM_ID (not label).
// "is skilled in" is the cross-network canonical skill predicate: SAME term_id
// on testnet (75 triples) AND mainnet (134 triples), so it works on the current
// testnet and survives the testnet→mainnet migration. Matching by term_id avoids
// the brittle label-string matching that previously missed mainnet entirely
// (the old hasAgentSkill labels have 0 triples on mainnet).
const IS_SKILLED_IN_PREDICATE_ID =
  '0xe332e7d663cda20970d2e9a9278b6a5be9575c0514379e8574aa61203c549103'
// Faza 0.5b (future, mainnet layer): also fold in "is best at"
// (0xe39dc1c656b35d408dd772007f77cffddfa4e720b3cff91ef3c82cdbd65c7447) — it is
// mainnet-only (0 testnet triples), so it is intentionally NOT added here yet.

async function fetchDomainTriplesInternal(): Promise<{
  triples: DomainTripleData[]
  /** Folded-away skillId → representative skillId (see refineSkillTriples). */
  foldedSkillIds: ReadonlyMap<string, string>
}> {
  // Step 1: all skill triples ("is skilled in" by term_id + legacy isTrustedFor), paged —
  // `limit: 500` got at most 250 back, silently (lib/gql-pager.ts).
  const where = `{ _or: [
    { predicate_id: { _eq: "${IS_SKILLED_IN_PREDICATE_ID}" } }
    { predicate: { label: { _eq: "isTrustedFor" } } }
  ] }`
  const page = await fetchAllRows<{
    term_id: string
    counter_term_id: string | null
    subject: { term_id: string; label: string }
    predicate: { label: string }
    object: { term_id: string; label: string }
  }>({
    query: `
      query GetAllDomainTriples($limit: Int!, $offset: Int!) {
        triples(where: ${where}, order_by: { term_id: asc }, limit: $limit, offset: $offset) {
          term_id
          counter_term_id
          subject { term_id label }
          predicate { label }
          object { term_id label }
        }
      }
    `,
    field: 'triples',
    countQuery: `query GetAllDomainTriplesCount { triples_aggregate(where: ${where}) { aggregate { count } } }`,
    countField: 'triples_aggregate',
    pageSize: SERVER_ROW_CAP.triples,
    maxRows: DOMAIN_TRIPLES_MAX,
    request: pagedRequest,
  })
  if (page.truncated !== false) throw new Error('domain triples not read to the end')
  const triples = page.rows
  if (triples.length === 0) return { triples: [], foldedSkillIds: new Map() }

  const vaultIds: string[] = []
  for (const t of triples) {
    vaultIds.push(t.term_id)
    if (t.counter_term_id) vaultIds.push(t.counter_term_id)
  }

  // Paged (one request stopped at 100 positions); stakers per vault through the one live rule.
  const vaultStats = vaultStakeStats(await fetchVaultPositions(vaultIds, { request: pagedRequest }))

  const raw = triples.map(t => {
    const forVault = vaultStats(t.term_id)
    const againstVault = vaultStats(t.counter_term_id)

    return {
      tripleId: t.term_id,
      agentId: t.subject?.term_id || '',
      agentName: t.subject?.label ? cleanLabel(t.subject.label) : 'Unknown',
      skillId: t.object?.term_id || '',
      skillName: t.object?.label ? cleanLabel(t.object.label) : 'Unknown',
      supportShares: forVault.totalShares,
      opposeShares: againstVault.totalShares,
      supportPositionCount: forVault.count,
      opposePositionCount: againstVault.count,
    }
  })

  // Faza 1 — shared quality/structure layer: junk-filter + case/duplicate-atom
  // folding. Applied at the fetch boundary so ALL consumers (skills, domains,
  // trust_query, platform stats, MCP) see identical refined data. The page's
  // own fetcher (src/app/domains/page.tsx) applies the same function.
  // TODO(dedup): fetchDomainTriples in page.tsx duplicates this whole fetcher —
  // fold both onto one shared implementation.
  const refined = refineSkillTriples(raw)
  return { triples: refined.triples, foldedSkillIds: refined.foldedSkillIds }
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
  const { triples: domainTriples } = await fetchDomainTriplesInternal()
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

  const { triples: domainTriples, foldedSkillIds } = await fetchDomainTriplesInternal()
  // Resolve folded duplicate atoms to their representative (merge, don't lose)
  const resolvedId = foldedSkillIds.get(skillTermId) ?? skillTermId
  const filtered = domainTriples.filter(t => t.skillId === resolvedId)
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
  const { triples: domainTriples } = await fetchDomainTriplesInternal()
  const domains = aggregateDomains(domainTriples)

  return domains.map(d => {
    // Faza 1 — canonical bucket grouping (additive fields; same mapping as /domains page)
    const mapping = mapSkillToBucket(d.name)
    return {
      id: d.id,
      name: d.name,
      agentCount: d.agentCount,
      totalStake: weiToFloat(d.totalShares),
      totalStakers: d.totalStakers,
      topAgent: d.topAgent,
      topAgentScore: d.topAgentScore,
      bucket: mapping.bucket,
      bucketStatus: mapping.status,
    }
  })
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

  const { triples: domainTriples, foldedSkillIds } = await fetchDomainTriplesInternal()
  // Resolve folded duplicate atoms to their representative (merge, don't lose):
  // a link to a folded-away term_id lands on the merged leaderboard.
  const resolvedId = foldedSkillIds.get(domainId) ?? domainId
  const domainTriple = domainTriples.find(t => t.skillId === resolvedId)

  if (!domainTriple) {
    return { domain: null, agents: [], total: 0 }
  }

  const filtered = domainTriples.filter(t => t.skillId === resolvedId)
  let agents = scoreDomainAgents(filtered)

  if (minTrust > 0) {
    agents = agents.filter(a => a.domainScore >= minTrust)
  }

  const total = agents.length
  const domainName = cleanDomainName(domainTriple.skillName)

  return {
    // id is the REPRESENTATIVE term_id (may differ from the queried, folded id)
    domain: { id: resolvedId, name: domainName },
    agents: agents.slice(0, limit).map(a => ({
      rank: a.rank,
      agentId: a.agentId,
      agentName: a.agentName,
      domainScore: a.domainScore,
      // Domain stake basis: 'prior' when the domain triple holds no stake.
      scoreBasis: scoreBasisOf({ supportWei: a.supportShares, opposeWei: a.opposeShares }),
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

  const cfg = getAttestationConfig()

  return profiles.slice(0, limit).map((p, i) => {
    const tierConfig = EVALUATOR_TIER_CONFIG[p.evaluatorTier]
    const isGated = p.rawEvaluatorWeight > 1.0 && !p.meetsAttestationThreshold
    return {
      rank: i + 1,
      address: p.address,
      tier: p.evaluatorTier,
      tierIcon: tierConfig.icon,
      accuracy: p.rawAccuracy,
      evaluatorWeight: p.evaluatorWeight,
      rawEvaluatorWeight: p.rawEvaluatorWeight,
      totalEvaluations: p.totalPositions,
      correctEvaluations: p.goodPicks,
      streakCount: p.streakCount,
      bestPick: p.bestPick,
      attestationCount: p.attestationCount,
      attestationThreshold: cfg.minAttestations,
      meetsAttestationThreshold: p.meetsAttestationThreshold,
      attestationGateActive: isGated,
      adjustedAccuracy: p.adjustedAccuracy,
      walletPNL: p.walletPNL,
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
  // Fetch leaderboard, individual positions, and attestation in parallel
  const [leaderboard, positions, attestation] = await Promise.all([
    fetchEvaluatorLeaderboard(),
    fetchStakerPositions(address),
    getAttestationCount(address, getAttestationConfig()),
  ])

  const leaderboardEntry = leaderboard.find(p => p.address.toLowerCase() === address.toLowerCase())

  // Must have at least one data source
  if (!leaderboardEntry && positions.length === 0) return null

  // Prefer leaderboard (has all data); fall back to computed from positions
  // Always re-apply attestation gate to ensure freshness
  const baseProfile = leaderboardEntry ?? calculateEvaluatorScore(address, positions)
  const profile = {
    ...baseProfile,
    meetsAttestationThreshold: attestation.meetsThreshold,
    attestationCount: attestation.attestationCount,
    // Re-apply gate in case leaderboard cached an outdated attestation state
    evaluatorWeight: baseProfile.rawEvaluatorWeight > 1.0 && !attestation.meetsThreshold
      ? 1.0
      : baseProfile.rawEvaluatorWeight,
  }
  const tierConfig = EVALUATOR_TIER_CONFIG[profile.evaluatorTier]

  const trackRecord = positions.filter(p => !p.isCreator).map(p => ({
    agentName: p.agentName,
    side: p.side,
    // null = the agent's oppose read failed: trust and verdict unknown, never judged on 0 oppose.
    currentTrust: p.currentTrustScore,
    correct: p.currentTrustScore == null ? null : (
      (p.side === 'support' && p.currentTrustScore > 50) ||
      (p.side === 'oppose' && p.currentTrustScore < 50)),
  }))

  const cfg = getAttestationConfig()
  const isGated = profile.rawEvaluatorWeight > 1.0 && !attestation.meetsThreshold

  return {
    address: profile.address,
    tier: profile.evaluatorTier,
    tierIcon: tierConfig.icon,
    accuracy: profile.rawAccuracy,
    adjustedAccuracy: profile.adjustedAccuracy,
    confidence: profile.confidence,
    evaluatorWeight: profile.evaluatorWeight,
    rawEvaluatorWeight: profile.rawEvaluatorWeight,
    totalEvaluations: profile.totalPositions,
    correctEvaluations: profile.goodPicks,
    streakCount: profile.streakCount,
    bestPick: profile.bestPick,
    worstPick: profile.worstPick,
    trackRecord,
    // Attestation Gate (Layer 7)
    attestationCount: attestation.attestationCount,
    attestationThreshold: cfg.minAttestations,
    meetsAttestationThreshold: attestation.meetsThreshold,
    attestationGateActive: isGated,
    attestationMessage: isGated
      ? `Evaluator weight capped at 1.0x — needs ${cfg.minAttestations} attestation(s) from distinct wallet(s) to unlock ${profile.rawEvaluatorWeight.toFixed(2)}x amplification`
      : attestation.meetsThreshold
        ? `Evaluator weight amplified — ${attestation.attestationCount} attestation(s) verified`
        : `Evaluator weight at ${profile.evaluatorWeight.toFixed(2)}x (no amplification needed)`,
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
    const { triples: domainTriples } = await fetchDomainTriplesInternal()

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
      score: computeScoreEnvelope({
        objectType: 'agent',
        trustScore: a.domainScore,
        qualityScore: null,
        softGateActive: false,
      }),
      scoreBasis: scoreBasisOf({ supportWei: a.supportShares, opposeWei: a.opposeShares }),
      agentId: a.agentId,
      agentName: a.agentName,
      domainScore: a.domainScore,
      agentScore: a.domainScore,
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
      score: a.score,
      scoreBasis: a.scoreBasis,
      agentId: a.id,
      agentName: a.name,
      agentScore: a.agentScore,
      stakerCount: a.stakerCount,
      domain: null,
      level: getHybridLevel(a.agentScore),
    }))

    return { query: params, results, total: filtered.length }
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getPlatformStats() {
  // The corpus is the one read the route can't answer without (agents, stake, stakers).
  // Every other count settles on its own: a failed read is null for that field, never 0,
  // and never takes the corpus numbers (the landing's tiles) down with it.
  const [corpus, skills, evaluators, domainTriples, attesters, claimCount] = await Promise.all([
    // Same post-junk corpus as /api/v1/agents — `agents` here must equal its meta.total.
    loadAgentCorpus(),
    // An aggregate, not rows: `atoms(limit: 500)` came back capped at 250 by the endpoint.
    gql<{ atoms_aggregate: { aggregate: { count: number } } }>(`
      query ApiSkillCount {
        atoms_aggregate(where: ${SKILL_WHERE_STR}) { aggregate { count } }
      }
    `).then(d => (typeof d?.atoms_aggregate?.aggregate?.count === 'number' ? d.atoms_aggregate.aggregate.count : null))
      .catch(() => null),
    fetchEvaluatorLeaderboard().then(profiles => profiles.length).catch(() => null),
    fetchDomainTriplesInternal().then(r => r.triples).catch(() => null),
    // Distinct wallets with a live position on any attestation triple (is skilled in → canonical
    // domain), deduped across agents and domains — commit 1's rule (summarizeAttesters). The
    // landing's "Attesters". null = the read failed, never 0.
    fetchAttestations().then(entries => summarizeAttesters(entries).length).catch(() => null),
    // Network-wide triple count. null = the read failed — never a 0 nobody counted.
    gql<{ triples_aggregate: { aggregate: { count: number } } }>(`
      { triples_aggregate { aggregate { count } } }
    `).then(d => (typeof d?.triples_aggregate?.aggregate?.count === 'number' ? d.triples_aggregate.aggregate.count : null))
      .catch(() => null),
  ])

  let totalStakedWei = 0n
  let topAgentScore = 0
  let topAgentName = ''

  for (const item of corpus.kept) {
    const row = corpus.rowsById.get(item.id)!
    totalStakedWei += parseBigInt(row.positions_aggregate?.aggregate?.sum?.shares)

    // List context: qualityScore=null (no signal history). Rank by trustScore.
    // topAgent.score in the response is therefore trustScore, not a hybrid —
    // and only a measured one: a zero-stake prior can't be "top agent".
    const score = item.score.trustScore
    if (item.scoreBasis === 'measured' && score > topAgentScore) {
      topAgentScore = score
      topAgentName = item.name
    }
  }

  const domains = domainTriples ? aggregateDomains(domainTriples) : null
  const topDomain = domains?.[0] ?? null

  // Distinct wallets holding a live position on any kept agent's atom vault or trust
  // counter-vault — the same live rule as every per-agent staker count (lib/live-position.ts),
  // from the corpus's own paged positions read. Was the evaluator list (a GraphQL shares>0
  // filter, silently capped at 100 rows), else a per-agent row-count sum.
  const keptVaults = corpus.kept.flatMap(item => {
    const row = corpus.rowsById.get(item.id)!
    return [row.term_id, row.as_subject_triples?.[0]?.counter_term_id]
  })
  const activeStakers = liveStakerWallets(corpus.positions, keptVaults).size

  return {
    // Post-junk corpus total — identical to /api/v1/agents meta.total (same loadAgentCorpus).
    agents: corpus.kept.length,
    agentsTruncated: corpus.truncated,
    // null = that read failed (REPO_MAP §7 rule 5).
    skills,
    domains: domains ? domains.length : null,
    claims: claimCount,
    attesters,
    evaluators,
    totalStaked: weiToFloat(totalStakedWei),
    activeStakers,
    topDomain: topDomain
      ? { name: topDomain.name, agentCount: topDomain.agentCount }
      : null,
    topAgent: topAgentName
      ? { name: topAgentName, trustScore: topAgentScore }
      : null,
  }
}
