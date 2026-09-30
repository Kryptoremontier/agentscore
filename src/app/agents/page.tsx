'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Layers, Globe, LayoutGrid, List, ExternalLink } from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther } from 'viem'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
// Categories unused — filter now uses trust levels directly
import { calculateTrustScoreFromStakes, type TrustScoreResult } from '@/lib/trust-score-engine'
import { calculateHybridScore } from '@/lib/hybrid-trust'
import { calculateDiversityWeightedRatio } from '@/lib/diversity-weight'
import { getCurrentPrice, calculateBuy, calculateSell, getSellProceeds, generateCurveData } from '@/lib/bonding-curve'
import { useBuyPreview, useSellPreview } from '@/hooks/useOnChainPricing'
import { calculateAgentTier } from '@/lib/agent-tier'
import { AgentTierChip } from '@/components/agents/AgentTierChip'
import type { AttestedEntry } from '@/lib/attestation-reader'
import { calculateWeightedTrust } from '@/lib/reputation-decay'
import {
  calculateCompositeTrust, calculateStableDays, findPeakPrice,
  getLoyaltyMultiplier,
  COMPOSITE_WEIGHTS, type CompositeResult,
} from '@/lib/composite-trust'
import { BONDING_CURVE_CONFIG } from '@/lib/bonding-curve'
import { TrustTierBadge } from '@/components/agents/TrustTierBadge'
import { EarlySupporterBadge } from '@/components/agents/EarlySupporterBadge'
import { parseAgentCard, calculateProfileCompleteness, AGENT_CATEGORIES } from '@/lib/agent-card'

import { APP_CONFIG } from '@/lib/app-config'
import { AGENT_WHERE_STR } from '@/lib/gql-filters'
import { calculateSkillBreakdown, type SkillBreakdownResult } from '@/lib/skill-trust'
import { effectiveLabel } from '@/lib/api-data'
import { SkillBreakdown } from '@/components/SkillBreakdown'
import { TrustSparkline } from '@/components/TrustSparkline'
import { AgentRadar } from '@/components/AgentRadar'
import { TrustTimeline, ScoreTrajectoryChart } from '@/components/agents/TrustTimeline'
import { buildAgentTimeline } from '@/lib/trust-timeline'
import { AttestStickyBar } from '@/components/attest/AttestStickyBar'
import { useNotice } from '@/components/shared/NoticeProvider'
import { useConnectModal } from '@/components/wallet/ConnectModal'
import { BackThisAgentSection } from '@/components/profile/BackThisAgentSection'
import { intuitionTestnet } from '@0xintuition/protocol'
import { txFailureNotice } from '@/lib/user-notice'
import { AttestedDomains } from '@/components/profile/AttestedDomains'
import { DeclaredDomains } from '@/components/profile/DeclaredDomains'
import { ReportsSection } from '@/components/profile/ReportsSection'
import { AttestersList } from '@/components/profile/AttestersAndBackers'
import { fetchAgentReports, summarizeAttesters, statRowView, backersFromPositions, type AgentProfileVector } from '@/lib/agent-profile'
import { ProfileStatRow } from '@/components/profile/ProfileStatRow'
import { AgentDetails } from '@/components/profile/AgentDetails'
import { LEGACY_CLAIMS_NOTE, BACKERS_HEADING, BACKERS_NOTE, BACKERS_EMPTY, PEOPLE_TAB, BACKING_LABEL, BACKING_LEVEL, BACKING_TREND } from '@/lib/people-copy'
import { ScoreParts } from '@/components/profile/ScoreParts'
import { BackingScore } from '@/components/agents/BackingScore'
import { fetchVaultBackers, sortPositions, sumSharesByVault, type VaultPositionWithMeta } from '@/lib/vault-positions'
import { startVisiblePoll } from '@/lib/visible-poll'
import { fetchUserVaultPosition, fetchWalletShares } from '@/lib/wallet-positions'
import { livePositions, liveStakerWallets, countLiveStakers } from '@/lib/live-position'
import { SORT_OPTIONS, parseSort, type AgentListSortBy } from '@/lib/agent-list-sort'
import {
  matchesAgentSearch, agentListHeaderSegments, LIVE_FEED_LABEL, agentResultsLine, type FeedStatus,
  cardAttestationView, attesterLineOf, tierChipOf, isCompactCard, attestScrollStep, orderAgents, listEntryOf, type CardAttestationView,
  listTrustTriple, listVaultSnapshot, listOpposeWei, withLiveVault,
  ORIGIN_TABS, QUALITY_LEVELS, corpusTotals, qualityOptions, qualityOptionText, parseListFilters, listFiltersSearch,
  type OriginFilter, type QualityFilter, type AgentScoreCorpusCounts, type CohortCorpusCounts,
} from '@/lib/agent-list'
import { CardAttesterLine } from '@/components/agents/CardAttesterLine'
import {
  agentsPageView, feedFreshnessLabel, modalFreshnessLabel, isLiveAfterOwnTx, FEED_UNREACHABLE, OWN_TX_LIVE_MS,
  MODAL_PARTS, MODAL_HEADER_PARTS, MODAL_REST_PARTS, type ModalPart,
  type AgentModalPayload, type AgentsPageView,
} from '@/lib/agents-page-types'
import { fetchAgentModalData, fetchAgentsPage } from '@/lib/agents-page-client'
import { readAgentSignals } from '@/lib/agent-signals'
import {
  readSharesWei, hasMeasuredScore, measuredScore, qualityBucket, supportPercent, noScoreTooltip,
} from '@/lib/score-basis'
import { formatTTrust, formatDate, formatDateShort } from '@/lib/format'
import { PersonName } from '@/components/shared/PersonName'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL
const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') console.log(...args)
}

/** Modal positions poll — catches other wallets' trades; paused while the tab is hidden. */
const MODAL_POLL_MS = 15_000

interface GraphQLAgent {
  term_id: string
  label: string
  data?: string | null
  type: string
  created_at: string
  emoji?: string
  creator?: { label: string; id?: string } | null
  positions_aggregate?: { aggregate: { sum: { shares: string } | null } }
  as_subject_triples?: Array<{ counter_term_id: string; term_id?: string }> | null
  /** Live stakers (lib/live-position.ts); undefined = never read (cohort), null = read failed. */
  liveStakerCount?: number | null
  /** The list's vault reads (lib/agent-list.ts) — the modal opens on them instead of re-reading. */
  __opposeWei?: bigint | null
  __vaultPositions?: VaultPositionWithMeta[] | null
  __vaultReadAt?: number
  /** Etap 2c: which corpus this atom came from. Absent = AgentScore (legacy fetch paths). */
  origin?: 'agentscore' | 'erc8004'
  /** ERC-8004 cohort only — declared OASF domains/skills (`has category`/`has tag`), self-declared not attested. */
  /** null = the cohort classification read failed for this agent (unknown, not none). */
  declaredDomains?: string[] | null
  declaredSkills?: string[] | null
  caipIdentity?: string
}

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <PageBackground image="wave" opacity={0.3}>
        <div className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-4">
              <div className="h-10 w-64 bg-white/10 rounded-lg" />
              <div className="h-12 bg-white/5 rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="glass-card h-48 bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageBackground>
    }>
      <AgentsPageContent />
    </Suspense>
  )
}

function getMomentumIndicator(momentum: number): { arrow: string; color: string; label: string } {
  if (momentum > 2)   return { arrow: '↑',  color: '#22c55e', label: 'Rising' }
  if (momentum > 0.5) return { arrow: '↗',  color: '#4ade80', label: 'Slightly rising' }
  if (momentum < -2)  return { arrow: '↓',  color: '#ef4444', label: 'Falling' }
  if (momentum < -0.5)return { arrow: '↘',  color: '#f87171', label: 'Slightly falling' }
  return               { arrow: '→',  color: '#94a3b8', label: 'Stable' }
}

/**
 * List view columns — the header and every row share them. Phones: icon, agent, score
 * (the name column gets the width; stake and stakers move under the name). From `sm`:
 * icon, agent, stakes, stakers, score.
 */
const LIST_ROW_GRID = 'grid grid-cols-[2rem_minmax(0,1fr)_3rem] sm:grid-cols-[2rem_minmax(0,1fr)_6rem_4rem_3.5rem] gap-x-3 sm:gap-x-4 px-3 sm:px-4'

/** The row's origin, the same chip on the grid card and the list row. */
function OriginChip({ origin }: { origin?: 'agentscore' | 'erc8004' }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded inline-block flex-shrink-0 ${
      origin === 'erc8004' ? 'text-[#8B5CF6] bg-[#8B5CF6]/10' : 'text-[#7A838D] bg-[#1e2028]'
    }`}>
      {origin === 'erc8004' ? 'ERC-8004' : 'via AgentScore'}
    </span>
  )
}

function AgentsPageContent() {
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { connector } = useAccount()

  const [agents, setAgents] = useState<GraphQLAgent[]>([])
  const [agentJunkFilteredCount, setAgentJunkFilteredCount] = useState(0)
  // Raw fetched rows / corpus size / truncation for the header (REPO_MAP §7 rule 1).
  const [agentCorpusMeta, setAgentCorpusMeta] = useState<{ fetched: number; total: number | null; truncated: boolean | null }>(
    { fetched: 0, total: null, truncated: null },
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  // Origin tab + quality filter live in the URL (?origin=erc8004&quality=unrated) so a filtered
  // view is shareable; unknown values fall back to 'all' (lib/agent-list.ts parseListFilters).
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(() => parseListFilters(searchParams).quality)
  // Sort in the URL too (?sort=vouched|newest|backing); missing = "Most vouched" (Etap 5b).
  const [sortBy, setSortBy] = useState<AgentListSortBy>(() => parseListFilters(searchParams).sort)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  // Etap 2c: ERC-8004 cohort agents, fetched once (not search/sort-param dependent server-side).
  const [cohortAgents, setCohortAgents] = useState<GraphQLAgent[]>([])
  const [cohortTotal, setCohortTotal] = useState<number | null>(null)
  const [cohortTruncated, setCohortTruncated] = useState<boolean | null>(null)
  const [cohortLoading, setCohortLoading] = useState(true)
  // 'error' ≠ empty: a failed cohort read must never look like "0 ERC-8004".
  const [cohortStatus, setCohortStatus] = useState<FeedStatus>('loading')
  // Attestations for every listed agent (both corpora) — one bulk read, 2 paged requests per
  // 200 ids (lib/attestation-reader.ts). undefined = not read yet, null = the read failed.
  const [attestedBySubject, setAttestedBySubject] = useState<Map<string, AttestedEntry[]> | null | undefined>(undefined)
  // The latest list read, for the modal to reuse at open without re-running on every list update.
  const attestedBySubjectRef = useRef(attestedBySubject)
  attestedBySubjectRef.current = attestedBySubject
  const [originFilter, setOriginFilter] = useState<OriginFilter>(() => parseListFilters(searchParams).origin)
  // The URL is the source of truth: an in-app link to /agents?origin=… updates the open page too.
  useEffect(() => {
    const f = parseListFilters(searchParams)
    setOriginFilter(f.origin)
    setQualityFilter(f.quality)
    setSortBy(f.sort)
  }, [searchParams])
  const [selectedAgent, setSelectedAgent] = useState<GraphQLAgent | null>(null)
  // The open modal's agent, for async results that must not land on another agent's modal.
  const selectedAgentIdRef = useRef<string | null>(null)
  selectedAgentIdRef.current = selectedAgent?.term_id ?? null
  const [activeTab, setActiveTab] = useState<'overview' | 'attestations' | 'activity' | 'timeline'>('timeline')
  // The modal's tab strip scrolls sideways on the narrowest phones: keep the active tab in view
  // (Timeline, the default, is the last one). Horizontal only — never scrolls the modal itself.
  const modalTabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = modalTabsRef.current
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return
    list.scrollLeft = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2
  }, [activeTab, selectedAgent?.term_id])
  const [trustAmount, setTrustAmount] = useState('0.05')
  const [untrustAmount, setUntrustAmount] = useState('0.05')
  const [claims, setClaims] = useState<any[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [agentSignals, setAgentSignals] = useState<any[]>([])
  const [agentSignalsCount, setAgentSignalsCount] = useState(0)
  const [signalsLoading, setSignalsLoading] = useState(false)
  const [voteStatus, setVoteStatus] = useState<Record<string, string>>({})
  const [showClaimSelect, setShowClaimSelect] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingVote, setPendingVote] = useState<{
    type: 'trust' | 'distrust' | 'redeem_trust' | 'redeem_distrust'
    agent: GraphQLAgent
    amount: string
    claim: string
    claimAtomId: string | null
    counterTermId?: string | null
    tripleTermId?: string | null
    knownShares?: string
  } | null>(null)
  const [userPosition, setUserPosition] = useState<{
    forShares: string | null
    againstShares: string | null
    rawPositions: any[]
    againstRawPositions: any[]
  }>({ forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] })
  const [agentTriple, setAgentTriple] = useState<{
    termId: string | null
    counterTermId: string | null
    loading: boolean
    /** The lookup failed — "no oppose vault" is unknown, not established. */
    failed?: boolean
  }>({ termId: null, counterTermId: null, loading: false })
  const [creatingTriple, setCreatingTriple] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Errors and warnings in the page's flows: in-app notices, never a native browser dialog (Etap 5a).
  const { notify } = useNotice()
  const { openConnectModal } = useConnectModal()
  const [agentTrust, setAgentTrust] = useState<TrustScoreResult | null>(null)
  const [signalSide, setSignalSide] = useState<'support' | 'oppose'>('support')
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy')
  const [voteAmount, setVoteAmount] = useState('0.05')
  const [redeemShares, setRedeemShares] = useState('0')
  const [tTrustBalance] = useState<string>('')
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportCategory, setReportCategory] = useState<'scam' | 'spam' | 'prompt_injection' | 'impersonation'>('scam')
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const isExecutingRef = useRef(false)
  const [allPositions, setAllPositions] = useState<any[]>([])
  const [combinedStakerCount, setCombinedStakerCount] = useState(0)
  const [positionsLoading, setPositionsLoading] = useState(false)
  // term_id whose positions were actually read. combinedStakerCount starts at 0 and
  // positionsLoading starts false, so without this the modal prints "Backers: 0"
  // before any fetch (and on a failed one).
  const [positionsLoadedFor, setPositionsLoadedFor] = useState<string | null>(null)
  // true = allPositions came from a direct indexer read (after the user's own trade), not a cache.
  const [positionsLive, setPositionsLive] = useState(false)
  const [supportSupply, setSupportSupply] = useState(0)
  const [opposeSupply, setOpposeSupply] = useState(0)
  const [onChainPrice, setOnChainPrice] = useState<number | null>(null)
  const [peakOnChainPrice, setPeakOnChainPrice] = useState<number | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [platformFee, setPlatformFee] = useState<{ fixedFee: bigint; bps: bigint } | null>(null)
  const [skillTriples, setSkillTriples] = useState<any[]>([])
  // Distinguishes "not fetched yet" from "fetched, zero attestations" — the
  // empty-state CTA must not flash while skill triples are still loading.
  const [skillTriplesLoaded, setSkillTriplesLoaded] = useState(false)
  // ETAP 3: canonical profile vector — attested domains (is skilled in + stake)
  // and reports (reported for + stake). The profile's headline data.
  const [profileVector, setProfileVector] = useState<AgentProfileVector>({ attested: [], reports: [] })
  const [profileLoaded, setProfileLoaded] = useState(false)
  // Etap 4b: "Back this agent" (Buy/Sell) is secondary to the attestation unit — collapsed by default.
  const [backAccordionOpen, setBackAccordionOpen] = useState(false)
  const openBackOnSelect = useRef(false)

  // On-chain buy/sell previews (replace fictional local bonding curve)
  const activeVaultId = selectedAgent?.term_id || undefined
  const buyPreviewOC = useBuyPreview(
    tradeAction === 'buy' ? activeVaultId : undefined,
    tradeAction === 'buy' ? (Number(voteAmount) || 0) : undefined,
  )
  const sellPreviewOC = useSellPreview(
    tradeAction === 'sell' ? activeVaultId : undefined,
    tradeAction === 'sell' ? (Number(redeemShares) || 0) : undefined,
  )

  // ── The modal beyond the list: one cached answer per agent (Etap 4c) ─────────
  // Vault, signals, skill triples, reports and staker weights from /api/v1/agents/page/:id — no
  // indexer request from the browser. First the header's parts on their own and the rest beside
  // them (Etap 5a: the header never waits on skill triples, ~5.5 s cold); then every 15 s while the
  // tab is visible, one request for every part (cached by then). A part not answered yet is absent;
  // null = nothing answered yet.
  const [modalData, setModalData] = useState<Partial<AgentModalPayload> | null>(null)
  useEffect(() => {
    setModalData(null)
    if (!selectedAgent) return
    const termId = selectedAgent.term_id
    let cancelled = false
    const merge = (parts: readonly ModalPart[]) => (d: Partial<AgentModalPayload> | null) => {
      if (cancelled) return
      // Unreachable: a part never answered is unknown ("failed" — never a spinner forever, never
      // zeros); a part answered before keeps its last answer.
      setModalData((prev) => d
        ? { ...(prev ?? {}), ...d }
        : { ...Object.fromEntries(parts.filter((p) => !prev?.[p]).map((p) => [p, { status: 'failed' as const }])), ...(prev ?? {}) })
    }
    fetchAgentModalData(termId, MODAL_HEADER_PARTS).then(merge(MODAL_HEADER_PARTS))
    fetchAgentModalData(termId, MODAL_REST_PARTS).then(merge(MODAL_REST_PARTS))
    const stop = startVisiblePoll({ intervalMs: MODAL_POLL_MS, firstDelayMs: MODAL_POLL_MS, tick: () => fetchAgentModalData(termId).then(merge(MODAL_PARTS)) })
    return () => { cancelled = true; stop() }
  }, [selectedAgent?.term_id])

  // Agents this user just transacted on: their modal reads go straight to the indexer for a
  // while (lib/agents-page-types.ts OWN_TX_LIVE_MS) — a user always sees the effect of their own
  // action at once, even while the cached answers are older than it.
  const [liveUntil, setLiveUntil] = useState<Record<string, number>>({})
  const liveAgent = !!selectedAgent && isLiveAfterOwnTx(liveUntil, selectedAgent.term_id)
  const markLiveAfterOwnTx = (termId: string) => setLiveUntil((prev) => ({ ...prev, [termId]: Date.now() + OWN_TX_LIVE_MS }))

  // Evaluator weight per staker wallet (the cached evaluator leaderboard's). Unread → none applied.
  const evaluatorWeights = useMemo(
    () => new Map(modalData?.stakerWeights?.status === 'ok' ? Object.entries(modalData.stakerWeights.value) : []),
    [modalData],
  )

  // Load platform fee config from FeeProxy contract (once per session)
  useEffect(() => {
    if (!publicClient) return
    import('@/lib/intuition').then(({ getFeeConfig }) => {
      getFeeConfig(publicClient).then(setPlatformFee).catch(() => {})
    })
  }, [publicClient])

  // Catch unhandled errors client-side and surface them visibly (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const onError = (e: ErrorEvent) => {
      setPageError(`${e.message}\n${e.filename}:${e.lineno}\n${e.error?.stack || ''}`)
    }
    const onUnhandled = (e: PromiseRejectionEvent) => {
      setPageError(`Unhandled rejection: ${e.reason?.message || e.reason}\n${e.reason?.stack || ''}`)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  // ── The list: one answer from our cache (Etap 4c) ─────────────────────────
  // The page used to read the indexer from the browser (32 requests for a cold list and three
  // modals) and went blank whenever that failed, while our server held a complete read. The list
  // now comes from /api/v1/agents/page (lib/agents-page-data.ts): every part served with its age,
  // the last complete read when the indexer is down, "failed" only when nothing can be shown.
  const [pageView, setPageView] = useState<AgentsPageView | null>(null)
  const loadPage = async (isCancelled: () => boolean = () => false) => {
    setLoading(true)
    setCohortLoading(true)
    setError(null)
    // null = our own API couldn't be reached: every part failed — the page says so.
    const payload = await fetchAgentsPage()
    if (isCancelled()) return
    const view = agentsPageView(payload)
    setPageView(view)
    if (view.agentScore.status === 'ok') {
      // Post-junk rows: the server applied agent-junk-filter.ts to the raw labels (one rule, §7 rule 4).
      const rows = view.agentScore.rows as GraphQLAgent[]
      for (const row of rows) row.origin = 'agentscore'
      setAgents(rows)
      setAgentJunkFilteredCount(view.agentScore.junk)
      setAgentCorpusMeta({ fetched: view.agentScore.fetched, total: view.agentScore.total, truncated: view.agentScore.truncated })
    } else {
      setAgents([])
      setError(FEED_UNREACHABLE)
    }
    if (view.cohort.status === 'ok') {
      setCohortAgents(view.cohort.agents.map((c): GraphQLAgent => ({
        term_id: c.termId,
        label: c.label,
        type: 'Thing',
        created_at: c.createdAt,
        origin: 'erc8004',
        declaredDomains: c.declaredDomains,
        declaredSkills: c.declaredSkills,
        caipIdentity: c.caipIdentity,
      })))
      setCohortTotal(view.cohort.total)
      setCohortTruncated(view.cohort.truncated)
      setCohortStatus('ok')
    } else {
      setCohortAgents([])
      setCohortStatus('error')
    }
    // A subject whose part failed is absent: its card makes no claim (cardViewFor → unread).
    setAttestedBySubject(view.attestations)
    setLoading(false)
    setCohortLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    loadPage(() => cancelled)
    return () => { cancelled = true }
  }, [])

  // Per agent: attesters, domains and the tier — the same derivation as the modal
  // (lib/agent-list.ts cardAttestationView), computed once per read, not per render.
  const attestationViewBySubject = useMemo(() => {
    if (!attestedBySubject) return attestedBySubject
    const out = new Map<string, CardAttestationView>()
    for (const [id, entries] of attestedBySubject) out.set(id, cardAttestationView(entries))
    return out
  }, [attestedBySubject])

  // A card's "Attest" CTA opens the modal scrolled to its ATTESTED section, once the
  // profile has loaded (the section's height depends on it).
  const [focusAttested, setFocusAttested] = useState(false)
  const attestedSectionRef = useRef<HTMLDivElement>(null)
  const openAgentAtAttested = (agent: GraphQLAgent) => {
    // A keyboard user can still reach cards under the open modal: never switch it silently.
    if (selectedAgent) return
    setFocusAttested(true)
    setSelectedAgent(agent)
  }

  // Auto-open agent modal when ?open=TERM_ID is in URL (checks both corpora)
  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && (agents.length > 0 || cohortAgents.length > 0) && !selectedAgent) {
      const match = agents.find(a => a.term_id === openId) ?? cohortAgents.find(a => a.term_id === openId)
      if (match) {
        // ?back=1 (the profile's "Back with tTRUST"): the Back section opens expanded.
        openBackOnSelect.current = searchParams.get('back') === '1'
        setSelectedAgent(match)
      }
    }
  }, [agents, cohortAgents, searchParams])

  // Search no longer re-queries the server: it filters both corpora client-side
  // (grid below), so the header's corpus totals can't move while typing.

  // Sync selectedAgent with latest agents data after refetch
  useEffect(() => {
    if (!selectedAgent) return
    const updated = agents.find(a => a.term_id === selectedAgent.term_id)
    if (!updated) return
    const oldShares = selectedAgent.positions_aggregate?.aggregate?.sum?.shares || '0'
    const newShares = updated.positions_aggregate?.aggregate?.sum?.shares || '0'
    if (oldShares !== newShares) {
      setSelectedAgent(updated)
    }
  }, [agents])

  // Signals (chart, Activity, Timeline) from the modal's cached answer. Right after the user's own
  // trade they come from the post-trade live read (executeVote) instead. Unread → "—", never 0.
  const [signalsUnread, setSignalsUnread] = useState(false)
  const applySignals = (read: { signals: any[]; totalCount: number } | null) => {
    setAgentSignals(read ? read.signals : [])
    setAgentSignalsCount(read ? read.totalCount : 0)
    setSignalsUnread(!read)
    setSignalsLoading(false)
  }
  useEffect(() => {
    if (!selectedAgent) return
    let cancelled = false
    if (liveAgent) {
      // The user's own trade on this agent: straight from the indexer.
      if (agentTriple.loading) return
      setSignalsLoading(true)
      readAgentSignals(selectedAgent.term_id, agentTriple.counterTermId)
        .then((read) => { if (!cancelled) applySignals(read) })
        .catch(() => { if (!cancelled) applySignals(null) })
      return () => { cancelled = true }
    }
    if (!modalData?.signals) {
      setSignalsLoading(true)
      setAgentSignals([])
      return
    }
    applySignals(modalData.signals.status === 'ok' ? modalData.signals.value : null)
  }, [selectedAgent?.term_id, modalData, liveAgent, agentTriple.loading, agentTriple.counterTermId])

  // The connected wallet's own shares on the atom vault (FOR) and trust counter-vault (AGAINST),
  // and its shares on one vault (the redeem amount); the modal's backers table. One module for
  // /agents, /skills and /claims (lib/wallet-positions.ts, lib/vault-positions.ts). null = the read
  // failed: callers keep what they had — a failure is not "no position".
  const fetchUserPosition = (termId: string, userAddress: string, counterTermId?: string | null) =>
    fetchUserVaultPosition(termId, counterTermId, userAddress).catch((e) => {
      console.error('fetchUserPosition error:', e)
      return null
    })

  const fetchVaultSharesForUser = (termId: string, userAddress: string): Promise<bigint> =>
    fetchWalletShares(termId, userAddress).catch((err) => {
      console.warn('fetchVaultSharesForUser failed:', err)
      return 0n
    })

  const fetchAllPositions = (termId: string, counterTermId?: string | null) =>
    fetchVaultBackers(termId, counterTermId).catch((e) => {
      console.error('fetchAllPositions error:', e)
      return null
    })

  // Fetch trust triple for selected agent (read-only, no wallet needed)
  // Lock body scroll when agent modal is open
  useEffect(() => {
    document.body.style.overflow = selectedAgent ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedAgent])

  useEffect(() => {
    if (!selectedAgent) {
      setAgentTriple({ termId: null, counterTermId: null, loading: false })
      return
    }
    // The list already read the trust triple with the row: no lookup (Etap 4b-cache).
    const known = listTrustTriple(selectedAgent)
    if (known) {
      setAgentTriple({ ...known, loading: false })
      return
    }
    // Otherwise (cohort rows) the modal's cached answer carries it (Etap 4c).
    if (!modalData?.vault) {
      setAgentTriple({ termId: null, counterTermId: null, loading: true })
      return
    }
    const vault = modalData.vault
    setAgentTriple(vault.status === 'ok'
      ? { termId: vault.value.trustTriple?.termId ?? null, counterTermId: vault.value.trustTriple?.counterTermId ?? null, loading: false }
      : { termId: null, counterTermId: null, loading: false, failed: true })
  }, [selectedAgent?.term_id, modalData])

  // Collapse "Back this agent" whenever a different agent's modal opens — unless it was opened
  // to back (?back=1), then expanded and scrolled to.
  useEffect(() => {
    const expand = openBackOnSelect.current
    openBackOnSelect.current = false
    setBackAccordionOpen(expand)
    if (!expand) return
    const t = setTimeout(() => document.querySelector('[data-testid="back-this-agent"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400)
    return () => clearTimeout(t)
  }, [selectedAgent?.term_id])

  // Skill triples (skill trust breakdown + empty-state CTA) from the modal's cached answer.
  // Unread → unknown: loaded stays false so the CTA stays hidden.
  useEffect(() => {
    const part = selectedAgent ? modalData?.skillTriples : undefined
    setSkillTriples(part?.status === 'ok' ? part.value : [])
    setSkillTriplesLoaded(part?.status === 'ok')
  }, [selectedAgent?.term_id, modalData])

  // PRIMARY: Derive userPosition from allPositions (same data that feeds Attestations — reliable)
  // This prevents race conditions with separate fetchUserPosition calls. Only when those positions
  // were read live (after the user's own trade): cached ones can predate it (Etap 4c) — then the
  // wallet's own live read below is the source.
  useEffect(() => {
    if (!address || allPositions.length === 0 || !positionsLive) return
    const qAddr = address.toLowerCase()
    const atomId = selectedAgent?.term_id?.toLowerCase()
    const ctrId = agentTriple.counterTermId?.toLowerCase()

    const forPos = allPositions.filter((p: any) =>
      p.account_id?.toLowerCase() === qAddr && p.term_id?.toLowerCase() === atomId
    )
    const agaPos = allPositions.filter((p: any) =>
      p.account_id?.toLowerCase() === qAddr && ctrId && p.term_id?.toLowerCase() === ctrId
    )

    const forRaw = forPos[0]?.shares
    const agaRaw = agaPos[0]?.shares
    let forBig = 0n, agaBig = 0n
    try { forBig = BigInt(forRaw ?? '0') } catch { /* ignore */ }
    try { agaBig = BigInt(agaRaw ?? '0') } catch { /* ignore */ }

    setUserPosition({
      forShares: (forRaw && forBig > 0n) ? forRaw : null,
      againstShares: (agaRaw && agaBig > 0n) ? agaRaw : null,
      rawPositions: forPos,
      againstRawPositions: agaPos,
    })
  }, [allPositions, address, selectedAgent?.term_id, agentTriple.counterTermId, positionsLive])

  // FALLBACK: Also fetch directly when agent/address changes (covers fresh connect or post-tx)
  useEffect(() => {
    if (!selectedAgent || !address) return
    fetchUserPosition(selectedAgent.term_id, address, agentTriple.counterTermId).then(pos => {
      if (pos && (pos.forShares || pos.againstShares)) setUserPosition(pos)
    })
  }, [selectedAgent?.term_id, address, agentTriple.counterTermId])

  // Reusable: fetch positions + recompute supply in one shot
  const refreshPositionsAndSupply = async (
    termId: string,
    counterTermId?: string | null,
    showLoading = false,
    /** Positions the list already read for this agent: used instead of re-reading them. */
    seed?: VaultPositionWithMeta[] | null,
  ) => {
    if (showLoading) setPositionsLoading(true)
    try {
      // Fetch positions for the leaderboard table (runs in parallel with supply read)
      const positionsPromise = seed
        ? Promise.resolve({
            positions: livePositions(sortPositions(seed, 'shares-desc')),
            uniqueCount: countLiveStakers(seed, { atomId: termId, counterId: counterTermId }),
          })
        : fetchAllPositions(termId, counterTermId)

      // PRIMARY: Read supply directly from contract — always up-to-date,
      // bypasses indexer lag that causes stale price/value after other wallets trade.
      if (publicClient) {
        try {
          const { getVaultSupply } = await import('@/lib/intuition')
          const { getSharePriceFloat } = await import('@/lib/on-chain-pricing')
          const hex = termId.startsWith('0x') ? termId as `0x${string}` : `0x${termId}` as `0x${string}`
          const [supShares, oppShares, sharePrice] = await Promise.all([
            getVaultSupply(publicClient, termId),
            counterTermId ? getVaultSupply(publicClient, counterTermId) : Promise.resolve(0),
            getSharePriceFloat(publicClient, hex).catch(() => null),
          ])
          setSupportSupply(supShares)
          setOpposeSupply(oppShares)
          if (sharePrice !== null) {
            setOnChainPrice(sharePrice)
            setPeakOnChainPrice(prev => prev !== null ? Math.max(prev, sharePrice) : sharePrice)
          }
        } catch (e) {
          console.warn('[supply] Contract read failed, falling back to indexer sum:', e)
          // Fallback computed below after positions resolve
        }
      }

      // Resolve positions for the leaderboard table
      const read = await positionsPromise
      if (!read) return
      const { positions, uniqueCount } = read
      setAllPositions(positions)
      setCombinedStakerCount(uniqueCount)
      setPositionsLoadedFor(termId)
      setPositionsLive(!seed)
      // A live read (the user's own trade): the agent's list row follows it at once, so the card
      // and the modal show the trade even while the cached list is older (Etap 4c).
      if (!seed) setAgents((prev) => prev.map((row) => (row.term_id === termId ? withLiveVault(row, positions, Date.now()) : row)))

      // FALLBACK: compute supply from indexed positions when publicClient is unavailable
      if (!publicClient) {
        let supShares = 0
        let oppShares = 0
        for (const pos of positions) {
          const shares = Number(pos.shares || '0') / 1e18
          if (counterTermId && pos.term_id === counterTermId) {
            oppShares += shares
          } else {
            supShares += shares
          }
        }
        setSupportSupply(supShares)
        setOpposeSupply(oppShares)
      }
    } finally {
      if (showLoading) setPositionsLoading(false)
    }
  }

  // Positions (backers table, Backers line) + on-chain supply. Visitors: the positions the list read,
  // then each refresh of the modal's cached answer (polled every 15 s above) — no indexer request
  // from the browser. After the user's own trade on this agent: read live, polled every 15 s.
  const modalVaultPositions = modalData?.vault?.status === 'ok' ? modalData.vault.value.positions : undefined
  useEffect(() => {
    if (!selectedAgent) {
      setAllPositions([])
      setCombinedStakerCount(0)
      setPositionsLoadedFor(null)
      setPositionsLive(false)
      setSupportSupply(0)
      setOpposeSupply(0)
      setOnChainPrice(null)
      setPeakOnChainPrice(null)
      return
    }

    // The counter-vault must be known first: reading without it and again with it cost two reads.
    if (agentTriple.loading) return

    if (liveAgent) {
      refreshPositionsAndSupply(selectedAgent.term_id, agentTriple.counterTermId, positionsLoadedFor !== selectedAgent.term_id)
      // Only while the tab is visible; back in view it refreshes at once.
      return startVisiblePoll({
        intervalMs: MODAL_POLL_MS,
        firstDelayMs: MODAL_POLL_MS,
        tick: () => refreshPositionsAndSupply(selectedAgent.term_id, agentTriple.counterTermId, false),
      })
    }

    // The newest positions we hold: the modal's answer, else the list's snapshot. Neither yet →
    // the modal's answer is on its way (or failed: backers unknown, "—").
    const seed = modalVaultPositions ?? listVaultSnapshot(selectedAgent)?.positions
    if (!seed) return
    refreshPositionsAndSupply(selectedAgent.term_id, agentTriple.counterTermId, positionsLoadedFor !== selectedAgent.term_id, seed)
  }, [selectedAgent?.term_id, agentTriple.counterTermId, agentTriple.loading, modalVaultPositions, liveAgent])

  // Compute trust score from real on-chain data whenever agent or triple changes.
  // null (rendered "—") while loading, when the atom vault was never read (cohort
  // rows), and when a read failed — never a fallback computed from a missing side.
  useEffect(() => {
    let cancelled = false
    setAgentTrust(null)
    if (!selectedAgent || agentTriple.loading || agentTriple.failed) return

    const supportWei = readSharesWei(selectedAgent.positions_aggregate)
    if (supportWei == null) return

    if (!agentTriple.counterTermId) {
      // Lookup succeeded and there is no trust triple → no oppose vault → oppose is 0.
      setAgentTrust(calculateTrustScoreFromStakes(supportWei, 0n))
      return
    }

    // The list read the counter-vault with the row: its oppose sum, no request.
    const listed = listOpposeWei(selectedAgent)
    if (listed !== undefined) {
      setAgentTrust(calculateTrustScoreFromStakes(supportWei, listed))
      return
    }

    // Otherwise the modal's cached answer read the vaults (Etap 4c). Unread → the score stays
    // unmeasured ("—"): a failed oppose read is not "0 oppose".
    if (modalData?.vault?.status === 'ok') {
      const opposeWei = sumSharesByVault(modalData.vault.value.positions).get(agentTriple.counterTermId) ?? 0n
      setAgentTrust(calculateTrustScoreFromStakes(supportWei, opposeWei))
    }
    return () => { cancelled = true }
  }, [selectedAgent?.term_id, selectedAgent?.positions_aggregate?.aggregate?.sum?.shares, agentTriple.counterTermId, agentTriple.loading, agentTriple.failed, modalData])

  // Reset redeem input when switching signal side to avoid stale values
  useEffect(() => {
    setRedeemShares('0')
  }, [signalSide])

  const executeVote = async () => {
    debugLog('executeVote called with type:', pendingVote?.type)
    debugLog('walletClient:', !!walletClient, 'publicClient:', !!publicClient)

    if (isExecutingRef.current) {
      debugLog('Already executing, skipping')
      return
    }

    if (!pendingVote || !publicClient) {
      console.error('Missing deps - pendingVote:', !!pendingVote, 'public:', !!publicClient)
      return
    }

    isExecutingRef.current = true
    setShowConfirm(false)
    const key = pendingVote.agent.term_id
    setVoteStatus(prev => ({ ...prev, [key]: 'pending' }))

    let intuitionLib: any
    try {
      intuitionLib = await import('@/lib/intuition')
      debugLog('✅ import succeeded, keys:', Object.keys(intuitionLib))
    } catch (importErr: any) {
      console.error('❌ import failed:', importErr?.message)
      notify({ kind: 'error', text: `Couldn’t load the transaction code (${importErr?.message ?? 'unknown error'}). Reload the page and try again.` })
      isExecutingRef.current = false
      return
    }

    const { createWriteConfig, depositToVault, redeemFromVault } = intuitionLib

    try {
      // Get walletClient fresh at call time — useWalletClient hook can be null
      // even when wallet is connected (hydration timing issue in Next.js App Router)
      const { getWalletClient } = await import('@wagmi/core')
      const { config: wagmiConfig } = await import('@/lib/wagmi')
      const freshWalletClient = walletClient ?? await getWalletClient(wagmiConfig)
      debugLog('walletClient fresh:', !!freshWalletClient)

      if (!freshWalletClient) {
        throw new Error('Wallet client unavailable — please reconnect your wallet')
      }

      const cfg = createWriteConfig(freshWalletClient, publicClient)
      debugLog('✅ cfg created:', cfg)

      const agent = pendingVote.agent

      if (pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust') {
        debugLog('=== REDEEM CASE ENTERED ===')
        debugLog('type:', pendingVote.type, 'agent term_id:', agent.term_id, 'address:', address)

        let freshSharesRaw: string
        let redeemVaultId: `0x${string}`

        if (pendingVote.type === 'redeem_trust') {
          redeemVaultId = agent.term_id as `0x${string}`
          freshSharesRaw = pendingVote.knownShares ?? '0'
          if (!freshSharesRaw || freshSharesRaw === '0') {
            freshSharesRaw = (await fetchVaultSharesForUser(agent.term_id, address!)).toString()
          }
        } else {
          const counterTermId = pendingVote.counterTermId
          if (!counterTermId) {
            notify({ kind: 'error', text: 'Oppose vault not set up — please activate it first via the Oppose tab.' })
            return
          }
          redeemVaultId = counterTermId as `0x${string}`
          freshSharesRaw = pendingVote.knownShares ?? '0'
          if (!freshSharesRaw || freshSharesRaw === '0') {
            freshSharesRaw = (await fetchVaultSharesForUser(counterTermId, address!)).toString()
          }
        }

        const freshShares = BigInt(freshSharesRaw)
        debugLog('redeemVaultId:', redeemVaultId, 'freshSharesRaw:', freshSharesRaw, '→ BigInt:', freshShares.toString())

        if (freshShares === 0n) {
          notify({ kind: 'info', text: pendingVote.type === 'redeem_trust'
            ? 'No FOR shares to redeem — position may already be empty.'
            : 'No AGAINST shares to redeem — you have not staked in the Oppose vault.' })
          return
        }

        // Honor the user's slider/input amount — convert decimal string → BigInt (18 decimals)
        // Cap at actual on-chain balance to avoid over-redeem errors
        let requestedShares = 0n
        try { requestedShares = parseEther(pendingVote.amount) } catch { requestedShares = 0n }
        const sharesToRedeem = (requestedShares > 0n && requestedShares <= freshShares)
          ? requestedShares
          : freshShares

        const tx = await redeemFromVault(
          cfg,
          redeemVaultId,
          sharesToRedeem,
          address as `0x${string}`
        )
        debugLog('✅ Redeem TX:', tx)

        const updated = await fetchUserPosition(agent.term_id, address!, pendingVote.counterTermId)
        if (updated) setUserPosition(updated)

        setToast(`Redeemed ${(Number(sharesToRedeem) / 1e18).toFixed(4)} shares!`)
        setTimeout(() => setToast(null), 4000)

      } else if (pendingVote.type === 'trust') {
        // Support → deposit into agent's atom vault (FOR)
        await depositToVault(cfg, agent.term_id as `0x${string}`, parseEther(pendingVote.amount))
      } else if (pendingVote.type === 'distrust') {
        // Oppose → deposit into triple's AGAINST vault (counter_term_id)
        // counterTermId and tripleTermId were captured at click time — agentTriple may be null now
        const { counterTermId, tripleTermId } = pendingVote
        if (!counterTermId) {
          notify({ kind: 'error', text: 'Oppose vault not set up — please activate it first via the Oppose tab.' })
          return
        }
        if (!tripleTermId) {
          notify({ kind: 'error', text: 'Oppose vault is not fully initialized. Please reopen the agent modal and try again.' })
          return
        }
        debugLog('distrust counterTermId:', counterTermId)
        debugLog('distrust tripleTermId:', tripleTermId)

        // MultiVault enforces: user CANNOT hold shares in both FOR and AGAINST
        // vaults of the same triple simultaneously (HasCounterStake error).
        // Triple creation deposits into FOR on behalf of the creator, so we
        // must redeem any existing FOR shares before depositing into AGAINST.
        // MultiVault_HasCounterStake: must clear ALL support positions before depositing Oppose
        // Support shares live in the ATOM vault (agent.term_id), not in tripleTermId
        const existingAtomShares = address
          ? await fetchVaultSharesForUser(agent.term_id, address)
          : 0n

        if (existingAtomShares > 0n) {
          debugLog(`[Oppose] Clearing ${existingAtomShares} support shares from atom vault before Oppose deposit...`)
          try {
            await redeemFromVault(
              cfg,
              agent.term_id as `0x${string}`,
              existingAtomShares,
              address as `0x${string}`
            )
            debugLog('✅ Atom vault cleared — proceeding to Oppose deposit')
          } catch (redeemErr: any) {
            console.error('❌ Failed to clear atom vault:', redeemErr)
            throw new Error(
              `MultiVault requires clearing all Support shares before Opposing. Sell failed: ${redeemErr?.message || 'unknown'}`
            )
          }
        }

        // Also clear triple FOR vault if it has shares (safety check)
        if (tripleTermId) {
          const existingTripleShares = address
            ? await fetchVaultSharesForUser(tripleTermId, address)
            : 0n
          if (existingTripleShares > 0n) {
            debugLog(`[Oppose] Clearing ${existingTripleShares} shares from triple FOR vault...`)
            try {
              await redeemFromVault(cfg, tripleTermId as `0x${string}`, existingTripleShares, address as `0x${string}`)
              debugLog('✅ Triple FOR vault cleared')
            } catch (redeemErr: any) {
              console.error('❌ Failed to clear triple FOR vault:', redeemErr)
              throw new Error(`Failed to clear triple FOR shares: ${redeemErr?.message || 'unknown'}`)
            }
          }
        }

        // Deposit into AGAINST vault
        await depositToVault(cfg, counterTermId as `0x${string}`, parseEther(pendingVote.amount))
      }

      setVoteStatus(prev => { const n = { ...prev }; delete n[agent.term_id]; return n })

      // The user's own action: this agent's reads go straight to the indexer for a while
      // (OWN_TX_LIVE_MS) — the cached answers can be older than the trade.
      markLiveAfterOwnTx(agent.term_id)

      // Refetch after 2s (indexer lag) + again at 5s (backup) — live, this agent only: its
      // positions (the card's row follows them, refreshPositionsAndSupply), its signals and the
      // wallet's own position. The rest of the list stays on the cached answer.
      const refetchAll = () => {
        readAgentSignals(agent.term_id, pendingVote.counterTermId)
          .then((read) => { if (selectedAgentIdRef.current === agent.term_id) applySignals(read) })
          .catch(() => { /* keep what the modal shows */ })
        if (address) {
          fetchUserPosition(agent.term_id, address, pendingVote.counterTermId).then(pos => { if (pos) setUserPosition(pos) })
        }
        refreshPositionsAndSupply(agent.term_id, pendingVote.counterTermId)
      }
      setTimeout(refetchAll, 2000)
      setTimeout(refetchAll, 5000)

    } catch (e: any) {
      console.error('❌ executeVote error:', e?.message, e)
      setVoteStatus(prev => { const n = { ...prev }; delete n[pendingVote.agent.term_id]; return n })
      notify(txFailureNotice('Transaction', e))
    } finally {
      isExecutingRef.current = false
      setPendingVote(null)
    }
  }

  // Create the trust triple for the selected agent (1 MetaMask confirmation)
  const handleCreateTrustTriple = async () => {
    if (!selectedAgent || creatingTriple) return
    setCreatingTriple(true)
    try {
      const { getWalletClient } = await import('@wagmi/core')
      const { config: wagmiConfig } = await import('@/lib/wagmi')
      const freshWalletClient = walletClient ?? await getWalletClient(wagmiConfig)
      if (!freshWalletClient || !publicClient) throw new Error('Wallet not connected')

      const { createWriteConfig, createTrustTriple } = await import('@/lib/intuition')
      const cfg = createWriteConfig(freshWalletClient, publicClient)

      const triple = await createTrustTriple(selectedAgent.term_id as `0x${string}`, cfg)
      setAgentTriple({ termId: triple.termId, counterTermId: triple.counterTermId, loading: false })
      setToast('Oppose vault created! You can now stake AGAINST this agent.')
      setTimeout(() => setToast(null), 5000)
    } catch (e: any) {
      console.error('handleCreateTrustTriple error:', e)
      notify(txFailureNotice('Creating the Oppose vault', e))
    } finally {
      setCreatingTriple(false)
    }
  }

  // Helper: get color based on trust state (3 levels)
  const getTrustStateColor = (shares: string | null | undefined): string => {
    const score = Math.round(Number(shares || 0) / 1e15)
    if (score >= 40) return '#2d7a5f'   // muted green  - trusted
    if (score >= 10) return '#c47c2a'   // muted orange - neutral
    return '#8b3a3a'                    // muted red    - untrusted
  }

  // Fetch real claims from Intuition GraphQL
  const fetchClaims = async (type: 'trust' | 'distrust') => {
    setClaimsLoading(true)
    try {
      const keywords = type === 'trust'
        ? ['trustworthy', 'verified', 'high quality', 'innovative', 'reliable']
        : ['scammer', 'spam', 'injection', 'low quality', 'malicious']

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetClaimAtoms {
              atoms(
                where: { label: { _in: [${keywords.map(k => `"${k}"`).join(', ')}] } }
                limit: 20
              ) {
                term_id
                label
                type
                creator { label }
                positions_aggregate {
                  aggregate { count }
                }
              }
            }
          `
        })
      })
      const data = await response.json()
      const fetchedClaims = data.data?.atoms || []

      // Fall back to defaults if no claims on graph yet
      if (fetchedClaims.length === 0) {
        const defaults = type === 'trust'
          ? [
              { term_id: null, label: 'trustworthy', type: 'local' },
              { term_id: null, label: 'verified developer', type: 'local' },
              { term_id: null, label: 'high quality', type: 'local' },
              { term_id: null, label: 'innovative', type: 'local' },
            ]
          : [
              { term_id: null, label: 'scammer', type: 'local' },
              { term_id: null, label: 'spam', type: 'local' },
              { term_id: null, label: 'injection', type: 'local' },
              { term_id: null, label: 'low quality', type: 'local' },
            ]
        setClaims(defaults)
      } else {
        setClaims(fetchedClaims)
      }
    } catch (e) {
      console.error('Failed to fetch claims:', e)
      setClaims([])
    } finally {
      setClaimsLoading(false)
    }
  }

  // ETAP 3: canonical profile vector (attested domains + reports) in one read.
  // reportCount (stats grid) is derived from the same data — the former
  // reports-only query is folded in here.
  const [reportCount, setReportCount] = useState(0)
  const reportCountFor = useRef<string | null>(null)
  useEffect(() => {
    setProfileLoaded(false)
    if (!selectedAgent) {
      setProfileVector({ attested: [], reports: [] })
      setReportCount(0)
      return
    }
    // Attestations: the same data the list already has (its card's attester line and tier chip);
    // a subject whose part failed is absent → unknown (null), never "no attestations". Reports:
    // the modal's cached answer (Etap 4c) — or, after the user's own report, read live.
    const listed = attestedBySubjectRef.current
    const attested = listed instanceof Map ? (listed.get(selectedAgent.term_id) ?? null) : null
    const apply = (reports: AgentProfileVector['reports']) => {
      setProfileVector({ attested, reports })
      // Reports never disappear: never below what this modal already showed for this agent (the
      // user's own report counts at once, before any read catches up with it).
      const n = reports?.length ?? 0 // null reports render "—" below, never this 0
      setReportCount((prev) => (reportCountFor.current === selectedAgent.term_id ? Math.max(prev, n) : n))
      reportCountFor.current = selectedAgent.term_id
      setProfileLoaded(true)
    }
    if (liveAgent) {
      let cancelled = false
      fetchAgentReports(selectedAgent.term_id).catch(() => null).then((r) => { if (!cancelled) apply(r) })
      return () => { cancelled = true }
    }
    if (!modalData?.reports) return
    apply(modalData.reports.status === 'ok' ? modalData.reports.value : null)
  }, [selectedAgent?.term_id, modalData, liveAgent])

  // The modal's read is the newest read of the same rows the card counted: when it differs
  // (an attestation landed since the list read), the card follows it, so list and modal agree.
  useEffect(() => {
    if (!selectedAgent || !profileLoaded || profileVector.attested == null) return
    const id = selectedAgent.term_id
    const fresh = profileVector.attested
    const next = cardAttestationView(fresh)
    setAttestedBySubject(prev => {
      const old = prev?.get(id)
      if (!prev || !old) return prev
      const cur = cardAttestationView(old)
      const same = cur.attesters === next.attesters && cur.domains === next.domains
        && cur.tier.tier === next.tier.tier && cur.tier.attestedWei === next.tier.attestedWei
      return same ? prev : new Map(prev).set(id, fresh)
    })
  }, [selectedAgent, profileLoaded, profileVector.attested])

  // Card "Attest" CTA: scroll the modal to ATTESTED once the profile is in (its height
  // settles then). Cards are only clickable with the modal closed, when profileLoaded is false.
  useEffect(() => {
    if (!selectedAgent) { setFocusAttested(false); return }
    if (attestScrollStep({ modalOpen: true, requested: focusAttested, profileLoaded }) !== 'scroll') return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      const section = attestedSectionRef.current
      section?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      // Focus follows: a keyboard user lands on the section the CTA promised, not behind the modal.
      section?.focus({ preventScroll: true })
      setFocusAttested(false)
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [selectedAgent, focusAttested, profileLoaded])

  // Submit a report on-chain
  const handleSubmitReport = async () => {
    if (!selectedAgent || reportSubmitting) return
    setReportSubmitting(true)
    try {
      const { getWalletClient } = await import('@wagmi/core')
      const { config: wagmiConfig } = await import('@/lib/wagmi')
      const freshWalletClient = walletClient ?? await getWalletClient(wagmiConfig)
      if (!freshWalletClient || !publicClient) throw new Error('Wallet not connected')

      const { createWriteConfig, submitReport } = await import('@/lib/intuition')
      const cfg = createWriteConfig(freshWalletClient, publicClient)

      await submitReport(
        selectedAgent.term_id as `0x${string}`,
        reportCategory,
        reportReason,
        cfg
      )

      setShowReportModal(false)
      setReportReason('')
      setReportCount(prev => prev + 1)
      // The user's own action: this agent's reports are read live from now on (OWN_TX_LIVE_MS).
      markLiveAfterOwnTx(selectedAgent.term_id)
      setToast('Report submitted on-chain!')
      setTimeout(() => setToast(null), 5000)
    } catch (e: any) {
      console.error('Report error:', e)
      notify(txFailureNotice('Report', e))
    } finally {
      setReportSubmitting(false)
    }
  }

  // Helper: format stakes
  // Helper: trust score color (3 states matching shield colors)
  const getTrustColor = (score: number): string => {
    if (score >= 40) return '#34a872'   // green
    if (score >= 10) return '#c49a2a'   // orange
    return '#cd5c5c'                    // red
  }

  // Helper: clean agent name (remove "Agent: " prefix and description)
  const getAgentName = (label: string | null | undefined): string => {
    if (!label || typeof label !== 'string') return 'Unnamed'
    // New format: JSON label
    try {
      const parsed = JSON.parse(label)
      if (typeof parsed === 'object' && parsed !== null && typeof parsed.name === 'string') {
        return parsed.name
      }
    } catch { /* not JSON */ }
    // Old format: "Name - description"
    let name = label.replace(/^Agent:(?:\w+:)?\s*/i, '')
    if (name.includes(' - ')) name = name.split(' - ')[0]
    return name.trim() || 'Unnamed'
  }

  // Wrapper that handles atoms where label is "json object" and JSON is in data field
  const getAgentNameFromAtom = (atom: { label?: string | null; data?: string | null }): string => {
    return getAgentName(effectiveLabel(atom))
  }

  // Build trust ratio chart data from signals
  const buildTrustChartData = (signals: any[], counterTermId: string | null) => {
    if (signals.length < 2) return []
    const sorted = [...signals].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    let supportTotal = 0
    let opposeTotal = 0
    const points: Array<{ date: string; trustRatio: number }> = []
    for (const signal of sorted) {
      const delta = Math.abs(Number(signal.delta || 0)) / 1e18
      const isDeposit = !!signal.deposit_id
      const isAgainst = counterTermId ? signal.term_id === counterTermId : false
      const change = isDeposit ? delta : -delta

      if (isAgainst) opposeTotal += change
      else supportTotal += change

      // Clamp to 0
      if (supportTotal < 0) supportTotal = 0
      if (opposeTotal < 0) opposeTotal = 0

      // No stake at this point → no ratio to plot (a 50 here would be invented).
      const total = supportTotal + opposeTotal
      if (total <= 0) continue
      points.push({
        date: formatDateShort(signal.created_at),
        trustRatio: Math.round((supportTotal / total) * 100),
      })
    }
    return points
  }

  // ─── Weighted trust z decay dla wybranego agenta ───
  const weightedTrust = useMemo(() => {
    try {
      if (!agentSignals || agentSignals.length === 0) return null
      const mappedSignals = agentSignals.map((sig: any) => ({
        timestamp: sig.created_at,
        side: (agentTriple.counterTermId && sig.term_id === agentTriple.counterTermId)
          ? 'oppose' as const
          : 'support' as const,
        amount: Math.abs(Number(sig.delta || 0)) / 1e18,
      }))
      return calculateWeightedTrust(mappedSignals)
    } catch (e) {
      console.error('[weightedTrust]', e)
      return null
    }
  }, [agentSignals, agentTriple.counterTermId])

  // ─── Exit limit for whale-exit protection ───

  // ─── Composite trust score (whale-exit resistant) ───
  const compositeTrust = useMemo((): CompositeResult | null => {
    try {
      if (!agentSignals || agentSignals.length === 0) return null
      if (!weightedTrust) return null
      const mappedSignals = agentSignals.map((sig: any) => ({
        timestamp: sig.created_at,
        side: (agentTriple.counterTermId && sig.term_id === agentTriple.counterTermId)
          ? 'oppose' as const : 'support' as const,
        amount: Math.abs(Number(sig.delta || 0)) / 1e18,
        shares: Math.abs(Number(sig.shares_delta || sig.shares || 0)) / 1e18,
      }))
      const stableDays = calculateStableDays(mappedSignals)
      // Use on-chain share price when available, fallback to local approximation
      const currentPrice = onChainPrice ?? (BONDING_CURVE_CONFIG.BASE_PRICE + BONDING_CURVE_CONFIG.SLOPE * supportSupply)
      const peakPrice = peakOnChainPrice ?? findPeakPrice(
        mappedSignals.filter(s => s.side === 'support'),
        BONDING_CURVE_CONFIG.BASE_PRICE,
        BONDING_CURVE_CONFIG.SLOPE
      )
      // Anti-sybil: count only stakers with net deposit >= 0.1 tTRUST
      const MIN_STAKE = 0.1 // tTRUST
      const walletNetStake = new Map<string, number>()
      for (const sig of agentSignals) {
        const wallet = sig.account_id
        if (!wallet) continue
        const delta = Number(sig.delta || 0) / 1e18  // positive = deposit, negative = redeem
        walletNetStake.set(wallet, (walletNetStake.get(wallet) ?? 0) + delta)
      }
      const qualifiedStakers = [...walletNetStake.values()].filter(v => v >= MIN_STAKE).length

      return calculateCompositeTrust({
        weightedSignalRatio: weightedTrust.weightedRatio,
        uniqueStakers: qualifiedStakers,
        stableDays,
        currentPrice,
        peakPrice: Math.max(peakPrice, currentPrice),
        recentSells: [],
      })
    } catch (e) {
      console.error('[compositeTrust]', e)
      return null
    }
  }, [agentSignals, weightedTrust, supportSupply, combinedStakerCount, agentTriple.counterTermId, onChainPrice, peakOnChainPrice])

  // The modal's trust score is a measurement only when the vault was read and holds
  // stake (lib/score-basis.ts). Everything score-shaped below is gated on this.
  const modalStakeReading = agentTrust
    ? { supportWei: agentTrust.supportStake, opposeWei: agentTrust.opposeStake }
    : null
  const modalMeasured = hasMeasuredScore(modalStakeReading)

  // ─── Hybrid Score (AGENTSCORE = 60% economic confidence + 40% quality metrics) ───
  const hybridScore = useMemo((): number | null => {
    try {
      // A hybrid built on the zero-stake prior is not a measurement — no measured trust score, no hybrid.
      if (!agentTrust || !compositeTrust || !modalMeasured) return null
      // Support positions are in the ATOM vault (selectedAgent.term_id), NOT the triple vault (agentTriple.termId).
      // agentTriple.termId is the triple's own support-vault termId, which differs from the atom's termId.
      const supportPositions = allPositions.filter(
        (p: any) => p.term_id === selectedAgent?.term_id,
      )
      const opposePositions = allPositions.filter(
        (p: any) => p.term_id === agentTriple.counterTermId,
      )
      const supportRatio = (supportPositions.length > 0 || opposePositions.length > 0)
        ? calculateDiversityWeightedRatio(supportPositions, opposePositions, evaluatorWeights)
        : supportPercent(modalStakeReading)
      if (supportRatio == null) return null
      return calculateHybridScore(agentTrust.score, compositeTrust.score, supportRatio)
    } catch (e) {
      console.error('[hybridScore]', e)
      return null
    }
  }, [agentTrust, compositeTrust, modalMeasured, allPositions, agentTriple.termId, agentTriple.counterTermId, evaluatorWeights])

  // The modal's one backing score (Etap 5b): the measured trust score — support vs oppose on the
  // agent's own vault, the number the card and the profile print from the same stake; "—"
  // otherwise (lib/score-basis.ts). The hybrid (with the composite) is a part, under Details. The
  // modal no longer writes its hybrid onto the card: a card's number never changes on a modal open.
  const modalBackingScore = measuredScore(agentTrust, modalMeasured)

  // ─── Skill Trust Breakdown ───
  const skillBreakdown = useMemo((): SkillBreakdownResult | null => {
    try {
      if (!skillTriples || skillTriples.length === 0) return null
      const result = calculateSkillBreakdown(skillTriples)
      return result.hasSkills ? result : null
    } catch (e) {
      console.error('[skillBreakdown]', e)
      return null
    }
  }, [skillTriples])


  // The header's stat row (Etap 5a): the same derivation as /agents/[id] (lib/agent-profile.ts
  // statRowView, components/profile/ProfileStatRow), from this modal's reads — the list's
  // attestations, the modal answer's reports and signals, and this agent's vault positions (the
  // modal answer's, or the live read after the user's own trade). Backers are known only once THIS
  // agent's positions were read. A part not read (or failed) renders "—", never 0.
  const positionsKnown = !!selectedAgent && positionsLoadedFor === selectedAgent.term_id
  const attestedRead = profileLoaded && profileVector.attested != null
  const reportsRead = profileLoaded && profileVector.reports != null
  const statRow = useMemo(() => statRowView({
    attested: attestedRead ? profileVector.attested : null,
    reportCount: reportsRead ? reportCount : null,
    backers: positionsKnown && selectedAgent ? backersFromPositions(allPositions, selectedAgent.term_id, agentTriple.counterTermId) : null,
    signals: signalsLoading ? null : agentSignalsCount,
  }), [attestedRead, reportsRead, profileVector.attested, reportCount, positionsKnown, selectedAgent, allPositions, agentTriple.counterTermId, signalsLoading, agentSignalsCount])

  // The agent tier — attestations only (thesis §6 "Agent tiers", lib/agent-tier.ts). Backing on
  // the atom vault never changes it. null while the profile loads or when the attestation read
  // failed: the chip then says so, never a default "Unverified".
  const agentTier = useMemo(
    () => (attestedRead && profileVector.attested ? calculateAgentTier(summarizeAttesters(profileVector.attested)) : null),
    [attestedRead, profileVector.attested],
  )

  // ─── Avatar z localStorage (zapisywany przy rejestracji) ───
  const agentAvatar = useMemo(() => {
    if (!selectedAgent?.term_id) return null
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(`agentscore_avatar_${selectedAgent.term_id}`) || null
    } catch { return null }
  }, [selectedAgent?.term_id])

  // ─── Pozycje posortowane chronologicznie z rank ───
  const enrichedPositions = useMemo(() => {
    try {
      if (!allPositions || allPositions.length === 0) return []
      const sorted = [...allPositions].sort((a, b) => {
        const dateA = new Date(a.updated_at || 0).getTime()
        const dateB = new Date(b.updated_at || 0).getTime()
        return isNaN(dateA) || isNaN(dateB) ? 0 : dateA - dateB
      })
      return sorted.map((pos, index) => ({
        ...pos,
        rank: index + 1,
        isEarlySupporter: index < Math.max(1, Math.ceil(sorted.length * 0.2)),
      }))
    } catch (e) {
      console.error('[enrichedPositions]', e)
      return []
    }
  }, [allPositions])

  // ─── Score Trajectory (for Overview chart) ───
  const scoreTrajectory = useMemo(() => {
    try {
      if (!selectedAgent) return []
      const score = hybridScore ?? measuredScore(agentTrust, modalMeasured)
      if (score == null) return []  // nothing measured → no trajectory point
      const tier = agentTier?.tier ?? null
      const stakingEvts = agentSignals.map((s: any) => ({
        id: s.id as string,
        accountId: s.account_id as string,
        type: Number(s.delta || 0) >= 0 ? 'deposit' as const : 'redeem' as const,
        side: (agentTriple.counterTermId && s.term_id === agentTriple.counterTermId)
          ? 'oppose' as const
          : 'support' as const,
        deltaWei: String(Math.abs(Number(s.delta || 0))),
        timestamp: s.created_at as string,
      }))
      const tl = buildAgentTimeline({
        agentId: selectedAgent.term_id,
        agentName: getAgentNameFromAtom(selectedAgent),
        createdAt: selectedAgent.created_at,
        currentScore: score,
        currentTier: tier,
        tierMilestones: 'none', // agent tiers come from attestations, not supporter counts
        stakingEvents: stakingEvts,
        skillEvents: [],
      })
      return tl.scoreHistory
    } catch { return [] }
  }, [selectedAgent, agentSignals, agentTriple.counterTermId, hybridScore, agentTrust, modalMeasured, agentTier])

  // ── List state ────────────────────────────────────────────────────────────
  // A filter change updates state and the URL. Next's router follows history.replaceState,
  // so useSearchParams stays in step without a server round-trip.
  const setListFilters = (next: { origin?: OriginFilter; quality?: QualityFilter; sort?: AgentListSortBy }) => {
    const f = { origin: next.origin ?? originFilter, quality: next.quality ?? qualityFilter, sort: next.sort }
    setOriginFilter(f.origin)
    setQualityFilter(f.quality)
    if (f.sort) setSortBy(f.sort)
    const search = listFiltersSearch(window.location.search, f)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`)
  }

  // Corpus counts — the header line and the origin tabs print the same totals (corpusTotals).
  const corpusCounts: { agentScore: AgentScoreCorpusCounts; cohort: CohortCorpusCounts } = {
    agentScore: {
      status: loading ? 'loading' : error ? 'error' : 'ok',
      kept: agents.length,
      junk: agentJunkFilteredCount,
      fetched: agentCorpusMeta.fetched,
      total: agentCorpusMeta.total,
      truncated: agentCorpusMeta.truncated,
    },
    cohort: { status: cohortStatus, count: cohortAgents.length, total: cohortTotal, truncated: cohortTruncated },
  }
  const originTotals = corpusTotals(corpusCounts)
  // The header's "Updated N min ago" keeps counting while the page is open.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const listLoaded = !(loading || cohortLoading)
  const modalAge = selectedAgent ? modalFreshnessLabel(pageView, modalData, liveAgent, nowTick) : null

  // The list's rows before the quality filter: the origin's CORPUS, narrowed by search (one
  // rule for both corpora — the displayed name or the raw label). The quality dropdown counts
  // these; the grid/list filter and sort them.
  const listRows = useMemo(() => {
    const sourceAgents =
      originFilter === 'agentscore' ? agents :
      originFilter === 'erc8004' ? cohortAgents :
      [...agents, ...cohortAgents]
    const searchedAgents = searchTerm
      ? sourceAgents.filter(a => matchesAgentSearch(searchTerm, [getAgentNameFromAtom(a), effectiveLabel(a)]))
      : sourceAgents
    const enriched = searchedAgents.map(a => {
      // The list's one derivation (lib/agent-list.ts listEntryOf) — the landing carousel's too.
      const { agent, trust, measured, reading } = listEntryOf(a as GraphQLAgent & { __opposeWei?: bigint | null })
      return { agent, trust, measured, noScoreTip: noScoreTooltip(reading), bucket: qualityBucket(trust, measured) }
    })
    return { sourceCount: sourceAgents.length, enriched }
    // getAgentNameFromAtom is a pure per-render closure over effectiveLabel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, cohortAgents, originFilter, searchTerm])
  const qualityOpts = qualityOptions(listLoaded ? listRows.enriched.map(e => e.bucket) : null)

  return (
    <PageBackground image="hero" opacity={0.4}>
      {/* Dev error overlay — shows JS errors that would otherwise require DevTools */}
      {pageError && process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#1a0000', border: '2px solid #ef4444', padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', color: '#fca5a5', maxHeight: '40vh', overflow: 'auto' }}>
          <strong style={{ color: '#ef4444' }}>🐛 JS Error caught:</strong>
          <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{pageError}</pre>
          <button onClick={() => setPageError(null)} style={{ marginTop: 8, padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}
      <div className="pt-24 pb-16">
        <div className="container">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 md:mb-10"
          >
            {/* Label */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#C8963C] rounded-full" />
              <span className="text-xs font-semibold text-[#C8963C] uppercase tracking-widest">
                Live on Intuition Testnet
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
              AI Agent
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8963C] to-[#C9A84C]">
                {" "}Intelligence Registry
              </span>
            </h1>

            {/* Description */}
            <p className="text-[#7A838D] text-lg max-w-2xl leading-relaxed">
              Decentralized trust verification for AI agents.
              Stake <span className="text-[#B5BDC6] font-medium">tTRUST</span> to signal
              confidence — every vote is transparent, on-chain, and permanent.
            </p>

            {/* Live indicator */}
            <div className="flex items-center gap-2 mt-4">
              <div className="w-2 h-2 rounded-full bg-[#C8963C] animate-pulse" />
              <span className="text-xs text-[#7A838D]">
                {/* Corpus totals only — no search/filter input; loading → "—", failed →
                    "feed unavailable", "live feed" only when both reads succeeded (lib/agent-list.ts). */}
                {agentListHeaderSegments({ ...corpusCounts, freshness: pageView ? feedFreshnessLabel(pageView.parts, LIVE_FEED_LABEL, nowTick) : null }).join(' · ')}
              </span>
            </div>
          </motion.div>

          {/* Search + Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            {/* Search Input */}
            <div className="relative mb-3">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A838D]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search agents, platforms, addresses..."
                className="w-full pl-11 pr-10 py-3 bg-[#191C21] border border-white/12 rounded-xl text-white text-sm placeholder:text-[#7A838D] focus:border-[#C8963C]/60 focus:ring-1 focus:ring-[#C8963C]/20 outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A838D] hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Origin tabs — counts are the corpus totals the header line prints (one source,
                lib/agent-list.ts corpusTotals): "—" while a corpus loads or when its read failed. */}
            <div
              role="tablist"
              aria-label="Origin"
              className="grid grid-cols-3 sm:inline-grid sm:grid-flow-col sm:auto-cols-max gap-1 p-1 rounded-xl mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {ORIGIN_TABS.map(o => {
                const Icon = o.id === 'agentscore' ? Layers : o.id === 'erc8004' ? ExternalLink : Globe
                const active = originFilter === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={o.title}
                    onClick={() => setListFilters({ origin: o.id })}
                    className={`flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-2 sm:px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'bg-[#1E2229] text-[#C8963C] border border-[#C8963C]/50'
                        : 'text-[#B5BDC6] border border-transparent hover:text-white hover:bg-[#1E2229]'
                    }`}
                  >
                    <Icon className="hidden sm:block w-3 h-3 flex-shrink-0" />
                    {o.label}
                    <span className={`tabular-nums ${active ? 'text-[#C8963C]/75' : 'text-[#7A838D]'}`}>{originTotals[o.id] ?? '—'}</span>
                  </button>
                )
              })}
            </div>

            {/* Sort · backing level — one row at 390 px. The backing level (the backing score's
                buckets) is secondary: after the sort, muted (Etap 5b). */}
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <select
                aria-label="Sort"
                value={sortBy}
                onChange={(e) => setListFilters({ sort: parseSort(e.target.value) })}
                className="flex-none bg-[#191C21] border border-white/12 rounded-lg px-2 sm:px-3 py-1.5 text-xs text-[#B5BDC6] focus:border-[#C8963C]/50 outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>

              {/* Backing level: every bucket listed; an empty one is disabled with its 0, never hidden. */}
              <select
                aria-label={BACKING_LEVEL}
                value={qualityFilter}
                onChange={(e) => setListFilters({ quality: e.target.value as QualityFilter })}
                className="min-w-0 flex-1 sm:flex-none bg-transparent border border-white/[0.08] rounded-lg px-2 sm:px-3 py-1.5 text-xs text-[#7A838D] focus:border-[#C8963C]/50 outline-none cursor-pointer"
              >
                {qualityOpts.map(o => (
                  <option key={o.id} value={o.id} disabled={o.disabled}>{qualityOptionText(o)}</option>
                ))}
              </select>
            </div>
          </motion.div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mr-3" />
              <span className="text-text-secondary">Loading agents from Intuition testnet...</span>
            </div>
          )}

          {/* Nothing could be read and nothing is cached: say so, for humans. One corpus failing is
              said in the header ("… feed unavailable") while the other renders. */}
          {!loading && pageView?.unreachable && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6" data-testid="feed-unreachable">
              <p className="text-red-400">{FEED_UNREACHABLE}</p>
              <button onClick={() => loadPage()} className="mt-2 text-sm text-accent-cyan hover:underline">
                Try again →
              </button>
            </div>
          )}

          {/* Empty State - No agents registered */}
          {/* "None registered" only when BOTH corpora were actually read and are empty. */}
          {!loading && !error && cohortStatus === 'ok' && (agents.length + cohortAgents.length) === 0 && !searchTerm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="glass rounded-2xl p-12 max-w-2xl mx-auto">
                <p className="text-6xl mb-6">🤖</p>
                <h3 className="text-3xl font-bold mb-4">No agents registered yet</h3>
                <p className="text-xl text-text-secondary mb-6">
                  Be the first to register AI agents on AgentScore!
                </p>
                <p className="text-sm text-text-muted mb-8">
                  Agents are loaded from Intuition testnet via GraphQL.
                  The docs show how to register one — from the app, REST or MCP.
                </p>
                <Button size="lg" asChild>
                  <Link href="/docs">
                    How to register an agent →
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}

          {/* Empty Search Results */}
          {!loading && !error && (agents.length + cohortAgents.length) === 0 && searchTerm && (
            <div className="text-center py-20">
              <p className="text-6xl mb-4">🔍</p>
              <h3 className="text-xl font-bold mb-2">No results for &quot;{searchTerm}&quot;</h3>
              <p className="text-text-secondary mb-6">Try a different search term</p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-[#C8963C] rounded-lg text-white font-semibold hover:bg-[#C8963C]-hover transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Agents Grid */}
          {!(loading || cohortLoading) && (agents.length + cohortAgents.length) > 0 && (() => {
            // Etap 2c: AgentScore + ERC-8004 cohort per origin tab. listRows (above) is the
            // origin's CORPUS narrowed by search; the quality filter narrows it here. The results
            // line prints the narrowed count; the header and the tabs print corpus totals only.
            const filtered = qualityFilter === 'all'
              ? listRows.enriched
              : listRows.enriched.filter(e => e.bucket === qualityFilter)

            // Honesty gate (thesis §6): see lib/agent-list-sort.ts — a row without a measured
            // score (zero stake, or never read) must never rank among measured scores by its prior.
            // People first by default (lib/agent-list.ts orderAgents — the landing carousel's order).
            const sorted = orderAgents(filtered, attestationViewBySubject, sortBy)
            const qualityLabel = QUALITY_LEVELS.find(l => l.id === qualityFilter)?.label

            return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-[#7A838D]" data-testid="results-line">
                  {(() => {
                    const line = agentResultsLine(sorted.length, listRows.sourceCount)
                    return (
                      <>
                        <span className="font-semibold text-white">{line.shown}</span>
                        {line.of != null && <span className="text-[#4A5260]"> of {line.of}</span>} {line.noun}
                      </>
                    )
                  })()}
                  {qualityLabel && (
                    <span className="text-[#4A5260]"> · <span className="text-[#B5BDC6]">{BACKING_LEVEL}: {qualityLabel}</span></span>
                  )}
                </p>

                {/* View mode toggle — icons only on phones */}
                <div
                  className="flex items-center gap-0.5 p-1 rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {([
                    { id: 'grid' as const, label: 'Grid', icon: LayoutGrid },
                    { id: 'list' as const, label: 'List', icon: List },
                  ]).map(v => {
                    const Icon = v.icon
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setViewMode(v.id)}
                        aria-label={v.label}
                        aria-pressed={viewMode === v.id}
                        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                        style={viewMode === v.id ? {
                          background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.08))',
                          border: '1px solid rgba(200,150,60,0.35)',
                          color: '#C8963C',
                        } : {
                          border: '1px solid transparent',
                          color: '#7A838D',
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{v.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {sorted.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-[#7A838D] text-sm">
                    {searchTerm ? <>No agents match &quot;{searchTerm}&quot;{qualityFilter !== 'all' ? ' in this filter' : ''}</> : 'No agents match this filter'}
                  </p>
                  <button
                    onClick={() => { setListFilters({ quality: 'all' }); setSearchTerm('') }}
                    className="mt-2 text-xs text-[#C8963C] hover:underline"
                  >
                    Show all agents
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
              /* ── GRID VIEW ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sorted.map(({ agent, trust: cardTrust, measured, noScoreTip }) => {
                  // The backing score (Etap 5b): the measured trust score from the atom vault's
                  // support vs oppose — the modal's and the profile's number too; small and neutral.
                  // At zero stake cardTrust.score is the formula's 50 prior: "—" (lib/score-basis.ts).
                  const displayScore = measuredScore(cardTrust, measured)
                  // Live stakers only (lib/live-position.ts) — a 0-share row is not a staker.
                  const stakers = agent.liveStakerCount
                  const stakes = formatTTrust(agent.positions_aggregate?.aggregate?.sum?.shares ?? 0n)
                  const name = getAgentNameFromAtom(agent)
                  // Cohort rows never fetch the atom vault: their stake/stakers were never
                  // measured, so they are not printed (thesis §6: null ≠ 0.0).
                  const vaultRead = readSharesWei(agent.positions_aggregate) != null
                  // Attestations — the same read and derivation as the modal, and the same helper
                  // as the list row (lib/agent-list.ts attesterLineOf). The tier chip shows only
                  // Trusted / Verified (thesis §6); Unverified is carried by the people line.
                  const attesterLine = attesterLineOf(attestationViewBySubject, agent.term_id)
                  const cardTierChip = tierChipOf(attestationViewBySubject, agent.term_id)
                  const originChip = <OriginChip origin={agent.origin} />
                  const backing = <BackingScore value={displayScore} tip={noScoreTip} className="flex-shrink-0 pt-0.5" />
                  const cardClass = `bg-[#111318] border border-[#1e2028] rounded-2xl
                                 cursor-pointer transition-all duration-300 ease-out
                                 hover:-translate-y-1 hover:border-[#C8963C]/15
                                 hover:bg-[#171A1D] hover:shadow-[0_8px_30px_rgba(200,150,60,0.08)]`

                  // Compact: a cohort row (vault never read on the list). Its stake line would be
                  // the same on every such card, so it is not drawn; its backing reads "—".
                  // Decided at first paint only — the attestation read never reshapes a card
                  // (lib/agent-list.ts isCompactCard).
                  if (isCompactCard({ vaultRead })) {
                    return (
                      <motion.div
                        key={agent.term_id}
                        data-term-id={agent.term_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        onClick={() => setSelectedAgent(agent)}
                        className={`${cardClass} p-4`}
                        data-card="compact"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <h3 className="font-bold text-white text-base leading-tight min-w-0 [overflow-wrap:anywhere]">{name}</h3>
                            {cardTierChip && <TrustTierBadge tier={cardTierChip} size="sm" />}
                            {originChip}
                          </div>
                          {backing}
                        </div>
                        <CardAttesterLine line={attesterLine} agentName={name} onAttest={() => openAgentAtAttested(agent)} size="sm" />
                      </motion.div>
                    )
                  }

                  return (
                    <motion.div
                      key={agent.term_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      onClick={() => setSelectedAgent(agent)}
                      className={`${cardClass} p-5`}
                      data-card="full"
                      data-term-id={agent.term_id}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <h3 className="font-bold text-white text-base leading-tight min-w-0 [overflow-wrap:anywhere]">{name}</h3>
                            {/* Agent tier chip — Trusted / Verified only (attestations, thesis §6). */}
                            {cardTierChip && <TrustTierBadge tier={cardTierChip} size="sm" />}
                          </div>
                          {originChip}
                        </div>
                        {backing}
                      </div>
                      {/* The headline: who vouches, and for what (Etap 5b) — above the vault line. */}
                      <CardAttesterLine line={attesterLine} agentName={name} onAttest={() => openAgentAtAttested(agent)} size="sm" className="mb-3" />
                      {vaultRead && (
                        <div className="flex items-center gap-4 text-sm text-[#B5BDC6]">
                          <span>Stakes: <span className="text-white font-medium">{stakes}</span></span>
                          <span>Stakers: <span className="text-white font-medium">{stakers ?? '—'}</span></span>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
              ) : (
              /* ── LIST VIEW ──
                 The grid card's information in one row: name (wraps — never cut to one
                 character), tier and origin chips, the attester line (the same attesterLineOf
                 as the card), stake, stakers, score. Phones drop the Stakes/Stakers columns
                 and print the card's stake line under the name instead. */
              <div className="flex flex-col gap-1.5">
                <div className={`${LIST_ROW_GRID} py-2 text-[10px] font-bold uppercase tracking-widest text-[#4A5260]`}>
                  <span />
                  <span>Agent</span>
                  <span className="hidden sm:block text-right">Stakes</span>
                  <span className="hidden sm:block text-right">Stakers</span>
                  <span className="text-right">{BACKING_LABEL}</span>
                </div>
                {sorted.map(({ agent, trust: cardTrust, measured, noScoreTip }, i) => {
                  // The card's backing score, the same derivation (small, neutral — Etap 5b).
                  const displayScore = measuredScore(cardTrust, measured)
                  const stakers = agent.liveStakerCount
                  const stakes = formatTTrust(agent.positions_aggregate?.aggregate?.sum?.shares ?? 0n)
                  const name = getAgentNameFromAtom(agent)
                  const listVaultRead = readSharesWei(agent.positions_aggregate) != null
                  const attesterLine = attesterLineOf(attestationViewBySubject, agent.term_id)
                  const rowTierChip = tierChipOf(attestationViewBySubject, agent.term_id)

                  return (
                    <motion.div
                      key={agent.term_id}
                      data-row="list"
                      data-term-id={agent.term_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.015 }}
                      onClick={() => setSelectedAgent(agent)}
                      className={`${LIST_ROW_GRID} items-center py-3 rounded-xl cursor-pointer transition-all duration-150`}
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(200,150,60,0.05)'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,150,60,0.15)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'
                      }}
                    >
                      {/* Icon — neutral: it no longer carries the score's colour (Etap 5b) */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.03] border border-white/[0.08]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                            stroke="#7A838D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {/* Name + chips, attester line (+ stake line on phones) */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-white leading-snug min-w-0 [overflow-wrap:anywhere]">{name}</p>
                          {rowTierChip && <TrustTierBadge tier={rowTierChip} size="sm" />}
                          <OriginChip origin={agent.origin} />
                        </div>
                        <CardAttesterLine line={attesterLine} agentName={name} onAttest={() => openAgentAtAttested(agent)} className="mt-0.5" />
                        {listVaultRead && (
                          <p className="sm:hidden text-xs text-[#B5BDC6] mt-0.5">
                            <span className="whitespace-nowrap">Stakes: <span className="text-white font-medium">{stakes}</span></span>
                            {' · '}
                            <span className="whitespace-nowrap">Stakers: <span className="text-white font-medium">{stakers ?? '—'}</span></span>
                          </p>
                        )}
                      </div>
                      {/* Stakes */}
                      <span className="hidden sm:block text-xs text-[#B5BDC6] text-right whitespace-nowrap">{listVaultRead ? stakes : '—'}</span>
                      {/* Stakers */}
                      <span className="hidden sm:block text-xs text-[#B5BDC6] text-right whitespace-nowrap">{listVaultRead && stakers != null ? stakers : '—'}</span>
                      {/* Backing score — the card's number, neutral */}
                      <div className="flex items-center justify-end">
                        <BackingScore value={displayScore} tip={noScoreTip} variant="value" />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
              )}
            </motion.div>
            )
          })()}
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 top-16 lg:top-20 z-[30] overflow-y-auto"
          style={{
            backgroundColor: '#0A0C0E',
            backgroundImage: "linear-gradient(rgba(10,10,15,0.75), rgba(10,10,15,0.75)), url('/images/brand/gold/background.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat',
          }}
          onClick={() => setSelectedAgent(null)}
        >
          <div className="min-h-full p-4 pb-36 md:pb-4 flex items-start justify-center">
            <div className="w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>

              {/* === TOP CARD: Agent Header === */}
              <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-6 mb-3">
                <div className="flex items-start gap-4 mb-4">
                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-xl font-bold text-white">
                        {getAgentNameFromAtom(selectedAgent)}
                      </h2>
                      <div className="flex items-center gap-1.5">
                        {/* The agent tier — attestations only (thesis §6), always shown:
                            Unverified / Trusted + "1 of 3 people needed to verify", or Verified.
                            "—" while loading; unavailable if the attestation read failed. */}
                        <AgentTierChip tier={agentTier} loading={!profileLoaded} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#B5BDC6]">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        selectedAgent.origin === 'erc8004' ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'bg-[#1E2229] text-[#7A838D]'
                      }`}>
                        {selectedAgent.origin === 'erc8004' ? 'ERC-8004' : 'via AgentScore'}
                      </span>
                      <span>·</span>
                      <span>Registered {formatDate(selectedAgent.created_at)}</span>
                    </div>
                  </div>


                  {/* Close */}
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="w-8 h-8 rounded-lg bg-[#1E2229] hover:bg-[#252B33] flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#B5BDC6" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Description */}
                <p className="text-[#B5BDC6] text-sm leading-relaxed mb-5">
                  {(() => {
                    const lbl = effectiveLabel(selectedAgent)
                    if (lbl) {
                      try {
                        const p = JSON.parse(lbl)
                        if (p?.description) return p.description
                      } catch { /* not JSON */ }
                      if (lbl.includes(' - ')) {
                        return lbl.split(' - ').slice(1).join(' - ')
                      }
                    }
                    return 'AI Agent registered on Intuition Protocol.'
                  })()}
                </p>

                {/* The stat row — attestation unit primary, Backers demoted (thesis §4/§6) — and the
                    modal's own age line. The same component as /agents/[id] (Etap 5a). */}
                <ProfileStatRow
                  view={statRow}
                  backing={<BackingScore variant="line" value={modalBackingScore} tip={noScoreTooltip(modalStakeReading)} />}
                  footer={modalAge && <p data-testid="modal-age" className="text-xs text-[#7A838D] mt-1">{modalAge}</p>}
                />
              </div>

              {/* ETAP 3 — profile hierarchy (thesis §5), always visible above the
                  tabs: ATTESTED (headline, canonical unit) > DECLARED (2c, cohort
                  only) > REPORTS (collapsed). Zero attestations renders the
                  AttestEmptyState "be the first" CTA (thesis §6). */}
              <div ref={attestedSectionRef} tabIndex={-1} className="scroll-mt-4 outline-none">
                <AttestedDomains
                  entries={profileVector.attested}
                  loading={!profileLoaded}
                  agentId={selectedAgent.term_id}
                  agentName={getAgentNameFromAtom(selectedAgent)}
                  className="mb-3"
                />
              </div>
              {selectedAgent.origin === 'erc8004' && (
                <DeclaredDomains declaredDomains={selectedAgent.declaredDomains} className="mb-3" />
              )}
              <ReportsSection reports={profileVector.reports} loading={!profileLoaded} className="mb-3 px-1" />

              {/* === ACTION SECTION: Back this agent (Buy/Sell) — collapsed by default.
                  Secondary to the attestation unit above (thesis §4/§6): backing is a
                  vault stake, not a competence claim, and never changes the tier. */}
              <BackThisAgentSection open={backAccordionOpen} onToggle={() => setBackAccordionOpen(v => !v)} className="mb-3">
                {isConnected ? (
                  <>
                    {/* Legacy Oppose position — show sell button if user has against shares */}
                    {userPosition.againstShares && Number(userPosition.againstShares) > 0 && (
                      <div className="mb-3 p-3 rounded-xl bg-[#8b3a3a15] border border-[#8b3a3a30]">
                        <p className="text-[#c45454] text-xs font-semibold mb-1">Legacy Oppose Position</p>
                        <p className="text-[#B5BDC6] text-[10px] mb-2">
                          You have {(Number(userPosition.againstShares) / 1e18).toFixed(4)} AGAINST shares. Opposing agents is now handled per-Claim.
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setPendingVote({
                              type: 'redeem_distrust',
                              agent: selectedAgent,
                              amount: (Number(userPosition.againstShares) / 1e18).toString(),
                              claim: '',
                              claimAtomId: null,
                              counterTermId: agentTriple.counterTermId,
                              knownShares: userPosition.againstShares ?? undefined,
                            })
                            setSelectedAgent(null)
                            setShowConfirm(true)
                          }}
                          className="px-3 py-1.5 bg-[#8b3a3a] hover:bg-[#c45454] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Sell Oppose Shares →
                        </button>
                      </div>
                    )}

                    <>
                    {/* Buy / Sell tabs */}
                    <div className="flex rounded-xl overflow-hidden border border-[#C8963C]/12 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setTradeAction('buy') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          tradeAction === 'buy'
                            ? 'bg-white text-black'
                            : 'bg-transparent text-[#B5BDC6] hover:text-white'
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTradeAction('sell') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          tradeAction === 'sell'
                            ? 'bg-white text-black'
                            : 'bg-transparent text-[#B5BDC6] hover:text-white'
                        }`}
                      >
                        Sell
                      </button>
                    </div>

                    {/* Curve info */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div>
                        <p className="text-white text-xs font-semibold">
                          Bonding Curve
                          <span className="ml-1.5 text-[#C8963C] text-[10px] font-normal">
                            {tradeAction === 'buy' ? '↑ price rises with each buy' : '↓ price drops with each sell'}
                          </span>
                        </p>
                        <p className="text-[#B5BDC6] text-xs">
                          Current: <span className="text-white font-mono font-semibold">{(onChainPrice ?? getCurrentPrice(supportSupply)).toFixed(4)}</span> tTRUST/share
                          <span className="text-[#7A838D] ml-1.5">· supply: {supportSupply.toFixed(2)}</span>
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full border border-[#C8963C]/25 text-[#C8963C] bg-[#C8963C]/8">
                        Live
                      </span>
                    </div>


                    {/* Your shares info — visible in Sell mode */}
                    {tradeAction === 'sell' && (() => {
                      const ownedShares = userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0
                      const currentSupply = supportSupply
                      return ownedShares > 0 ? (
                        <div className="mb-3 p-3 rounded-xl bg-[#171A1D] border border-[#C8963C]/12">
                          <div className="flex justify-between items-center">
                            <span className="text-[#B5BDC6] text-xs">Your shares</span>
                            <span className="text-white text-sm font-bold font-mono">
                              {ownedShares.toFixed(4)} shares
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[#7A838D] text-[10px]">Current value</span>
                            <span className="text-[#7A838D] text-[10px] font-mono">
                              {onChainPrice ? (ownedShares * onChainPrice).toFixed(6) : getSellProceeds(ownedShares, currentSupply).toFixed(6)} tTRUST
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 p-3 rounded-xl bg-[#171A1D] border border-[#C8963C]/12 text-center">
                          <p className="text-[#7A838D] text-xs">No stake shares to sell</p>
                        </div>
                      )
                    })()}

                    {/* Amount input */}
                    <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-3 mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#B5BDC6] text-xs">
                          {tradeAction === 'buy' ? 'Amount in tTRUST' : 'Shares to sell'}
                        </span>
                        {tradeAction === 'buy' && (
                          <span className="text-[#B5BDC6] text-xs">
                            Balance: {tTrustBalance || '—'} tTRUST
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {tradeAction === 'buy' ? (
                          <DecimalInput
                            value={voteAmount}
                            onChange={setVoteAmount}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-transparent text-white text-lg font-bold outline-none"
                            placeholder="0.05"
                          />
                        ) : (
                          <DecimalInput
                            value={redeemShares}
                            onChange={setRedeemShares}
                            max={(userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0).toFixed(6)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-transparent text-white text-lg font-bold outline-none"
                            placeholder="0.00"
                          />
                        )}
                        <span className="text-[#B5BDC6] text-sm font-semibold">
                          {tradeAction === 'buy' ? 'tTRUST' : 'shares'}
                        </span>
                        {tradeAction === 'sell' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const maxRaw = userPosition.forShares
                              if (maxRaw) {
                                const maxShares = Number(maxRaw) / 1e18
                                setRedeemShares(maxShares.toFixed(6))
                              }
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#C8963C]/12 text-[#C8963C] hover:bg-[rgba(200,150,60,0.20)] transition-colors font-bold"
                          >
                            MAX
                          </button>
                        )}
                      </div>
                      {/* Percentage slider — sell mode only */}
                      {tradeAction === 'sell' && (() => {
                        const maxShares = userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0
                        if (maxShares <= 0) return null
                        return (
                          <div className="mt-2">
                            <input
                              type="range"
                              min="0"
                              max={maxShares}
                              step={maxShares / 100 || 0.0001}
                              value={parseFloat(redeemShares) || 0}
                              onChange={(e) => setRedeemShares(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full h-1 bg-[#1E2229] rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#C8963C]"
                            />
                            <div className="flex justify-between text-[10px] text-[#7A838D] mt-1">
                              <span>0</span>
                              <button onClick={(e) => { e.stopPropagation(); setRedeemShares((maxShares * 0.25).toFixed(4)) }} className="hover:text-white transition-colors">25%</button>
                              <button onClick={(e) => { e.stopPropagation(); setRedeemShares((maxShares * 0.5).toFixed(4)) }} className="hover:text-white transition-colors">50%</button>
                              <button onClick={(e) => { e.stopPropagation(); setRedeemShares((maxShares * 0.75).toFixed(4)) }} className="hover:text-white transition-colors">75%</button>
                              <button onClick={(e) => { e.stopPropagation(); setRedeemShares(maxShares.toFixed(6)) }} className="hover:text-white transition-colors">MAX</button>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Buy/Sell preview — on-chain */}
                    {(() => {
                      if (tradeAction === 'buy') {
                        const inputAmt = Number(voteAmount) || 0
                        const hasOC = buyPreviewOC.sharesFloat > 0 && !buyPreviewOC.loading
                        const sharesDisplay = hasOC ? buyPreviewOC.sharesFloat : calculateBuy(inputAmt, supportSupply).sharesReceived
                        const avgPrice = hasOC ? buyPreviewOC.avgPrice : (sharesDisplay > 0 ? inputAmt / sharesDisplay : 0)
                        const feeDisplay = hasOC ? buyPreviewOC.fee : (inputAmt * 0.05)
                        return (
                          <div className="space-y-1 mb-3 px-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[#B5BDC6] text-xs">You receive</span>
                              <span className="text-white text-xs font-semibold">
                                {buyPreviewOC.loading ? '...' : inputAmt > 0 ? `${sharesDisplay.toFixed(4)} shares` : '—'}
                              </span>
                            </div>
                            {inputAmt > 0 && !buyPreviewOC.loading && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#7A838D] text-[10px]">Protocol fee</span>
                                  <span className="text-[#7A838D] text-[10px]">{feeDisplay.toFixed(4)} tTRUST</span>
                                </div>
                                {platformFee && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Platform fee ({Number(platformFee.bps) / 100}% + {(Number(platformFee.fixedFee) / 1e18).toFixed(4)})</span>
                                    <span className="text-[#7A838D] text-[10px]">{((inputAmt * Number(platformFee.bps) / 10000) + Number(platformFee.fixedFee) / 1e18).toFixed(4)} tTRUST</span>
                                  </div>
                                )}
                                {sharesDisplay > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Avg price paid</span>
                                    <span className="text-[#7A838D] text-[10px] font-mono">{avgPrice.toFixed(6)} tTRUST/share</span>
                                  </div>
                                )}
                                {onChainPrice != null && sharesDisplay > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Price impact</span>
                                    <span className="text-[#C8963C] text-[10px] font-mono">
                                      {Math.abs(((avgPrice - onChainPrice) / Math.max(onChainPrice, 0.0001)) * 100) < 0.1
                                        ? '< 0.1%'
                                        : `${(((avgPrice - onChainPrice) / Math.max(onChainPrice, 0.0001)) * 100).toFixed(1)}%`
                                      }
                                    </span>
                                  </div>
                                )}
                                {platformFee && (
                                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#1E2229]">
                                    <span className="text-[#B5BDC6] text-[10px] font-medium">Total cost</span>
                                    <span className="text-white text-[10px] font-semibold">{(inputAmt + inputAmt * Number(platformFee.bps) / 10000 + Number(platformFee.fixedFee) / 1e18).toFixed(4)} tTRUST</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      } else {
                        const inputShares = Number(redeemShares) || 0
                        const maxOwned = userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0
                        const validShares = inputShares > 0 && inputShares <= maxOwned
                        const hasOC = sellPreviewOC.assetsFloat > 0 && !sellPreviewOC.loading
                        const netProceeds = hasOC ? sellPreviewOC.assetsFloat : calculateSell(inputShares, supportSupply).netProceeds
                        return (
                          <div className="space-y-1 mb-3 px-1">
                            {inputShares > maxOwned && maxOwned > 0 && (
                              <p className="text-[#f85149] text-[10px] mb-1">Exceeds owned shares ({maxOwned.toFixed(4)})</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[#B5BDC6] text-xs">You receive</span>
                              <span className="text-white text-xs font-bold font-mono">
                                {sellPreviewOC.loading ? '...' : validShares ? `${netProceeds.toFixed(6)} tTRUST` : '—'}
                              </span>
                            </div>
                            {validShares && !sellPreviewOC.loading && (
                              <>
                                {inputShares > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Avg price/share</span>
                                    <span className="text-[#7A838D] text-[10px] font-mono">{(netProceeds / inputShares).toFixed(6)} tTRUST</span>
                                  </div>
                                )}
                                {onChainPrice != null && inputShares > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Price impact</span>
                                    <span className="text-[#f85149] text-[10px] font-mono">
                                      {Math.abs(((netProceeds / inputShares - onChainPrice) / Math.max(onChainPrice, 0.0001)) * 100) < 0.1
                                        ? '< 0.1%'
                                        : `${(((netProceeds / inputShares - onChainPrice) / Math.max(onChainPrice, 0.0001)) * 100).toFixed(1)}%`
                                      }
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      }
                    })()}

                    {/* Action button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (tradeAction === 'buy') {
                          setPendingVote({
                            type: 'trust',
                            agent: selectedAgent,
                            amount: voteAmount,
                            claim: '',
                            claimAtomId: null,
                            counterTermId: null,
                            tripleTermId: null,
                          })
                          setSelectedAgent(null)
                          setShowConfirm(true)
                        } else {
                          setPendingVote({
                            type: 'redeem_trust',
                            agent: selectedAgent,
                            amount: redeemShares,
                            claim: '',
                            claimAtomId: null,
                            counterTermId: null,
                            knownShares: userPosition.forShares ?? undefined,
                          })
                          setSelectedAgent(null)
                          setShowConfirm(true)
                        }
                      }}
                      disabled={
                        (tradeAction === 'buy' && Number(voteAmount) <= 0) ||
                        (tradeAction === 'sell' && (() => {
                          const shares = Number(redeemShares) || 0
                          const maxOwned = userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0
                          return shares <= 0 || shares > maxOwned || maxOwned <= 0
                        })())
                      }
                      className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#2d7a5f] hover:bg-[#34a872]"
                    >
                      {tradeAction === 'buy'
                        ? `Buy Shares${Number(voteAmount) > 0 && buyPreviewOC.sharesFloat > 0 ? ` · get ~${buyPreviewOC.sharesFloat.toFixed(3)}` : ''}`
                        : `Sell ${Number(redeemShares) > 0 ? Number(redeemShares).toFixed(4) : '0'} Shares`
                      }
                    </button>
                    {tradeAction === 'sell' && (
                      <p className="text-[10px] text-[#4A5260] text-center mt-2 leading-relaxed">
                        Proceeds shown are UI estimates. Actual tTRUST received is determined by the Intuition MultiVault contract on-chain.
                      </p>
                    )}
                    </>

                  </>
                ) : (
                  // Leads somewhere (Etap 5a): the app's connect modal; this panel stays open behind it.
                  <button
                    type="button"
                    onClick={() => openConnectModal({ reason: `Connect a wallet to back ${getAgentNameFromAtom(selectedAgent)}.` })}
                    className="w-full p-4 bg-[#171A1D] border border-[#C8963C]/25 rounded-xl text-center hover:bg-[#C8963C]/10 transition-colors"
                  >
                    <p className="text-[#C8963C] font-semibold mb-1">Connect wallet to back</p>
                    <p className="text-xs text-[#7A838D]">Intuition Testnet · Chain ID {intuitionTestnet.id}</p>
                  </button>
                )}
              </BackThisAgentSection>

              {/* === YOUR HOLDINGS === */}
              {isConnected && (userPosition.forShares || userPosition.againstShares) && (() => {
                const forSf = userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0
                const agaSf = userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0
                const forVal = forSf > 0 ? (onChainPrice ? forSf * onChainPrice : getSellProceeds(forSf, supportSupply)) : 0
                const agaVal = agaSf > 0 ? getSellProceeds(agaSf, opposeSupply) : 0
                const totalVal = forVal + agaVal
                return (
                  <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">Your Holdings</p>
                      <span className="text-white text-xs font-bold">
                        ≈ {totalVal.toFixed(4)} <span className="text-[#B5BDC6] font-normal">tTRUST</span>
                      </span>
                    </div>
                    <div className="space-y-2">
                      {forSf > 0 && (
                        <div className="flex items-center justify-between bg-[#2d7a5f10] border border-[#2d7a5f30] rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#34a872] flex-shrink-0" />
                            <div>
                              <p className="text-[#34a872] text-xs font-semibold">Stake</p>
                              <p className="text-[#7A838D] text-[10px]">Atom vault</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-xs font-bold">{forSf.toFixed(4)} <span className="text-[#7A838D] font-normal text-[10px]">shares</span></p>
                            <p className="text-[#34a872] text-[10px] font-semibold">≈ {forVal.toFixed(4)} tTRUST</p>
                          </div>
                        </div>
                      )}
                      {agaSf > 0 && (
                        <div className="flex items-center justify-between bg-[#8b3a3a10] border border-[#8b3a3a30] rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#c45454] flex-shrink-0" />
                            <div>
                              <p className="text-[#c45454] text-xs font-semibold">Legacy Oppose</p>
                              <p className="text-[#7A838D] text-[10px]">AGAINST vault (use Claims)</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-xs font-bold">{agaSf.toFixed(4)} <span className="text-[#7A838D] font-normal text-[10px]">shares</span></p>
                            <p className="text-[#c45454] text-[10px] font-semibold">≈ {agaVal.toFixed(4)} tTRUST</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* === DETAILS — collapsed: the Atom ID, the ERC-8004 id and the backing score's parts
                  (Trust Score / Composite / Hybrid, the stake split, the time-weighted ratio and the
                  composite's pillars). Shared with /agents/[id]; none of it is the headline (Etap 5b). */}
              <AgentDetails termId={selectedAgent.term_id} caipIdentity={selectedAgent.caipIdentity} className="mb-3">
                <ScoreParts view={{
                  trustScore: measuredScore(agentTrust, modalMeasured),
                  composite: compositeTrust ? compositeTrust.score : null,
                  hybrid: hybridScore,
                  supportWei: agentTrust ? agentTrust.supportStake : null,
                  opposeWei: agentTrust ? agentTrust.opposeStake : null,
                  // Support share exists only when there is stake to share (no 100% of nothing).
                  supportPct: modalMeasured && agentTrust ? Number((agentTrust.supportStake * 1000n) / agentTrust.totalStake) / 10 : null,
                  weighted: weightedTrust
                    ? { ratio: weightedTrust.weightedRatio, raw: weightedTrust.rawRatio, fresh: weightedTrust.freshSignalsCount, total: weightedTrust.totalSignalsCount }
                    : null,
                  pillars: compositeTrust ? [
                    { label: 'Signal Ratio', value: compositeTrust.breakdown.signalScore, weight: Math.round(COMPOSITE_WEIGHTS.SIGNAL_RATIO * 100) },
                    { label: 'Staker Diversity', value: compositeTrust.breakdown.stakerScore, weight: Math.round(COMPOSITE_WEIGHTS.STAKERS * 100) },
                    { label: 'Stability', value: compositeTrust.breakdown.stabilityScore, weight: Math.round(COMPOSITE_WEIGHTS.STABILITY * 100) },
                    { label: 'Price Retention', value: compositeTrust.breakdown.priceScore, weight: Math.round(COMPOSITE_WEIGHTS.PRICE_RETENTION * 100) },
                  ] : null,
                }} />
              </AgentDetails>

              {/* === AGENT CARD (metadata) === */}
              {(() => {
                const card = parseAgentCard(effectiveLabel(selectedAgent))
                const hasMetadata = !!(
                  card.description || card.category || card.endpoints || card.source || card.social
                )
                if (!hasMetadata) return null

                const completeness = calculateProfileCompleteness({ name: card.name || getAgentNameFromAtom(selectedAgent), ...card })
                const categoryInfo = card.category ? AGENT_CATEGORIES.find(c => c.id === card.category) : null

                const LinkItem = ({ href, label }: { href: string; label: string }) => (
                  <a
                    href={href.startsWith('http') ? href : `https://${href}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#C8963C] hover:text-[#E8B84B] transition-colors text-xs truncate"
                  >
                    <span className="truncate">{label}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                )

                const ep = card.endpoints || {}
                const src = card.source || {}
                const soc = card.social || {}
                const hasEndpoints = ep.api || ep.mcp || ep.a2aCard || ep.website || ep.docs
                const hasSource    = src.github || src.version || src.license || src.framework
                const hasSocial    = soc.twitter || soc.discord || soc.telegram

                return (
                  <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-5 mb-3">
                    <h3 className="text-white font-bold text-sm mb-3">Agent Card</h3>

                    <div className="space-y-3">
                      {/* Description + category */}
                      {card.description && (
                        <p className="text-[#B5BDC6] text-xs leading-relaxed">
                          {card.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {categoryInfo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C8963C15] text-[#C8963C] border border-[#C8963C25] font-medium">
                            {categoryInfo.icon} {categoryInfo.label}
                          </span>
                        )}
                        {src.version && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E2229] text-[#7A838D] border border-[#2A3040]">
                            {src.version}
                          </span>
                        )}
                        {src.license && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E2229] text-[#7A838D] border border-[#2A3040]">
                            {src.license}
                          </span>
                        )}
                        {src.framework && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E2229] text-[#7A838D] border border-[#2A3040]">
                            {src.framework}
                          </span>
                        )}
                        {completeness.isA2AReady && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2ECC7115] text-[#2ECC71] border border-[#2ECC7125] font-bold">
                            A2A Ready
                          </span>
                        )}
                      </div>

                      {/* Endpoints */}
                      {hasEndpoints && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-[#7A838D] uppercase tracking-wider font-semibold">Endpoints</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {ep.api    && <LinkItem href={ep.api}    label={`API: ${ep.api.replace(/^https?:\/\//, '')}`} />}
                            {ep.mcp    && <LinkItem href={ep.mcp}    label={`MCP: ${ep.mcp.replace(/^https?:\/\//, '')}`} />}
                            {ep.a2aCard && <LinkItem href={ep.a2aCard} label="A2A Card" />}
                            {ep.website && <LinkItem href={ep.website} label={`Web: ${ep.website.replace(/^https?:\/\//, '')}`} />}
                            {ep.docs   && <LinkItem href={ep.docs}   label={`Docs: ${ep.docs.replace(/^https?:\/\//, '')}`} />}
                          </div>
                        </div>
                      )}

                      {/* Source */}
                      {hasSource && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-[#7A838D] uppercase tracking-wider font-semibold">Source</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {src.github && <LinkItem href={src.github} label={src.github} />}
                          </div>
                        </div>
                      )}

                      {/* Social */}
                      {hasSocial && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-[#7A838D] uppercase tracking-wider font-semibold">Social</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {soc.twitter  && <LinkItem href={`https://x.com/${soc.twitter.replace('@','')}`} label={soc.twitter.startsWith('@') ? soc.twitter : `@${soc.twitter}`} />}
                            {soc.discord  && <LinkItem href={soc.discord.startsWith('http') ? soc.discord : `https://${soc.discord}`} label="Discord" />}
                            {soc.telegram && <LinkItem href={soc.telegram.startsWith('http') ? soc.telegram : `https://t.me/${soc.telegram.replace('@','')}`} label={soc.telegram} />}
                          </div>
                        </div>
                      )}

                      {/* Profile Completeness */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-[#7A838D]">Profile</span>
                          <span className="text-[#B5BDC6] font-medium">{completeness.percentage}% complete</span>
                        </div>
                        <div className="h-1 bg-[#1E2229] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${completeness.percentage}%`,
                              background: completeness.percentage > 60 ? '#2ECC71' : completeness.percentage > 30 ? '#EAB308' : '#EF4444',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* === TABS: Overview / Attestations / Activity / Timeline ===
                  Every tab stays reachable at 390 px (4b-list §6 #1): on phones the four share the
                  row (icon over label, ≥44 px tall); on the narrowest ones the strip scrolls sideways
                  instead of clipping. Each tab's content renders inside this card. */}
              <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl mb-3">
                <div
                  ref={modalTabsRef}
                  role="tablist"
                  aria-label="Agent details"
                  className="relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_rgba(200,150,60,0.12)]"
                >
                  {[
                    { id: 'overview', label: 'Overview', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg> },
                    { id: 'attestations', label: PEOPLE_TAB, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                    { id: 'activity', label: 'Activity', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                    { id: 'timeline', label: 'Timeline', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="4" r="1.5" fill="currentColor" fillOpacity="0.5"/><circle cx="12" cy="20" r="1.5" fill="currentColor" fillOpacity="0.5"/><path d="M12 6v4M12 14v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 8h3M14 8h3M7 16h3M14 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5"/></svg> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex flex-1 min-w-fit sm:flex-none flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[48px] px-2 sm:px-5 py-2 sm:py-3.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                        activeTab === tab.id
                          ? 'text-white border-[#34a872]'
                          : 'text-[#B5BDC6] border-transparent hover:text-white hover:border-[#C8963C]/25'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (() => {
                  const t = agentTrust
                  // null → "—": loading, vault never read, or zero stake (the 50 prior).
                  const score = measuredScore(t, modalMeasured)
                  // A support/oppose split exists only when there is stake to split.
                  const supportPct = modalMeasured && t ? Number((t.supportStake * 100n) / t.totalStake) : null
                  const opsPct = supportPct != null ? 100 - supportPct : null


                  const ageDays = Math.floor((Date.now() - new Date(selectedAgent.created_at).getTime()) / 86400000)
                  const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1 day' : `${ageDays} days`

                  return (
                  <div className="p-5 space-y-5">
                    {/* Backing trend — momentum and the recent support share. The backing score itself
                        is in the header; its parts (Trust Score, time-weighted, Composite) are under
                        Details. No level words next to a number (Etap 5b). */}
                    {(() => {
                      // Only for a measured score: at zero stake "Stable" would describe the prior.
                      const momentum = score != null ? t!.momentum : null
                      const mi = getMomentumIndicator(momentum ?? 0)
                      const sparkData = buildTrustChartData(agentSignals, agentTriple.counterTermId)
                        .map((d: { trustRatio: number }) => d.trustRatio)
                        .slice(-10)
                      if (momentum == null && sparkData.length < 2) return null
                      return (
                        <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4" data-testid="backing-trend">
                          <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">{BACKING_TREND}</p>
                          {momentum != null && (
                            <div
                              className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg mb-3"
                              style={{ background: `${mi.color}15`, border: `1px solid ${mi.color}45` }}
                            >
                              <span className="text-2xl leading-none" style={{ color: mi.color }}>{mi.arrow}</span>
                              <span className="text-base font-semibold leading-none" style={{ color: mi.color }}>{mi.label}</span>
                              {momentum !== 0 && (
                                <span
                                  className="text-xs font-medium pl-2 border-l leading-none"
                                  style={{ color: `${mi.color}bb`, borderColor: `${mi.color}40` }}
                                >
                                  {momentum > 0 ? '+' : ''}{momentum.toFixed(1)} pts
                                </span>
                              )}
                            </div>
                          )}
                          {sparkData.length >= 2 && (
                            <div className="flex items-center gap-2">
                              <TrustSparkline datapoints={sparkData} color="#7A838D" width={110} height={22} />
                              <span className="text-[10px] text-white/25 tracking-wide">7d trend</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Support vs Oppose breakdown */}
                    <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                      <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Community Sentiment</p>

                      {/* Stacked bar */}
                      <div className="w-full h-3 bg-[#1E2229] rounded-full overflow-hidden flex mb-2">
                        {supportPct != null && supportPct > 0 && (
                          <div className="h-full bg-[#34a872] transition-all duration-500" style={{ width: `${supportPct}%` }} />
                        )}
                        {opsPct != null && opsPct > 0 && (
                          <div className="h-full bg-[#c45454] transition-all duration-500" style={{ width: `${opsPct}%` }} />
                        )}
                      </div>

                      {/* Amounts: "—" only while loading / never read; a read of 0 prints 0. */}
                      <div className="flex justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#34a872]" />
                          <span className="text-white text-xs font-medium">{supportPct != null ? `${supportPct}%` : '—'} Support</span>
                          <span className="text-[#7A838D] text-[10px]">({t ? (Number(t.supportStake) / 1e18).toFixed(4) : '—'} tTRUST)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#7A838D] text-[10px]">({t ? (Number(t.opposeStake) / 1e18).toFixed(4) : '—'} tTRUST)</span>
                          <span className="text-white text-xs font-medium">{opsPct != null ? `${opsPct}%` : '—'} Oppose</span>
                          <div className="w-2.5 h-2.5 rounded-full bg-[#c45454]" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0F1113] rounded-lg p-2.5 text-center">
                          <p className="text-white text-sm font-bold">{t ? (Number(t.totalStake) / 1e18).toFixed(4) : '—'}</p>
                          <p className="text-[#7A838D] text-[10px]">Total TVL</p>
                        </div>
                        <div className="bg-[#0F1113] rounded-lg p-2.5 text-center">
                          <p className={`text-sm font-bold ${!t || t.netStake >= 0n ? 'text-[#34a872]' : 'text-[#c45454]'}`}>
                            {t ? `${t.netStake >= 0n ? '+' : ''}${(Number(t.netStake) / 1e18).toFixed(4)}` : '—'}
                          </p>
                          <p className="text-[#7A838D] text-[10px]">Net Stake</p>
                        </div>
                        <div className="bg-[#0F1113] rounded-lg p-2.5 text-center">
                          <p className="text-white text-sm font-bold">{t ? `${(t.confidence * 100).toFixed(0)}%` : '—'}</p>
                          <p className="text-[#7A838D] text-[10px]">Confidence</p>
                        </div>
                      </div>
                    </div>

                    {/* Legacy skill claims — pre-canonical hasAgentSkill / isTrustedFor
                        triples with real stake (9 on testnet). Kept and labeled honestly,
                        demoted below ATTESTED (which now lives in the header). The old
                        empty state pointed users at the dead predicate — removed. */}
                    {skillBreakdown && (
                      <SkillBreakdown
                        skills={skillBreakdown.skills}
                        overallScore={skillBreakdown.overallScore}
                        title="Legacy skill claims"
                        subtitle={LEGACY_CLAIMS_NOTE}
                      />
                    )}

                    {/* Agent Radar — skill spider chart (3+ skills only) */}
                    {skillBreakdown && skillBreakdown.skills.length >= 3 && (
                      <AgentRadar skills={skillBreakdown.skills} />
                    )}

                    {/* Declared domains moved to the modal header (ETAP 3 hierarchy:
                        directly under ATTESTED) — see <DeclaredDomains /> above the tabs. */}

                    {/* Bonding Curve Charts */}
                    <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                      <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Bonding Curves</p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Support curve */}
                        {(() => {
                          const data = generateCurveData(supportSupply)
                          const localPrice = getCurrentPrice(supportSupply)
                          const chartPrice = onChainPrice ?? localPrice
                          return (
                            <div>
                              <p className="text-[#34a872] text-[10px] font-bold mb-2 uppercase">Support</p>
                              <div className="h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={data}>
                                    <defs>
                                      <linearGradient id="supportCurveGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34a872" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#34a872" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <XAxis dataKey="supply" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                                    <Tooltip
                                      contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 11 }}
                                      labelStyle={{ color: '#8b949e' }}
                                      formatter={(value: any) => [`${Number(value).toFixed(4)} tTRUST`, 'Price']}
                                      labelFormatter={(label: any) => `Supply: ${label}`}
                                    />
                                    <Area type="monotone" dataKey="price" stroke="#34a872" fillOpacity={1} fill="url(#supportCurveGrad)" strokeWidth={2} />
                                    {supportSupply > 0 && (
                                      <ReferenceDot x={parseFloat(supportSupply.toFixed(4))} y={parseFloat(localPrice.toFixed(6))} r={5} fill="#34a872" stroke="#fff" strokeWidth={2} />
                                    )}
                                    {onChainPrice && supportSupply > 0 && (
                                      <ReferenceLine y={onChainPrice} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'On-chain', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                                    )}
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                              <p className="text-[#7A838D] text-[10px] mt-1">Supply: {supportSupply.toFixed(2)} · Price: {chartPrice.toFixed(4)}{onChainPrice ? ' (on-chain)' : ''}</p>
                            </div>
                          )
                        })()}
                        {/* Oppose curve */}
                        {(() => {
                          if (opposeSupply <= 0) {
                            return (
                              <div>
                                <p className="text-[#c45454] text-[10px] font-bold mb-2 uppercase">Oppose</p>
                                <div className="h-32 flex items-center justify-center rounded-lg" style={{ background: 'rgba(196,84,84,0.04)', border: '1px solid rgba(196,84,84,0.12)' }}>
                                  <p className="text-[#7A838D] text-[10px]">No oppose activity yet</p>
                                </div>
                                <p className="text-[#7A838D] text-[10px] mt-1">Supply: 0 · Price: —</p>
                              </div>
                            )
                          }
                          const data = generateCurveData(opposeSupply)
                          const opposePrice = getCurrentPrice(opposeSupply)
                          return (
                            <div>
                              <p className="text-[#c45454] text-[10px] font-bold mb-2 uppercase">Oppose</p>
                              <div className="h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={data}>
                                    <defs>
                                      <linearGradient id="opposeCurveGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#c45454" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#c45454" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <XAxis dataKey="supply" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                                    <Tooltip
                                      contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 11 }}
                                      labelStyle={{ color: '#8b949e' }}
                                      formatter={(value: any) => [`${Number(value).toFixed(4)} tTRUST`, 'Price']}
                                      labelFormatter={(label: any) => `Supply: ${label}`}
                                    />
                                    <Area type="monotone" dataKey="price" stroke="#c45454" fillOpacity={1} fill="url(#opposeCurveGrad)" strokeWidth={2} />
                                    {opposeSupply > 0 && (
                                      <ReferenceDot x={parseFloat(opposeSupply.toFixed(4))} y={parseFloat(opposePrice.toFixed(6))} r={5} fill="#c45454" stroke="#fff" strokeWidth={2} />
                                    )}
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                              <p className="text-[#7A838D] text-[10px] mt-1">Supply: {opposeSupply.toFixed(2)} · Price: {opposePrice.toFixed(4)}</p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Score Trajectory Chart — real history only; no persisted
                        snapshots exist yet, so this normally shows the honest
                        note rather than a chart (thesis §6). */}
                    {scoreTrajectory.length >= 2 ? (
                      <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4" style={{ height: 200 }}>
                        <ScoreTrajectoryChart
                          scoreHistory={scoreTrajectory}
                          // ≥2 trajectory points only exist for a measured score (scoreTrajectory memo).
                          currentScore={(hybridScore ?? measuredScore(agentTrust, modalMeasured))!}
                        />
                      </div>
                    ) : (
                      <p className="text-[#7A838D] text-[11px] px-1">
                        Score history not yet recorded — historical snapshots aren&apos;t persisted yet.
                      </p>
                    )}

                    {/* Positions Table */}
                    {(() => {
                      if (positionsLoading) return (
                        <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                          <div className="h-16 animate-pulse bg-[#1E2229] rounded-lg" />
                        </div>
                      )
                      if (allPositions.length === 0) return null

                      // Compute total shares for % supply
                      let totalShares = 0n
                      try { totalShares = allPositions.reduce((acc: bigint, p: any) => { try { return acc + BigInt(p.shares || '0') } catch { return acc } }, 0n) } catch { totalShares = 0n }

                      return (
                        <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                          <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">
                            Positions ({combinedStakerCount} staker{combinedStakerCount !== 1 ? 's' : ''})
                          </p>
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[#7A838D] border-b border-[#C8963C]/12">
                                  <th className="text-left py-2 font-medium">Wallet</th>
                                  <th className="text-left py-2 font-medium">Side</th>
                                  <th className="text-right py-2 font-medium">Shares</th>
                                  <th className="text-right py-2 font-medium">Value</th>
                                  <th className="text-right py-2 font-medium">% Supply</th>
                                </tr>
                              </thead>
                              <tbody>
                                {enrichedPositions.map((pos: any, i: number) => {
                                  const isOppose = agentTriple.counterTermId && pos.term_id === agentTriple.counterTermId
                                  let shares = 0n; try { shares = BigInt(pos.shares || '0') } catch { shares = 0n }
                                  const pct = totalShares > 0n ? Number((shares * 10000n) / totalShares) / 100 : 0
                                  const isCreator = selectedAgent.creator?.id &&
                                    pos.account_id?.toLowerCase() === selectedAgent.creator.id.toLowerCase()

                                  return (
                                    <tr key={`${pos.account_id}-${pos.term_id}-${i}`} className="border-b border-[#C8963C]/12/50 hover:bg-[#0F1113]">
                                      <td className="py-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Link href={`/profile/${pos.account_id}`} className="text-[#C8963C] hover:underline">
                                            <PersonName wallet={pos.account_id} label={pos.account?.label} />
                                          </Link>
                                          <EarlySupporterBadge rank={pos.rank} />
                                          {isCreator && (
                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#C8963C]/12 text-[#C8963C] border border-[rgba(200,150,60,0.20)]">
                                              CREATOR
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          isOppose
                                            ? 'bg-[#8b3a3a20] text-[#c45454]'
                                            : 'bg-[#2d7a5f20] text-[#34a872]'
                                        }`}>
                                          {isOppose ? 'Oppose' : 'Support'}
                                        </span>
                                      </td>
                                      <td className="py-2 text-right text-white font-medium">
                                        {(Number(shares) / 1e18).toFixed(4)}
                                      </td>
                                      <td className="py-2 text-right text-[#B5BDC6]">
                                        {(!isOppose && onChainPrice)
                                          ? ((Number(shares) / 1e18) * onChainPrice).toFixed(4)
                                          : getSellProceeds(Number(shares) / 1e18, isOppose ? opposeSupply : supportSupply).toFixed(4)
                                        }
                                      </td>
                                      <td className="py-2 text-right text-[#B5BDC6]">
                                        {pct.toFixed(1)}%
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Your Position */}
                    {isConnected && (
                      <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">Your Position</p>
                          {(() => {
                            const stakedSince = userPosition.rawPositions[0]?.updated_at || null
                            if (!stakedSince) return null
                            const loyalty = getLoyaltyMultiplier(stakedSince)
                            return (
                              <span style={{
                                fontSize:'10px', padding:'2px 7px', borderRadius:'4px',
                                background: `${loyalty.color}15`,
                                color: loyalty.color,
                                border: `1px solid ${loyalty.color}30`,
                                fontWeight: 600,
                              }}>
                                {loyalty.label} · {loyalty.daysStaked}d
                              </span>
                            )
                          })()}
                        </div>
                        {(userPosition.forShares || userPosition.againstShares) ? (
                          <div className="space-y-2">
                            {userPosition.forShares && Number(userPosition.forShares) > 0 && (() => {
                              const sharesFloat = Number(userPosition.forShares) / 1e18
                              const value = onChainPrice ? sharesFloat * onChainPrice : getSellProceeds(sharesFloat, supportSupply)
                              return (
                              <div className="bg-[#2d7a5f15] border border-[#2d7a5f30] rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#34a872]" />
                                    <span className="text-[#34a872] text-xs font-medium">Support</span>
                                  </div>
                                  <span className="text-white text-xs font-bold">
                                    {sharesFloat.toFixed(4)} shares
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[#7A838D] text-[10px]">Current Value</span>
                                  <span className="text-[#34a872] text-[10px] font-semibold">{value.toFixed(4)} tTRUST</span>
                                </div>
                              </div>
                              )
                            })()}
                            {userPosition.againstShares && Number(userPosition.againstShares) > 0 && (() => {
                              const sharesFloat = Number(userPosition.againstShares) / 1e18
                              const value = getSellProceeds(sharesFloat, opposeSupply) // oppose vault — no on-chain price yet
                              return (
                              <div className="bg-[#8b3a3a15] border border-[#8b3a3a30] rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#c45454]" />
                                    <span className="text-[#c45454] text-xs font-medium">Oppose</span>
                                  </div>
                                  <span className="text-white text-xs font-bold">
                                    {sharesFloat.toFixed(4)} shares
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[#7A838D] text-[10px]">Current Value</span>
                                  <span className="text-[#c45454] text-[10px] font-semibold">{value.toFixed(4)} tTRUST</span>
                                </div>
                              </div>
                              )
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-3 bg-[#0F1113] rounded-lg">
                            <p className="text-[#7A838D] text-xs">You haven't staked on this agent yet</p>
                            <p className="text-[#B5BDC6] text-[10px] mt-0.5">Use the Bonding Curve Market above to take a position</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reports moved to the modal header (<ReportsSection />, collapsed,
                        with an honest "No reports on-chain" line) — ETAP 3. */}

                    {/* Agent Details */}
                    <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                      <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Details</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <div>
                          <p className="text-[#7A838D] text-[10px] mb-0.5">Platform</p>
                          <p className="text-white text-xs font-medium">AgentScore</p>
                        </div>
                        {[
                          { label: 'Agent Age', value: ageLabel },
                          { label: 'First Seen', value: formatDate(selectedAgent.created_at) },
                          { label: 'Stakers', value: String(combinedStakerCount) },
                        ].map((item, i) => (
                          <div key={i}>
                            <p className="text-[#7A838D] text-[10px] mb-0.5">{item.label}</p>
                            <p className="text-white text-xs font-medium">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#C8963C]/12">
                        <div className="flex gap-2 flex-wrap">
                          {['AI Agent', selectedAgent.type || 'General'].map((tag, i) => (
                            <span key={i} className="px-2.5 py-0.5 bg-[rgba(200,150,60,0.10)] border border-[rgba(200,150,60,0.20)] rounded-full text-[#C8963C] text-[10px] font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })()}

                {/* Attestations Tab — aggregated per profile */}
                {activeTab === 'attestations' && (() => {
                  const profileMap = new Map<string, {
                    label: string
                    accountId: string
                    supportCount: number
                    opposeCount: number
                    totalSignals: number
                    netShares: number
                    lastSeen: string
                  }>()

                  for (const signal of agentSignals) {
                    const key = signal.account_id || 'unknown'
                    const existing = profileMap.get(key)
                    const delta = Number(signal.delta || 0) / 1e18
                    const isDeposit = !!signal.deposit_id
                    const isAgainst = agentTriple.counterTermId
                      ? signal.term_id === agentTriple.counterTermId
                      : false
                    const signed = isDeposit ? delta : -delta

                    if (!existing) {
                      profileMap.set(key, {
                        label: signal.account?.label || key,
                        accountId: key,
                        supportCount: (!isAgainst && isDeposit) ? 1 : 0,
                        opposeCount: (isAgainst && isDeposit) ? 1 : 0,
                        totalSignals: 1,
                        netShares: isAgainst ? -signed : signed,
                        lastSeen: signal.created_at,
                      })
                    } else {
                      if (!isAgainst && isDeposit) existing.supportCount++
                      if (isAgainst && isDeposit) existing.opposeCount++
                      existing.totalSignals++
                      existing.netShares += isAgainst ? -signed : signed
                      if (signal.created_at > existing.lastSeen) existing.lastSeen = signal.created_at
                    }
                  }

                  // Backers are wallets holding a live position now (lib/live-position.ts): a wallet
                  // that sold out stays in the Activity history, not in this list or its count.
                  const liveWallets = positionsKnown
                    ? liveStakerWallets(allPositions, [selectedAgent.term_id, agentTriple.counterTermId])
                    : null
                  const profiles = Array.from(profileMap.values())
                    .filter(p => liveWallets == null || liveWallets.has(p.accountId.toLowerCase()))
                    .sort((a, b) => b.totalSignals - a.totalSignals)

                  const uniqueStakers = liveWallets == null ? null : profiles.length

                  return (
                  <div className="p-5">
                    {/* ETAP 3: attesters from the canonical unit FIRST; the signal-based
                        list below is BACKERS (positions on this agent) — a different claim. */}
                    <AttestersList
                      attesters={profileVector.attested ? summarizeAttesters(profileVector.attested) : null}
                      loading={!profileLoaded}
                      className="mb-6"
                    />
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-semibold text-sm">{BACKERS_HEADING}</h4>
                        <span className="text-[10px] text-[#7A838D]">{BACKERS_NOTE}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#34a872] animate-pulse" />
                          <span className="text-xs text-[#B5BDC6]">live</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#B5BDC6] bg-[#1E2229] px-2 py-1 rounded-full">
                        {uniqueStakers ?? '—'} profile{uniqueStakers !== 1 ? 's' : ''} · {signalsUnread ? '—' : agentSignalsCount} signal{agentSignalsCount !== 1 || signalsUnread ? 's' : ''}
                      </span>
                    </div>

                    {signalsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-16 bg-[#171A1D] border border-[#C8963C]/12 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : profiles.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-12 h-12 rounded-full bg-[#1E2229] flex items-center justify-center mx-auto mb-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#B5BDC6" strokeWidth="2"/>
                          </svg>
                        </div>
                        <p className="text-[#B5BDC6] text-sm">{BACKERS_EMPTY}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {profiles.map((profile) => {
                          const netPositive = profile.netShares >= 0
                          const lastDate = formatDate(profile.lastSeen)

                          return (
                            <Link
                              key={profile.accountId}
                              href={`/profile/${profile.accountId}`}
                              className="flex items-center justify-between p-3.5 bg-[#171A1D] border border-[#C8963C]/12 rounded-xl hover:border-[#C8963C]/25 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    backgroundColor: netPositive ? '#2d7a5f20' : '#8b3a3a20',
                                    border: `1px solid ${netPositive ? '#2d7a5f30' : '#8b3a3a30'}`
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
                                      stroke={netPositive ? '#34a872' : '#c45454'}
                                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-white text-sm font-medium hover:text-[#C8963C] transition-colors"><PersonName wallet={profile.accountId} label={profile.label} /></p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {profile.supportCount > 0 && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2d7a5f20] text-[#34a872]">
                                        ↑ {profile.supportCount} Support
                                      </span>
                                    )}
                                    {profile.opposeCount > 0 && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#8b3a3a20] text-[#c45454]">
                                        ↓ {profile.opposeCount} Oppose
                                      </span>
                                    )}
                                    <span className="text-[#7A838D] text-[10px]">{lastDate}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-white text-sm font-bold">{profile.totalSignals}</p>
                                <p className="text-[#7A838D] text-[10px]">signal{profile.totalSignals !== 1 ? 's' : ''}</p>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  )
                })()}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-semibold">Activity</h4>
                      <span className="text-xs text-[#B5BDC6] bg-[#1E2229] px-2 py-1 rounded-full">
                        {signalsUnread ? '—' : agentSignalsCount + 1} event{agentSignalsCount !== 0 || signalsUnread ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-0">
                      {/* Registration event - always first */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-[#C8963C]/12 border border-[#1f6feb40] flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                                stroke="#C8963C" strokeWidth="2"/>
                            </svg>
                          </div>
                          {agentSignals.length > 0 && (
                            <div className="w-px flex-1 bg-[#1E2229] my-1" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="text-white text-sm font-medium">Agent Registered</p>
                          <p className="text-[#B5BDC6] text-xs mt-0.5">
                            Registered on Intuition Protocol
                          </p>
                          <p className="text-[#B5BDC6] text-xs mt-1">
                            {formatDate(selectedAgent.created_at, 'long')}
                          </p>
                        </div>
                      </div>

                      {signalsLoading ? (
                        <div className="space-y-2 ml-11">
                          {[1, 2].map(i => (
                            <div key={i} className="h-10 bg-[#171A1D] border border-[#C8963C]/12 rounded-lg animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        [...agentSignals].reverse().map((signal, i) => {
                          const isDeposit = !!signal.deposit_id
                          const isAgainst = agentTriple.counterTermId
                            ? signal.term_id === agentTriple.counterTermId
                            : false
                          const delta = Number(signal.delta || 0)
                          const sharesDisplay = (delta / 1e18).toFixed(4)
                          const isFeeProxy = signal.account_id?.toLowerCase() === '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41'
                          const isLast = i === agentSignals.length - 1

                          const actionLabel = !isDeposit
                            ? (isAgainst ? 'Sell Oppose' : 'Sell Support')
                            : (isAgainst ? 'Buy Oppose' : 'Buy Support')
                          const dotColor = !isDeposit
                            ? (isAgainst ? '#34a872' : '#c45454')
                            : (isAgainst ? '#c45454' : '#34a872')

                          return (
                            <div key={signal.id || i} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${dotColor}20`, border: `1px solid ${dotColor}40` }}
                                >
                                  {isDeposit ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                      <path d="M12 5v14M5 12l7 7 7-7" stroke={dotColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                      <path d="M12 19V5M5 12l7-7 7 7" stroke={dotColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                                {!isLast && <div className="w-px flex-1 bg-[#1E2229] my-1" />}
                              </div>
                              <div className="pb-4">
                                <p className="text-white text-sm font-medium">
                                  {actionLabel}
                                  <span className="text-[#B5BDC6] font-normal ml-1.5">by </span>
                                  {signal.account_id && !isFeeProxy ? (
                                    <Link
                                      href={`/profile/${signal.account_id}`}
                                      className="text-[#C8963C] font-normal hover:underline"
                                    >
                                      <PersonName wallet={signal.account_id} label={signal.account?.label} />
                                    </Link>
                                  ) : (
                                    <span className="text-[#7A838D] font-normal">{isFeeProxy ? 'via AgentScore' : '?'}</span>
                                  )}
                                </p>
                                <p style={{ color: dotColor }} className="text-xs font-medium mt-0.5">
                                  {isDeposit ? '+' : '-'}{sharesDisplay} shares
                                </p>
                                <p className="text-[#B5BDC6] text-xs mt-0.5">
                                  {formatDate(signal.created_at, 'long')}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {!signalsLoading && agentSignals.length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-[#B5BDC6] text-sm">{signalsUnread ? 'Couldn’t read the activity right now — try again in a minute.' : 'No staking activity yet'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && selectedAgent && (() => {
                  const agentCard = parseAgentCard(effectiveLabel(selectedAgent))
                  const completeness = calculateProfileCompleteness({ name: agentCard.name ?? '', ...agentCard })
                  const score = hybridScore ?? measuredScore(agentTrust, modalMeasured)
                  const tier = agentTier?.tier ?? null
                  return (
                    <TrustTimeline
                      tierMilestones="none"
                      agentId={selectedAgent.term_id}
                      agentName={agentCard.name ?? getAgentNameFromAtom(selectedAgent)}
                      createdAt={selectedAgent.created_at}
                      currentScore={score}
                      currentTier={tier}
                      agentSignals={agentSignals}
                      counterTermId={agentTriple.counterTermId}
                      skillTriples={skillTriples}
                      evaluatorWeights={evaluatorWeights}
                      isA2AReady={completeness.isA2AReady}
                    />
                  )
                })()}
              </div>

              {/* === REPORT SECTION === */}
              {isConnected && (
                <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold text-sm">Something wrong?</h4>
                      <p className="text-[#7A838D] text-xs mt-0.5">
                        Report this agent if you believe it's malicious or misleading.
                        {reportCount > 0 && (
                          <span className="text-[#f97316] ml-1">{reportCount} report{reportCount !== 1 ? 's' : ''} filed</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-[#f9731615] border border-[#f9731630] text-[#f97316] hover:bg-[#f9731625]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Report Agent
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Backdrop click to close */}
          <div className="fixed inset-0 top-[64px] -z-10" onClick={() => setSelectedAgent(null)} />
        </div>
      )}

      {/* Mobile: Attest always in viewport while the agent modal is open —
          sibling of the modal so taps don't bubble into the backdrop-close */}
      {selectedAgent && (
        <AttestStickyBar
          agentId={selectedAgent.term_id}
          agentName={getAgentNameFromAtom(selectedAgent)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="9" x2="12" y2="13" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Report Agent
                </h2>
                <p className="text-[#B5BDC6] text-sm">
                  Report <span className="text-white font-medium">{getAgentNameFromAtom(selectedAgent)}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowReportModal(false); setReportReason('') }}
                className="w-8 h-8 rounded-lg bg-[#1E2229] hover:bg-[#252B33] flex items-center justify-center transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#B5BDC6" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Category selection */}
            <div className="mb-4">
              <p className="text-white text-sm font-medium mb-2">Report Category</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'scam' as const, label: 'Scam / Fraud', icon: '🚨', desc: 'Deceptive or fraudulent behavior' },
                  { id: 'spam' as const, label: 'Spam', icon: '📢', desc: 'Unwanted or repetitive content' },
                  { id: 'prompt_injection' as const, label: 'Prompt Injection', icon: '💉', desc: 'Manipulates other AI systems' },
                  { id: 'impersonation' as const, label: 'Impersonation', icon: '🎭', desc: 'Pretends to be another agent' },
                ]).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setReportCategory(cat.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      reportCategory === cat.id
                        ? 'bg-[#f9731615] border-[#f97316] ring-1 ring-[#f9731640]'
                        : 'bg-[#171A1D] border-[#C8963C]/12 hover:border-[#C8963C]/25'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{cat.icon}</span>
                      <span className={`text-xs font-bold ${reportCategory === cat.id ? 'text-[#f97316]' : 'text-white'}`}>
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-[#7A838D] text-[10px] leading-tight">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="mb-4">
              <p className="text-white text-sm font-medium mb-2">Description <span className="text-[#7A838D] font-normal">(optional)</span></p>
              <textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                placeholder="Describe what happened or why you're reporting this agent..."
                rows={3}
                maxLength={200}
                className="w-full bg-[#171A1D] border border-[#C8963C]/12 rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#6b7280] focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f9731640] resize-none"
              />
              <p className="text-[#7A838D] text-[10px] text-right mt-1">{reportReason.length}/200</p>
            </div>

            {/* Cost notice */}
            <div className="bg-[#f9731610] border border-[#f9731625] rounded-lg px-3 py-2 mb-4">
              <p className="text-[#f97316] text-xs">
                <strong>On-chain report:</strong> Submitting this report creates an on-chain report triple and costs ~0.03 tTRUST (atom creation + triple deposit).
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowReportModal(false); setReportReason('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#B5BDC6] bg-[#171A1D] border border-[#C8963C]/12 hover:border-[#C8963C]/25 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: '#f97316', border: '1px solid #f9731680' }}
              >
                {reportSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Submitting...
                  </span>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Selection Modal */}
      {showClaimSelect && pendingVote && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-6 max-w-lg w-full shadow-2xl">

            {/* Header */}
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white mb-1">
                Select a Claim
              </h2>
              <p className="text-[#B5BDC6] text-sm">
                Choose what you want to attest about{' '}
                <span className="text-white font-medium">
                  {getAgentNameFromAtom(pendingVote.agent)}
                </span>
              </p>
            </div>

            {/* Loading State */}
            {claimsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#34a872] border-t-transparent mr-3" />
                <span className="text-[#B5BDC6]">Loading claims from graph...</span>
              </div>
            )}

            {/* Claims List */}
            {!claimsLoading && claims.length > 0 && (
              <div className="space-y-2 mb-5 max-h-[400px] overflow-y-auto">
                {claims.map((claim, idx) => (
                  <button
                    key={claim.term_id || claim.label}
                    onClick={() => {
                      setPendingVote(prev => prev ? {
                        ...prev,
                        claim: claim.label,
                        claimAtomId: claim.term_id || null
                      } : prev)
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: pendingVote.claim === claim.label
                        ? (pendingVote.type === 'trust' ? '#2d7a5f' : '#8b3a3a')
                        : '#21262d',
                      backgroundColor: pendingVote.claim === claim.label
                        ? (pendingVote.type === 'trust' ? 'rgba(200,150,60,0.08)' : 'rgba(139,58,58,0.12)')
                        : '#161b22',
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">
                          {claim.label}
                        </span>
                        {claim.term_id && (
                          <span className="px-2 py-0.5 bg-[#C8963C]/8 border border-[#C8963C]/20 rounded-full text-[#C8963C] text-xs font-medium">
                            On-chain
                          </span>
                        )}
                      </div>
                      {claim.creator && (
                        <p className="text-[#B5BDC6] text-xs">
                          Created by {claim.creator.label?.replace('.eth', '') || 'unknown'}
                        </p>
                      )}
                      {claim.positions_aggregate?.aggregate?.count > 0 && (
                        <p className="text-[#B5BDC6] text-xs mt-1">
                          {claim.positions_aggregate.aggregate.count} position{claim.positions_aggregate.aggregate.count === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                    {pendingVote.claim === claim.label && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                        <path d="M20 6L9 17l-5-5" stroke={pendingVote.type === 'trust' ? '#2d7a5f' : '#8b3a3a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!claimsLoading && claims.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-[#1E2229] flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#B5BDC6" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="#B5BDC6" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="#B5BDC6" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[#B5BDC6] text-sm">No claims found</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowClaimSelect(false)
                  setPendingVote(null)
                }}
                className="flex-1 py-3 bg-[#1E2229] hover:bg-[#252B33] rounded-xl text-[#B5BDC6] hover:text-white font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!pendingVote?.claim) return
                  setShowClaimSelect(false)
                  setShowConfirm(true)
                }}
                disabled={!pendingVote?.claim}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  backgroundColor: pendingVote?.claim
                    ? (pendingVote.type === 'trust' ? '#1a7f54' : '#b91c1c')
                    : '#21262d',
                  color: pendingVote?.claim ? 'white' : '#8b949e',
                  cursor: pendingVote?.claim ? 'pointer' : 'not-allowed',
                }}
              >
                Continue
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && pendingVote && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-6 max-w-sm w-full shadow-2xl">

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: pendingVote.type === 'trust' ? '#1a7f5420' : '#8b3a3a20',
                  border: `1px solid ${pendingVote.type === 'trust' ? '#1a7f5440' : '#8b3a3a40'}`
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                    stroke={pendingVote.type === 'trust' ? '#34a872' : '#cd5c5c'}
                    strokeWidth="2"
                    fill={pendingVote.type === 'trust' ? '#34a87220' : '#cd5c5c20'}
                  />
                  {pendingVote.type !== 'trust' && (
                    <path d="M15 9l-6 6M9 9l6 6"
                      stroke="#cd5c5c" strokeWidth="1.5" strokeLinecap="round"/>
                  )}
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white text-center mb-1">
              {pendingVote.type === 'trust' ? 'Confirm Trust (FOR)'
                : pendingVote.type === 'distrust' ? 'Confirm Untrust (AGAINST)'
                : pendingVote.type === 'redeem_trust' ? 'Redeem FOR Shares'
                : 'Redeem AGAINST Shares'}
            </h2>
            <p className="text-[#B5BDC6] text-sm text-center mb-6">
              Review your signal before confirming
            </p>

            {/* Details */}
            <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl overflow-hidden mb-5">
              <div className="flex justify-between items-center px-4 py-3 border-b border-[#C8963C]/12">
                <span className="text-[#B5BDC6] text-sm">Agent</span>
                <span className="text-white text-sm font-semibold text-right max-w-[180px] truncate">
                  {getAgentNameFromAtom(pendingVote.agent)}
                </span>
              </div>

              {pendingVote.claim && pendingVote.type !== 'redeem_trust' && pendingVote.type !== 'redeem_distrust' && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#C8963C]/12">
                  <span className="text-[#B5BDC6] text-sm">Claim</span>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-white text-sm font-semibold">
                      {pendingVote.claim}
                    </span>
                    {pendingVote.claimAtomId && (
                      <span className="px-2 py-0.5 bg-[#C8963C]/8 border border-[#C8963C]/20 rounded-full text-[#C8963C] text-xs font-medium">
                        On-chain
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(pendingVote.type === 'trust' || pendingVote.type === 'distrust') && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#C8963C]/12">
                  <span className="text-[#B5BDC6] text-sm">Deposit</span>
                  <span className="font-bold text-sm" style={{ color: pendingVote.type === 'trust' ? '#5ab8a0' : '#c45454' }}>
                    {pendingVote.amount} tTRUST → {pendingVote.type === 'trust' ? 'FOR' : 'AGAINST'} shares
                  </span>
                </div>
              )}

              {(pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust') && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#C8963C]/12">
                  <span className="text-[#B5BDC6] text-sm">Redeem</span>
                  <span className="font-bold text-sm" style={{ color: pendingVote.type === 'redeem_trust' ? '#34a872' : '#c45454' }}>
                    {Number(pendingVote.amount).toFixed(4)} {pendingVote.type === 'redeem_trust' ? 'FOR' : 'AGAINST'} shares → tTRUST
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-[#B5BDC6] text-sm">Network</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34a872]" />
                  <span className="text-white text-sm">Intuition Testnet</span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-[#b8860b15] border border-[#b8860b25] rounded-lg mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="#b8860b" strokeWidth="2"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-[#b8860b] text-xs leading-relaxed">
                On-chain transaction. Gas fees apply. Action is permanent.
              </p>
            </div>

            {/* Oppose first-time 2-tx notice */}
            {pendingVote.type === 'distrust' && pendingVote.tripleTermId && (
              <div className="flex items-start gap-2 p-3 bg-[#C8963C10] border border-[#C8963C20] rounded-lg mb-5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="9" stroke="#C8963C" strokeWidth="2"/>
                  <path d="M12 8v4m0 4h.01" stroke="#C8963C" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p className="text-[#C8963C] text-xs leading-relaxed">
                  First Oppose Buy needs <strong>2 wallet confirmations</strong>: clear activation deposit, then Oppose deposit. Later buys require only 1.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setPendingVote(null) }}
                className="flex-1 py-3 bg-[#1E2229] hover:bg-[#252B33] rounded-xl text-[#B5BDC6] hover:text-white font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeVote}
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all"
                style={{
                  backgroundColor: pendingVote.type === 'trust' ? '#1a7f54' : '#8b3a3a',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = pendingVote.type === 'trust' ? '#166a45' : '#c45454')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = pendingVote.type === 'trust' ? '#1a7f54' : '#8b3a3a')}
              >
                {pendingVote.type === 'trust' ? 'Confirm Trust'
                  : pendingVote.type === 'distrust' ? 'Confirm Untrust'
                  : pendingVote.type === 'redeem_trust' ? 'Confirm Redeem FOR'
                  : 'Confirm Redeem AGAINST'}
              </button>
            </div>

          </div>
        </div>
      )}
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="flex items-center gap-3 px-5 py-3 bg-[#1a2f25] border border-[#2d7a5f60] rounded-xl shadow-2xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#34a872" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-white text-sm font-medium">{toast}</span>
          </div>
        </div>
      )}

    </PageBackground>
  )
}
