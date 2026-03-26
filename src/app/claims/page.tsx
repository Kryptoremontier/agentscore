'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther, getAddress } from 'viem'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'
import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import {
  createWriteConfig,
  depositToVault,
  redeemFromVault,
  getVaultSupply,
} from '@/lib/intuition'
import { calculateBuy, calculateSell, getSellProceeds, generateCurveData, getCurrentPrice } from '@/lib/bonding-curve'
import { useBuyPreview, useSellPreview } from '@/hooks/useOnChainPricing'
import { calculateTier, calculateTierProgress, getAgentAgeDays } from '@/lib/trust-tiers'
import { calculateWeightedTrust } from '@/lib/reputation-decay'
import {
  calculateCompositeTrust, calculateStableDays, findPeakPrice,
  getMaxDailySell, getSellReasonConfig, getLoyaltyMultiplier,
  SELL_REASONS, COMPOSITE_WEIGHTS, type SellReason, type CompositeResult,
} from '@/lib/composite-trust'
import { BONDING_CURVE_CONFIG } from '@/lib/bonding-curve'
import { calculateTrustScoreFromStakes, type TrustScoreResult } from '@/lib/trust-score-engine'
import { calculateHybridScore, getHybridLevel } from '@/lib/hybrid-trust'
import { calculateDiversityWeightedRatio } from '@/lib/diversity-weight'
import { TrustTierBadge, TrustTierBadgeWithProgress } from '@/components/agents/TrustTierBadge'
import { EarlySupporterBadge } from '@/components/agents/EarlySupporterBadge'
import { CreateClaimForm } from '@/components/claims/CreateClaimForm'
import { PREDICATES, getPredicateConfig, getAtomName, getAtomType, formatClaimText, type Claim } from '@/types/claim'
import { cn } from '@/lib/cn'
import {
  Bot, Zap, MessageSquare, Globe, Layers,
  Flame, HeartHandshake, TrendingUp, Link as LinkIcon,
  Sparkles, ArrowLeftRight, Swords, ShieldCheck, BadgeCheck,
  LayoutGrid, List,
  type LucideProps,
} from 'lucide-react'

// Maps predicate icon name string → Lucide component
const PRED_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Flame, HeartHandshake, TrendingUp, Link: LinkIcon,
  Sparkles, ArrowLeftRight, Swords, ShieldCheck, BadgeCheck, MessageSquare,
}

function PredicateIcon({ name, color, size = 10 }: { name?: string; color?: string; size?: number }) {
  const Icon = PRED_ICON_MAP[name ?? ''] ?? MessageSquare
  return <Icon className={`w-${size} h-${size} inline-block mr-1 align-middle`} style={{ color: color ?? '#9ca3af' }} />
}

function AtomTypeIcon({ type, color }: { type: 'agent' | 'skill' | 'unknown'; color?: string }) {
  if (type === 'agent') return <Bot className="w-3 h-3 inline-block mr-1 align-middle" style={{ color: color ?? '#C8963C' }} />
  if (type === 'skill') return <Zap className="w-3 h-3 inline-block mr-1 align-middle" style={{ color: color ?? '#2EE6D6' }} />
  return <Layers className="w-3 h-3 inline-block mr-1 align-middle" style={{ color: color ?? '#7A838D' }} />
}

import { APP_CONFIG } from '@/lib/app-config'
import { TRIPLE_SUBJECT_OR_STR, TRIPLE_OBJECT_OR_STR } from '@/lib/gql-filters'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

interface GraphQLTriple {
  term_id: string
  counter_term_id?: string | null
  created_at: string
  subject: { term_id: string; label: string }
  predicate: { term_id: string; label: string }
  object: { term_id: string; label: string }
  creator?: { label?: string; id?: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

function tripleToDisplayClaim(t: GraphQLTriple): Claim {
  const predConfig = getPredicateConfig(t.predicate.label)
  return {
    id: t.term_id,
    term_id: t.term_id,
    counter_term_id: t.counter_term_id,
    created_at: t.created_at,
    subject: {
      id: t.subject.term_id,
      term_id: t.subject.term_id,
      label: t.subject.label,
      type: getAtomType(t.subject.label),
    },
    predicate: {
      id: t.predicate.term_id,
      term_id: t.predicate.term_id,
      label: predConfig?.label ?? t.predicate.label,
      config: predConfig,
    },
    object: {
      id: t.object.term_id,
      term_id: t.object.term_id,
      label: t.object.label,
      type: getAtomType(t.object.label),
    },
    creator: t.creator,
    positions_aggregate: t.positions_aggregate
      ? { aggregate: { count: t.positions_aggregate.aggregate?.count, sum: t.positions_aggregate.aggregate?.sum ?? undefined } }
      : undefined,
    trust_score: (() => { try { const s = BigInt(t.positions_aggregate?.aggregate?.sum?.shares ?? '0'); return calculateTrustScoreFromStakes(s, 0n).score } catch { return 50 } })(),
    stakers_count: t.positions_aggregate?.aggregate?.count ?? 0,
  }
}

const CLAIM_FILTERS = [
  { label: 'All', value: 'all', icon: null, color: null },
  { label: 'Positive', value: 'positive', icon: 'Flame', color: '#f97316' },
  { label: 'Comparative', value: 'comparative', icon: 'Swords', color: '#ef4444' },
  { label: 'Neutral', value: 'neutral', icon: 'Link', color: '#3b82f6' },
  { label: 'Agent-Agent', value: 'agent-agent', icon: 'Bot', color: '#C8963C' },
  { label: 'Skill-Skill', value: 'skill-skill', icon: 'Zap', color: '#2EE6D6' },
  { label: 'Mixed', value: 'mixed', icon: 'Layers', color: '#a855f7' },
]

const FILTER_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Flame, Swords, Link: LinkIcon, Bot, Zap, Layers,
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={
      <PageBackground image="diagonal" opacity={0.3}>
        <div className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-4">
              <div className="h-10 w-64 bg-white/10 rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {[1,2,3,4,5,6].map(i => <div key={i} className="glass-card h-32 bg-white/5" />)}
              </div>
            </div>
          </div>
        </div>
      </PageBackground>
    }>
      <ClaimsPageContent />
    </Suspense>
  )
}

function ClaimsPageContent() {
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterValue, setFilterValue] = useState('all')
  const [showOnlyOurs, setShowOnlyOurs] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'attestations' | 'activity'>('overview')
  const [toast, setToast] = useState<string | null>(null)

  // Trust data for selected claim
  const [claimTriple, setClaimTriple] = useState<{ termId: string | null; counterTermId: string | null; loading: boolean }>({ termId: null, counterTermId: null, loading: false })
  const [claimTrust, setClaimTrust] = useState<TrustScoreResult | null>(null)
  const [claimSignals, setClaimSignals] = useState<any[]>([])
  const [claimSignalsCount, setClaimSignalsCount] = useState(0)
  const [allPositions, setAllPositions] = useState<any[]>([])
  const [combinedStakerCount, setCombinedStakerCount] = useState(0)
  const [supportSupply, setSupportSupply] = useState(0)
  const [opposeSupply, setOpposeSupply] = useState(0)
  const [onChainPrice, setOnChainPrice] = useState<number | null>(null)
  const [peakOnChainPrice, setPeakOnChainPrice] = useState<number | null>(null)
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [userPosition, setUserPosition] = useState<{ forShares: string | null; againstShares: string | null; rawPositions: any[]; againstRawPositions: any[] }>({ forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] })

  // Trading state
  const [signalSide, setSignalSide] = useState<'support' | 'oppose'>('support')
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy')
  const [voteAmount, setVoteAmount] = useState('0.05')
  const [untrustAmount, setUntrustAmount] = useState('0.05')
  const [redeemShares, setRedeemShares] = useState('0')
  const [sellReason, setSellReason] = useState<SellReason | null>(null)
  const [platformFee, setPlatformFee] = useState<{ fixedFee: bigint; bps: bigint } | null>(null)

  // On-chain buy/sell previews
  const activeVaultId = selectedClaim?.term_id || undefined
  const buyPreviewOC = useBuyPreview(
    tradeAction === 'buy' ? activeVaultId : undefined,
    tradeAction === 'buy' ? (Number(voteAmount) || 0) : undefined,
  )
  const sellPreviewOC = useSellPreview(
    tradeAction === 'sell' ? activeVaultId : undefined,
    tradeAction === 'sell' ? (Number(redeemShares) || 0) : undefined,
  )

  // Load platform fee config from FeeProxy contract (once per session)
  useEffect(() => {
    if (!publicClient) return
    import('@/lib/intuition').then(({ getFeeConfig }) => {
      getFeeConfig(publicClient).then(setPlatformFee).catch(() => {})
    })
  }, [publicClient])

  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingVote, setPendingVote] = useState<any>(null)
  const [voteStatus, setVoteStatus] = useState<Record<string, string>>({})
  const [creatingTriple, setCreatingTriple] = useState(false)
  const [showDistrustCta, setShowDistrustCta] = useState<any>(null)
  const isExecutingRef = useRef(false)

  // ── Fetch claims ──
  const fetchClaims = async (search = '') => {
    setLoading(true)
    setError(null)
    try {
      const searchFilter = search.trim()
        ? `, subject: { label: { _ilike: "%${search.trim()}%" } }`
        : ''
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query FetchClaims {
              triples(
                where: {
                  _and: [
                    { ${TRIPLE_SUBJECT_OR_STR} }
                    { ${TRIPLE_OBJECT_OR_STR} }
                  ]
                  ${searchFilter}
                }
                order_by: { block_number: desc }
                limit: 50
              ) {
                term_id counter_term_id created_at
                subject { term_id label }
                predicate { term_id label }
                object { term_id label }
                creator { label id }
                positions_aggregate { aggregate { count sum { shares } } }
              }
            }
          `,
        }),
      })
      const data = await res.json()
      if (data.errors) throw new Error(data.errors[0]?.message)
      setClaims((data.data?.triples ?? []).map(tripleToDisplayClaim))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClaims() }, [])
  useEffect(() => {
    const t = setTimeout(() => fetchClaims(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Auto-open from URL ?open=
  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && claims.length > 0 && !selectedClaim) {
      const match = claims.find(c => c.term_id === openId)
      if (match) setSelectedClaim(match)
    }
  }, [claims, searchParams])

  // Auto-open Create modal from URL ?create=true
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true)
    }
  }, [searchParams])

  // ── Positions helpers ──
  // Matches agents/page.tsx fetchUserPosition exactly — same variable names, same format
  const fetchUserPosition = async (termId: string, userAddr: string, counterTermId?: string | null) => {
    try {
      const checksummedAddress = userAddr ? getAddress(userAddr) : ''
      const queryAddress = checksummedAddress.toLowerCase()

      const forRes = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetForPositions($termId: String!, $address: String!) {
              forPositions: positions(
                where: { term_id: { _eq: $termId }, account_id: { _eq: $address } }
                limit: 5
              ) { shares curve_id updated_at }
            }
          `,
          variables: { termId, address: queryAddress },
        }),
      })
      const forData = await forRes.json()
      const forPos = forData.data?.forPositions || []
      const forSharesRaw = forPos[0]?.shares
      let forBigInt = 0n
      try { forBigInt = BigInt(forSharesRaw ?? '0') } catch { forBigInt = 0n }
      const forShares = (forSharesRaw && forBigInt > 0n) ? forSharesRaw : null

      let againstShares: string | null = null
      let againstRawPositions: any[] = []
      if (counterTermId) {
        const agRes = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query GetAgainstPositions($termId: String!, $address: String!) {
                againstPositions: positions(
                  where: { term_id: { _eq: $termId }, account_id: { _eq: $address } }
                  limit: 5
                ) { shares curve_id updated_at }
              }
            `,
            variables: { termId: counterTermId, address: queryAddress },
          }),
        })
        const agData = await agRes.json()
        againstRawPositions = agData.data?.againstPositions || []
        const agSharesRaw = againstRawPositions[0]?.shares
        let agBigInt = 0n
        try { agBigInt = BigInt(agSharesRaw ?? '0') } catch { agBigInt = 0n }
        againstShares = (agSharesRaw && agBigInt > 0n) ? agSharesRaw : null
      }

      return { forShares, againstShares, rawPositions: forPos, againstRawPositions }
    } catch { return { forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] } }
  }

  // Fetches shares for a specific user in a vault.
  // Does NOT filter by account_id in GraphQL (DB may store checksummed address,
  // causing _eq to return 0 on lowercase input). Filters in JS instead.
  const fetchVaultSharesForUser = async (termId: string, userAddress: string): Promise<bigint> => {
    try {
      const normalizedAddress = userAddress.toLowerCase()
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetVaultPositions($termId: String!) { positions(where: { term_id: { _eq: $termId } }) { account_id shares } }`,
          variables: { termId },
        }),
      })
      const data = await res.json()
      const pos = data?.data?.positions?.find(
        (p: any) => p.account_id?.toLowerCase() === normalizedAddress
      )
      let sharesBigInt = 0n
      try { sharesBigInt = pos?.shares ? BigInt(pos.shares) : 0n } catch { sharesBigInt = 0n }
      return sharesBigInt
    } catch (err) {
      console.warn('fetchVaultSharesForUser failed:', err)
      return 0n
    }
  }

  const fetchAllPositions = async (termId: string, counterTermId?: string | null) => {
    try {
      const termIds = [termId]; if (counterTermId) termIds.push(counterTermId)
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetAll($ids: [String!]!) { positions(where: { term_id: { _in: $ids } } order_by: { shares: desc } limit: 100) { account_id account { label } shares term_id updated_at } }`,
          variables: { ids: termIds },
        }),
      })
      const data = await res.json()
      const raw = data.data?.positions || []
      const active = raw.filter((p: any) => p.shares && BigInt(p.shares) > 0n)
      const wallets = new Set(active.map((p: any) => p.account_id))
      return { positions: active, uniqueCount: wallets.size }
    } catch { return { positions: [], uniqueCount: 0 } }
  }

  const fetchSignals = async (termId: string, counterTermId?: string | null) => {
    try {
      const termIds = [termId]; if (counterTermId) termIds.push(counterTermId)
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetSignals($ids: [String!]!) {
            signals(where: { term_id: { _in: $ids } } order_by: { created_at: desc } limit: 50) {
              id delta account_id account { label } term_id created_at transaction_hash deposit_id redemption_id
            }
            signals_aggregate(where: { term_id: { _in: $ids } }) { aggregate { count } }
          }`,
          variables: { ids: termIds },
        }),
      })
      const data = await res.json()
      return { signals: data.data?.signals || [], totalCount: data.data?.signals_aggregate?.aggregate?.count || 0 }
    } catch { return { signals: [], totalCount: 0 } }
  }

  const refreshPositionsAndSupply = async (termId: string, counterTermId?: string | null, showLoading = false) => {
    if (showLoading) setPositionsLoading(true)
    try {
      const posPromise = fetchAllPositions(termId, counterTermId)
      if (publicClient) {
        try {
          const { getSharePriceFloat } = await import('@/lib/on-chain-pricing')
          const hex = termId.startsWith('0x') ? termId as `0x${string}` : `0x${termId}` as `0x${string}`
          const [sup, opp, sharePrice] = await Promise.all([
            getVaultSupply(publicClient, termId),
            counterTermId ? getVaultSupply(publicClient, counterTermId) : Promise.resolve(0),
            getSharePriceFloat(publicClient, hex).catch(() => null),
          ])
          setSupportSupply(sup); setOpposeSupply(opp)
          if (sharePrice !== null) {
            setOnChainPrice(sharePrice)
            setPeakOnChainPrice(prev => prev !== null ? Math.max(prev, sharePrice) : sharePrice)
          }
        } catch { /* fallback below */ }
      }
      const { positions, uniqueCount } = await posPromise
      setAllPositions(positions); setCombinedStakerCount(uniqueCount)
    } finally { if (showLoading) setPositionsLoading(false) }
  }

  // Lock body scroll when claim modal is open
  useEffect(() => {
    document.body.style.overflow = selectedClaim ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedClaim])

  // When claim modal opens
  useEffect(() => {
    if (!selectedClaim) {
      setClaimTriple({ termId: null, counterTermId: null, loading: false })
      setAllPositions([]); setCombinedStakerCount(0); setSupportSupply(0); setOpposeSupply(0)
      setOnChainPrice(null); setPeakOnChainPrice(null)
      return
    }
    // For claim triples, the term_id IS the triple's own vault
    // counter_term_id is the oppose vault
    setClaimTriple({
      termId: selectedClaim.term_id,
      counterTermId: selectedClaim.counter_term_id ?? null,
      loading: false,
    })
  }, [selectedClaim?.term_id])

  useEffect(() => {
    if (!selectedClaim || !claimTriple.termId) return
    refreshPositionsAndSupply(claimTriple.termId, claimTriple.counterTermId, true)
    const interval = setInterval(() => refreshPositionsAndSupply(claimTriple.termId!, claimTriple.counterTermId, false), 15000)
    return () => clearInterval(interval)
  }, [selectedClaim?.term_id, claimTriple.termId, claimTriple.counterTermId])

  useEffect(() => {
    if (!selectedClaim) return
    setClaimSignals([]); setClaimSignalsCount(0)
    fetchSignals(selectedClaim.term_id, claimTriple.counterTermId).then(({ signals, totalCount }) => {
      setClaimSignals(signals); setClaimSignalsCount(totalCount)
    })
  }, [selectedClaim?.term_id, claimTriple.counterTermId])

  // Primary: derive userPosition from allPositions (same data source as Attestations tab — reliable)
  // allPositions contains positions for both support vault (term_id) and oppose vault (counter_term_id)
  useEffect(() => {
    if (!address) {
      setUserPosition({ forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] })
      return
    }
    if (allPositions.length === 0) return

    const qAddr = address.toLowerCase()
    const forPos = allPositions.filter(
      (p: any) => p.account_id?.toLowerCase() === qAddr &&
        p.term_id?.toLowerCase() === claimTriple.termId?.toLowerCase()
    )
    const agaPos = allPositions.filter(
      (p: any) => p.account_id?.toLowerCase() === qAddr &&
        claimTriple.counterTermId &&
        p.term_id?.toLowerCase() === claimTriple.counterTermId?.toLowerCase()
    )

    const forSharesRaw = forPos[0]?.shares
    const agaSharesRaw = agaPos[0]?.shares
    let forBigInt = 0n
    let agaBigInt = 0n
    try { forBigInt = BigInt(forSharesRaw ?? '0') } catch { /* ignore */ }
    try { agaBigInt = BigInt(agaSharesRaw ?? '0') } catch { /* ignore */ }

    setUserPosition({
      forShares: (forSharesRaw && forBigInt > 0n) ? forSharesRaw : null,
      againstShares: (agaSharesRaw && agaBigInt > 0n) ? agaSharesRaw : null,
      rawPositions: forPos,
      againstRawPositions: agaPos,
    })
  }, [allPositions, address, claimTriple.termId, claimTriple.counterTermId])

  // Fallback: also fetch directly when claim/address changes (covers case where user just transacted)
  useEffect(() => {
    if (!selectedClaim || !address) return
    fetchUserPosition(selectedClaim.term_id, address, claimTriple.counterTermId).then(pos => {
      // Only update if we got real data (prefer allPositions-derived when both exist)
      if (pos.forShares || pos.againstShares) setUserPosition(pos)
    })
  }, [selectedClaim?.term_id, address, claimTriple.counterTermId])

  useEffect(() => { setRedeemShares('0') }, [signalSide])

  // ── Trust computations ──
  const claimTier = useMemo(() => {
    if (!selectedClaim) return null
    return calculateTier(combinedStakerCount, supportSupply, 50, getAgentAgeDays(selectedClaim.created_at))
  }, [selectedClaim, combinedStakerCount, supportSupply])

  const weightedTrust = useMemo(() => {
    try {
      if (!selectedClaim || claimSignals.length === 0) return null
      const mapped = claimSignals.map((sig: any) => ({
        timestamp: sig.created_at,
        side: (claimTriple.counterTermId && sig.term_id === claimTriple.counterTermId)
          ? 'oppose' as const : 'support' as const,
        amount: Math.abs(Number(sig.delta || 0)) / 1e18,
      }))
      return calculateWeightedTrust(mapped)
    } catch { return null }
  }, [selectedClaim, claimSignals, claimTriple.counterTermId])

  const compositeTrust = useMemo((): CompositeResult | null => {
    try {
      if (!selectedClaim || claimSignals.length === 0 || !weightedTrust) return null
      const mapped = claimSignals.map((sig: any) => ({
        timestamp: sig.created_at,
        side: (claimTriple.counterTermId && sig.term_id === claimTriple.counterTermId)
          ? 'oppose' as const : 'support' as const,
        amount: Math.abs(Number(sig.delta || 0)) / 1e18,
        shares: Math.abs(Number(sig.shares_delta || sig.shares || 0)) / 1e18,
      }))
      const stableDays = calculateStableDays(mapped)
      const currentPrice = onChainPrice ?? (BONDING_CURVE_CONFIG.BASE_PRICE + BONDING_CURVE_CONFIG.SLOPE * supportSupply)
      const peakPrice = peakOnChainPrice ?? findPeakPrice(
        mapped.filter(s => s.side === 'support'),
        BONDING_CURVE_CONFIG.BASE_PRICE,
        BONDING_CURVE_CONFIG.SLOPE,
      )
      // Anti-sybil: count only stakers with net deposit >= 0.1 tTRUST
      const MIN_STAKE = 0.1 // tTRUST
      const walletNetStake = new Map<string, number>()
      for (const sig of claimSignals) {
        const wallet = sig.account_id
        if (!wallet) continue
        const delta = Number(sig.delta || 0) / 1e18
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
    } catch { return null }
  }, [selectedClaim, claimSignals, weightedTrust, supportSupply, combinedStakerCount, claimTriple.counterTermId, onChainPrice, peakOnChainPrice])

  // ─── Hybrid Score (AGENTSCORE = 60% economic confidence + 40% quality metrics) ───
  const hybridScore = useMemo((): number | null => {
    try {
      if (!claimTrust || !compositeTrust) return null
      const supportPositions = allPositions.filter(
        (p: any) => p.term_id === claimTriple.termId,
      )
      const opposePositions = allPositions.filter(
        (p: any) => p.term_id === claimTriple.counterTermId,
      )
      const supportRatio = (supportPositions.length > 0 || opposePositions.length > 0)
        ? calculateDiversityWeightedRatio(supportPositions, opposePositions)
        : (() => {
            const totalWei = claimTrust.supportStake + claimTrust.opposeStake
            return totalWei > 0n ? Number((claimTrust.supportStake * 100n) / totalWei) : 50
          })()
      return calculateHybridScore(claimTrust.score, compositeTrust.score, supportRatio)
    } catch (e) {
      console.error('[hybridScore]', e)
      return null
    }
  }, [claimTrust, compositeTrust, allPositions, claimTriple.termId, claimTriple.counterTermId])

  const exitLimit = useMemo(() => {
    try {
      if (!userPosition || !signalSide) return null
      const userSharesRaw = signalSide === 'support' ? userPosition.forShares : userPosition.againstShares
      if (!userSharesRaw) return null
      const userShares = Number(userSharesRaw) / 1e18
      const totalSupply = signalSide === 'support' ? supportSupply : opposeSupply
      return getMaxDailySell(userShares, totalSupply)
    } catch { return null }
  }, [userPosition, signalSide, supportSupply, opposeSupply])

  // ── Compute claimTrust from supply ──
  useEffect(() => {
    if (!selectedClaim) { setClaimTrust(null); return }
    const supportWei = BigInt(Math.round(supportSupply * 1e18))
    const opposeWei = BigInt(Math.round(opposeSupply * 1e18))
    setClaimTrust(calculateTrustScoreFromStakes(supportWei, opposeWei))
  }, [selectedClaim?.term_id, supportSupply, opposeSupply])

  // ── Bonding curve preview ──
  const parseAmount = (v: string) => { try { return parseEther(v) } catch { return 0n } }
  const buyAmount = parseAmount(signalSide === 'support' ? voteAmount : untrustAmount)
  const currentSupply = signalSide === 'support' ? supportSupply : opposeSupply
  const buyPreview = useMemo(() => {
    try { return calculateBuy(Number(buyAmount) / 1e18, currentSupply) } catch { return null }
  }, [currentSupply, buyAmount])
  const userSharesBigInt = useMemo(() => {
    try { return signalSide === 'support' ? BigInt(userPosition.forShares ?? '0') : BigInt(userPosition.againstShares ?? '0') } catch { return 0n }
  }, [signalSide, userPosition])
  const redeemAmount = useMemo(() => {
    const shares = parseFloat(redeemShares) || 0
    try { return signalSide === 'support' && onChainPrice ? shares * onChainPrice : getSellProceeds(shares, currentSupply) } catch { return null }
  }, [currentSupply, redeemShares, signalSide, onChainPrice])
  const curveData = useMemo(() => generateCurveData(currentSupply), [currentSupply])

  // ── Execute vote ──
  const executeVote = async () => {
    if (isExecutingRef.current || !pendingVote || !publicClient) return
    isExecutingRef.current = true
    setShowConfirm(false); setSellReason(null)
    const key = pendingVote.claim.term_id
    setVoteStatus(prev => ({ ...prev, [key]: 'pending' }))
    // Track the actual counterTermId used (may be fetched dynamically for first Oppose)
    let resolvedCounterTermId: string | null = claimTriple.counterTermId
    try {
      const { getWalletClient } = await import('@wagmi/core')
      const { config: wagmiConfig } = await import('@/lib/wagmi')
      const freshWalletClient = walletClient ?? await getWalletClient(wagmiConfig)
      if (!freshWalletClient) throw new Error('Wallet client unavailable — please reconnect')
      const cfg = createWriteConfig(freshWalletClient, publicClient)

      if (pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust') {
        const isDistrust = pendingVote.type === 'redeem_distrust'
        const redeemVaultId = isDistrust ? pendingVote.counterTermId : pendingVote.claim.term_id
        if (!redeemVaultId) { alert('Vault not found'); return }

        // Primary: use already-loaded allPositions (same source as POSITIONS tab — most reliable)
        const qAddr = address!.toLowerCase()
        const targetVaultId = redeemVaultId.toLowerCase()
        const localPos = allPositions.find(
          (p: any) => p.account_id?.toLowerCase() === qAddr && p.term_id?.toLowerCase() === targetVaultId
        )
        let freshSharesRaw = localPos?.shares ?? '0'
        let freshSharesBig = 0n
        try { freshSharesBig = BigInt(freshSharesRaw) } catch { freshSharesBig = 0n }

        // Fallback 1: userPosition state
        if (freshSharesBig === 0n) {
          const fallbackRaw = isDistrust ? userPosition.againstShares : userPosition.forShares
          if (fallbackRaw) {
            freshSharesRaw = fallbackRaw
            try { freshSharesBig = BigInt(freshSharesRaw) } catch { freshSharesBig = 0n }
          }
        }
        // Fallback 2: direct vault query
        if (freshSharesBig === 0n) {
          freshSharesRaw = (await fetchVaultSharesForUser(redeemVaultId, address!)).toString()
          try { freshSharesBig = BigInt(freshSharesRaw) } catch { freshSharesBig = 0n }
        }

        if (freshSharesBig === 0n) {
          alert(isDistrust
            ? 'No AGAINST shares to redeem — you have not staked in the Oppose vault'
            : 'No FOR shares to redeem — position may already be empty')
          return
        }

        // Honor the user's slider/input amount — convert decimal string → BigInt (18 decimals)
        // Cap at actual on-chain balance to avoid over-redeem errors
        let requestedShares = 0n
        try { requestedShares = parseEther(pendingVote.amount) } catch { requestedShares = 0n }
        const sharesToRedeem = (requestedShares > 0n && requestedShares <= freshSharesBig)
          ? requestedShares
          : freshSharesBig

        await redeemFromVault(cfg, redeemVaultId as `0x${string}`, sharesToRedeem, address as `0x${string}`)
      } else if (pendingVote.type === 'trust') {
        await depositToVault(cfg, pendingVote.claim.term_id as `0x${string}`, parseAmount(pendingVote.amount))
      } else if (pendingVote.type === 'distrust') {
        // For claim triples, the counter_term_id (Oppose vault) is created automatically
        // by the protocol when the triple is created. Never call createTrustTriple here.
        let counterTermId = pendingVote.counterTermId
        if (!counterTermId) {
          // Look up counter_term_id from the indexed triple data
          setCreatingTriple(true)
          try {
            const res = await fetch(GRAPHQL_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `query GetCounter($id: String!) { triples(where: { term_id: { _eq: $id } } limit: 1) { counter_term_id } }`,
                variables: { id: pendingVote.claim.term_id },
              }),
            })
            const data = await res.json()
            counterTermId = data.data?.triples?.[0]?.counter_term_id ?? null
          } catch { /* ignore */ } finally {
            setCreatingTriple(false)
          }
        }
        if (!counterTermId) throw new Error('Oppose vault not found for this claim. The triple may still be indexing — please try again in a few seconds.')
        resolvedCounterTermId = counterTermId
        setClaimTriple(prev => ({ ...prev, counterTermId }))

        // MultiVault_HasCounterStake: must clear support position in the triple's FOR vault
        // before depositing into the AGAINST (counter) vault
        const existingAtomShares = address
          ? await fetchVaultSharesForUser(pendingVote.claim.term_id, address)
          : 0n
        if (existingAtomShares > 0n) {
          console.log(`[Oppose/Claim] Clearing ${existingAtomShares} support shares before Oppose deposit...`)
          try {
            await redeemFromVault(cfg, pendingVote.claim.term_id as `0x${string}`, existingAtomShares, address as `0x${string}`)
            console.log('✅ Claim FOR vault cleared — proceeding to Oppose deposit')
          } catch (redeemErr: any) {
            throw new Error(`MultiVault requires clearing all Support shares before Opposing. Sell failed: ${redeemErr?.message || 'unknown'}`)
          }
        }

        await depositToVault(cfg, counterTermId as `0x${string}`, parseAmount(pendingVote.amount))
      }

      setVoteStatus(prev => ({ ...prev, [key]: 'success' }))

      if (pendingVote?.sellReason === 'distrust' && pendingVote?.type === 'redeem_trust') {
        setShowDistrustCta(pendingVote.claim)
      } else {
        setToast('Transaction confirmed! Refreshing...')
        setTimeout(() => setToast(null), 4000)
      }

      // Refetch all data — called twice (2s + 5s) to handle indexer lag
      // Uses resolvedCounterTermId which is correct even for first-time Oppose tx
      const refetchAll = () => {
        if (!selectedClaim) return
        fetchClaims(searchTerm)
        // Refresh signals → updates Attestations + Activity tabs
        fetchSignals(selectedClaim.term_id, resolvedCounterTermId).then(({ signals, totalCount }) => {
          setClaimSignals(signals)
          setClaimSignalsCount(totalCount)
        })
        refreshPositionsAndSupply(selectedClaim.term_id, resolvedCounterTermId, false)
        if (address) {
          fetchUserPosition(selectedClaim.term_id, address, resolvedCounterTermId).then(pos => {
            if (pos.forShares || pos.againstShares) setUserPosition(pos)
          })
        }
      }

      setTimeout(refetchAll, 2000)
      setTimeout(refetchAll, 5000)

    } catch (e: any) {
      setVoteStatus(prev => ({ ...prev, [key]: 'error' }))
      setToast(`Error: ${e.message || 'Transaction failed'}`)
      setTimeout(() => setToast(null), 5000)
    } finally {
      isExecutingRef.current = false
    }
  }

  // ── Filter logic ──
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      if (filterValue === 'all') return true
      const predCfg = c.predicate.config
      if (filterValue === 'positive') return predCfg?.category === 'positive'
      if (filterValue === 'comparative') return predCfg?.category === 'comparative'
      if (filterValue === 'neutral') return predCfg?.category === 'neutral'
      if (filterValue === 'agent-agent') return c.subject.type === 'agent' && c.object.type === 'agent'
      if (filterValue === 'skill-skill') return c.subject.type === 'skill' && c.object.type === 'skill'
      if (filterValue === 'mixed') return c.subject.type !== c.object.type
      return true
    })
  }, [claims, filterValue])

  const enrichedPositions = useMemo(() => {
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
  }, [allPositions])

  // ── Helper functions ──
  // Fixed positional colors: Subject=gold, Predicate=teal, Object=blue
  const SUBJECT_COLOR  = { bg: 'rgba(200,150,60,0.13)',  border: 'rgba(200,150,60,0.32)',  text: '#C8963C'  }
  const PRED_COLOR     = { bg: 'rgba(46,230,214,0.10)',  border: 'rgba(46,230,214,0.28)',  text: '#2EE6D6'  }
  const OBJECT_COLOR   = { bg: 'rgba(56,182,255,0.10)',  border: 'rgba(56,182,255,0.28)',  text: '#38B6FF'  }
  // kept for backward compat in modal header
  const atomColor = (type: string) => type === 'agent'
    ? SUBJECT_COLOR
    : { bg: 'rgba(56,182,255,0.10)', border: 'rgba(56,182,255,0.28)', text: '#38B6FF' }

  const getTrustColor = (score: number): string => {
    if (score >= 60) return '#22c55e'
    if (score >= 40) return '#eab308'
    if (score >= 20) return '#f97316'
    return '#ef4444'
  }

  const formatStakes = (wei: bigint): string => {
    const n = Number(wei) / 1e18
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
    if (n >= 1) return `$${n.toFixed(2)}`
    return `$${n.toFixed(4)}`
  }

  const buildTrustChartData = (signals: any[], counterTermId: string | null) => {
    if (!signals || signals.length === 0) return []
    const sorted = [...signals].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let supportTotal = 0; let opposeTotal = 0
    // Prepend a neutral starting point so chart always begins at 50 (no history)
    const results: { date: string; trustRatio: number }[] = []
    sorted.forEach(sig => {
      // delta can be negative for redemptions in some indexers; use absolute value
      const rawDelta = Number(sig.delta ?? sig.amount ?? 0)
      const delta = Math.abs(rawDelta) / 1e18
      if (delta === 0) return
      const isOppose = !!(counterTermId && sig.term_id?.toLowerCase() === counterTermId.toLowerCase())
      const isDeposit = !!sig.deposit_id
      if (isOppose) { isDeposit ? opposeTotal += delta : opposeTotal = Math.max(0, opposeTotal - delta) }
      else { isDeposit ? supportTotal += delta : supportTotal = Math.max(0, supportTotal - delta) }
      const total = supportTotal + opposeTotal
      const ratio = total > 0 ? Math.round((supportTotal / total) * 100) : 50
      results.push({
        date: new Date(sig.created_at).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        trustRatio: ratio,
      })
    })
    return results
  }

  return (
    <PageBackground image="diagonal" opacity={0.3}>
      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#C8963C] rounded-full" />
              <span className="text-xs font-semibold text-[#C8963C] uppercase tracking-widest">
                Live on Intuition Testnet
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
                  Claims
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8963C] to-[#C9A84C]">
                    {' '}Registry
                  </span>
                </h1>
                <p className="text-[#7A838D] text-lg max-w-2xl leading-relaxed">
                  On-chain relationship claims between Agents and Skills.
                  Stake <span className="text-[#B5BDC6] font-medium">tTRUST</span> to signal confidence.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-2 h-2 rounded-full bg-[#C8963C] animate-pulse" />
                  <span className="text-xs text-[#7A838D]">GraphQL live feed</span>
                </div>
              </div>
              <Button onClick={() => setShowCreateModal(true)} className="shrink-0" style={{ background: 'linear-gradient(135deg,#C8963C,#C9A84C)', color: '#0F1113', fontWeight: 600, border: 'none' }}>
                + Create Claim
              </Button>
            </div>
          </motion.div>

          {/* Search + Filters */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6 space-y-3">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A838D]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search claims by subject, predicate, object..."
                className="w-full pl-11 pr-4 py-3 bg-[#191C21] border border-white/12 rounded-xl text-white text-sm placeholder:text-[#7A838D] focus:border-[#C8963C]/60 focus:ring-1 focus:ring-[#C8963C]/20 outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {CLAIM_FILTERS.map(f => {
                const FilterIcon = f.icon ? FILTER_ICON_MAP[f.icon] : null
                const active = filterValue === f.value
                return (
                  <button
                    key={f.value}
                    onClick={() => setFilterValue(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#1E2229] text-white border border-[#C8963C]/50'
                        : 'text-[#B5BDC6] border border-white/[0.12] hover:text-white hover:bg-[#1E2229] hover:border-white/20'
                    }`}
                  >
                    {FilterIcon && <FilterIcon className="w-3 h-3" style={{ color: active ? '#C8963C' : '#7A838D' }} />}
                    {f.label}
                  </button>
                )
              })}
              <div className="flex-1" />
              <button
                onClick={() => setShowOnlyOurs(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  showOnlyOurs
                    ? 'bg-[#1E2229] text-[#C8963C] border-[#C8963C]/50'
                    : 'text-[#B5BDC6] border-white/[0.12] hover:text-white hover:bg-[#1E2229] hover:border-white/20'
                }`}
              >
                {showOnlyOurs
                  ? <><Layers className="w-3 h-3" /> Platform only</>
                  : <><Globe className="w-3 h-3" /> All Intuition</>
                }
              </button>

            </div>
          </motion.div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="glass-card h-32 animate-pulse bg-white/5 rounded-xl" />)}
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-400">{error}</div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-16">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.22)', boxShadow: '0 0 18px rgba(200,150,60,0.12)' }}>
                  <MessageSquare className="w-7 h-7" style={{ color: '#C8963C' }} />
                </div>
              </div>
              <p className="text-[#B5BDC6] mb-2">No claims found</p>
              <p className="text-[#7A838D] text-sm mb-6">Be the first to create an on-chain relationship claim</p>
              <Button onClick={() => setShowCreateModal(true)}>+ Create First Claim</Button>
            </div>
          ) : (
            <>
            {/* View mode toggle bar — above content */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-[#7A838D]">
                <span className="font-semibold text-white">{filteredClaims.length}</span> claims
              </p>
              <div
                className="flex items-center gap-0.5 p-1 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  onClick={() => setViewMode('grid')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={viewMode === 'grid' ? {
                    background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.08))',
                    border: '1px solid rgba(200,150,60,0.35)',
                    color: '#C8963C',
                  } : { border: '1px solid transparent', color: '#7A838D' }}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={viewMode === 'list' ? {
                    background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.08))',
                    border: '1px solid rgba(200,150,60,0.35)',
                    color: '#C8963C',
                  } : { border: '1px solid transparent', color: '#7A838D' }}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
              </div>
            </div>
            {viewMode === 'grid' ? (
            /* ── GRID VIEW ── */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClaims.map((claim, i) => {
                const predCfg = claim.predicate.config
                const tierCfg = calculateTier(claim.stakers_count || 0, claim.trust_score || 0, 50, getAgentAgeDays(claim.created_at))
                const score = claim.trust_score ?? 0
                return (
                  <motion.div
                    key={claim.term_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelectedClaim(claim); setActiveTab('overview') }}
                    className="rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: 'linear-gradient(145deg,#16191E,#1B1F26)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,150,60,0.2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
                  >
                    {/* Triple pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="flex items-center px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: SUBJECT_COLOR.bg, border: `1px solid ${SUBJECT_COLOR.border}`, color: SUBJECT_COLOR.text }}>
                        <AtomTypeIcon type={claim.subject.type} color={SUBJECT_COLOR.text} />
                        {getAtomName(claim.subject.label)}
                      </span>
                      <span className="flex items-center px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: PRED_COLOR.bg, border: `1px solid ${PRED_COLOR.border}`, color: PRED_COLOR.text }}>
                        <PredicateIcon name={predCfg?.icon} color={PRED_COLOR.text} size={3} />
                        {claim.predicate.label}
                      </span>
                      <span className="flex items-center px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: OBJECT_COLOR.bg, border: `1px solid ${OBJECT_COLOR.border}`, color: OBJECT_COLOR.text }}>
                        <AtomTypeIcon type={claim.object.type} color={OBJECT_COLOR.text} />
                        {getAtomName(claim.object.label)}
                      </span>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <TrustTierBadge tier={tierCfg} size="sm" />
                        <span className="text-xs text-[#7A838D]">{claim.stakers_count ?? 0} stakers</span>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold font-mono', score >= 70 ? 'text-[#2ECC71]' : score >= 40 ? 'text-amber-400' : 'text-[#7A838D]')}>{score}</p>
                        <p className="text-[10px] text-[#4A5260]">Trust Score</p>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="w-full h-1 bg-white/5 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, score)}%`, background: score >= 70 ? '#2ECC71' : score >= 40 ? '#EAB308' : '#6B7480' }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            /* ── LIST VIEW ── */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col gap-1.5">
              {/* List header */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#4A5260]">
                <span>Claim (Subject → Predicate → Object)</span>
                <span className="text-right w-20">Stakers</span>
                <span className="text-right w-12">Score</span>
              </div>
              {filteredClaims.map((claim, i) => {
                const predCfg = claim.predicate.config
                const score = claim.trust_score ?? 0
                return (
                  <motion.div
                    key={claim.term_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.015 }}
                    onClick={() => { setSelectedClaim(claim); setActiveTab('overview') }}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-150"
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
                    {/* Triple inline */}
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap" style={{ backgroundColor: SUBJECT_COLOR.bg, border: `1px solid ${SUBJECT_COLOR.border}`, color: SUBJECT_COLOR.text }}>
                        <AtomTypeIcon type={claim.subject.type} color={SUBJECT_COLOR.text} />
                        {getAtomName(claim.subject.label)}
                      </span>
                      <span className="text-[#4A5260] text-xs">→</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap" style={{ backgroundColor: PRED_COLOR.bg, border: `1px solid ${PRED_COLOR.border}`, color: PRED_COLOR.text }}>
                        <PredicateIcon name={predCfg?.icon} color={PRED_COLOR.text} size={3} />
                        {claim.predicate.label}
                      </span>
                      <span className="text-[#4A5260] text-xs">→</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap" style={{ backgroundColor: OBJECT_COLOR.bg, border: `1px solid ${OBJECT_COLOR.border}`, color: OBJECT_COLOR.text }}>
                        <AtomTypeIcon type={claim.object.type} color={OBJECT_COLOR.text} />
                        {getAtomName(claim.object.label)}
                      </span>
                    </div>
                    {/* Stakers */}
                    <span className="text-xs text-[#7A838D] text-right w-20 whitespace-nowrap">{claim.stakers_count ?? 0} stakers</span>
                    {/* Score */}
                    <span className={cn('text-sm font-bold font-mono text-right w-12', score >= 70 ? 'text-[#2ECC71]' : score >= 40 ? 'text-amber-400' : 'text-[#7A838D]')}>
                      {score}
                    </span>
                  </motion.div>
                )
              })}
            </motion.div>
            )}
            </>
          )}
        </div>
      </div>

      {/* ── Create Claim Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="fixed inset-0 z-40 bg-black/90" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 overflow-y-auto">
              <div className="min-h-full flex items-start pt-8 pb-8">
                <div className="w-full">
                  <div className="flex items-center justify-between mb-6 px-1">
                    <h2 className="text-xl font-bold">Create Claim</h2>
                    <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">✕</button>
                  </div>
                  <CreateClaimForm
                    onSuccess={(claimTermId) => {
                      setShowCreateModal(false)
                      setToast('Claim created! Syncing with indexer...')
                      // Indexer lag: retry fetchClaims until claim appears (up to ~30s)
                      let attempt = 0
                      const delays = [3000, 5000, 7000, 10000, 10000]
                      const poll = () => {
                        fetchClaims(searchTerm).then(() => {
                          attempt++
                          if (attempt < delays.length) {
                            setTimeout(poll, delays[attempt])
                          } else {
                            setToast('Claim created! It may take a moment to appear.')
                            setTimeout(() => setToast(null), 5000)
                          }
                        })
                      }
                      setTimeout(poll, delays[0])
                    }}
                    onClose={() => setShowCreateModal(false)}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Claim Detail Modal ── */}
      {selectedClaim && (
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
          onClick={() => setSelectedClaim(null)}
        >
          <div className="min-h-full p-4 flex items-start justify-center">
            <div className="w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>

              {/* === TOP CARD: Claim Header === */}
              <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-6 mb-3">
                <div className="flex items-start gap-4 mb-4">
                  {/* Triple chips + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(() => {
                        const predCfg = selectedClaim.predicate.config
                        return (<>
                          <span className="flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: SUBJECT_COLOR.bg, border: `1px solid ${SUBJECT_COLOR.border}`, color: SUBJECT_COLOR.text }}>
                            <AtomTypeIcon type={selectedClaim.subject.type} color={SUBJECT_COLOR.text} />
                            {getAtomName(selectedClaim.subject.label)}
                          </span>
                          <span className="flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: PRED_COLOR.bg, border: `1px solid ${PRED_COLOR.border}`, color: PRED_COLOR.text }}>
                            <PredicateIcon name={predCfg?.icon} color={PRED_COLOR.text} size={3} />
                            {selectedClaim.predicate.label}
                          </span>
                          <span className="flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: OBJECT_COLOR.bg, border: `1px solid ${OBJECT_COLOR.border}`, color: OBJECT_COLOR.text }}>
                            <AtomTypeIcon type={selectedClaim.object.type} color={OBJECT_COLOR.text} />
                            {getAtomName(selectedClaim.object.label)}
                          </span>
                        </>)
                      })()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#B5BDC6]">
                      <span className="bg-[#1E2229] px-2 py-0.5 rounded text-xs text-[#7A838D]">via AgentScore</span>
                      <span>·</span>
                      <span>{new Date(selectedClaim.created_at).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedClaim(null)}
                    className="w-8 h-8 rounded-lg bg-[#1E2229] hover:bg-[#252B33] flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#B5BDC6" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Term ID row */}
                <div className="flex items-center gap-2 text-sm mb-5">
                  <span className="text-[#B5BDC6] w-16 flex-shrink-0">Term ID:</span>
                  <code className="text-[#B5BDC6] text-xs font-mono">
                    {selectedClaim.term_id.slice(0, 14)}...{selectedClaim.term_id.slice(-8)}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedClaim.term_id)}
                    className="text-[#B5BDC6] hover:text-white transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: selectedClaim.trust_score ?? 0, label: 'Trust Score' },
                    { value: combinedStakerCount, label: 'Stakers' },
                    { value: supportSupply.toFixed(3), label: 'Support Pool' },
                    { value: opposeSupply.toFixed(3), label: 'Oppose Pool' },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-xs text-[#B5BDC6] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* === ACTION CARD: Bonding Curve Market === */}
              <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-5 mb-3">
                <p className="text-[#B5BDC6] text-xs font-semibold mb-1">Bonding Curve Market</p>
                <p className="text-[#7A838D] text-xs mb-3">One market: choose side (Support/Oppose) and action (Buy/Sell).</p>

                {isConnected ? (
                  <>
                    {/* Support / Oppose tabs */}
                    <div className="flex rounded-xl overflow-hidden border border-[#C8963C]/12 mb-3">
                      <button onClick={(e) => { e.stopPropagation(); setSignalSide('support'); setTradeAction('buy') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${signalSide === 'support' ? 'bg-[#2d7a5f] text-white' : 'bg-transparent text-[#B5BDC6] hover:text-white'}`}>
                        Support
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSignalSide('oppose'); setTradeAction('buy') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${signalSide === 'oppose' ? 'bg-[#8b3a3a] text-white' : 'bg-transparent text-[#B5BDC6] hover:text-white'}`}>
                        Oppose
                      </button>
                    </div>

                    {/* Oppose vault indexing check */}
                    {signalSide === 'oppose' && !claimTriple.counterTermId ? (
                      <div className="bg-[#1a1018] border border-[#b8860b40] rounded-xl p-4 text-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 opacity-60">
                          <circle cx="12" cy="12" r="9" stroke="#b8860b" strokeWidth="2"/>
                          <path d="M12 8v4m0 4h.01" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <p className="text-[#b8860b] text-xs font-semibold mb-1">Oppose Vault Indexing</p>
                        <p className="text-[#B5BDC6] text-xs mb-3 leading-relaxed">
                          The Oppose vault for this claim is still being indexed by the protocol.<br/>
                          It should appear within seconds — please refresh or try again shortly.
                        </p>
                        <button onClick={() => {
                          if (selectedClaim) setClaimTriple({ termId: selectedClaim.term_id, counterTermId: selectedClaim.counter_term_id ?? null, loading: false })
                        }} className="px-5 py-2 bg-[#8b3a3a] hover:bg-[#c45454] text-white text-xs font-bold rounded-lg transition-colors">
                          Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Buy / Sell tabs */}
                        <div className="flex rounded-xl overflow-hidden border border-[#C8963C]/12 mb-3">
                          <button onClick={(e) => { e.stopPropagation(); setTradeAction('buy') }}
                            className={`flex-1 py-2 text-xs font-bold transition-colors ${tradeAction === 'buy' ? 'bg-white text-black' : 'bg-transparent text-[#B5BDC6] hover:text-white'}`}>
                            Buy
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setTradeAction('sell') }}
                            className={`flex-1 py-2 text-xs font-bold transition-colors ${tradeAction === 'sell' ? 'bg-white text-black' : 'bg-transparent text-[#B5BDC6] hover:text-white'}`}>
                            Sell
                          </button>
                        </div>

                        {/* Current price */}
                        <div className="flex items-center justify-between mb-3 px-1">
                          <div>
                            <p className="text-white text-xs font-semibold">Bonding Curve</p>
                            <p className="text-[#B5BDC6] text-xs">
                              Current price: {(signalSide === 'support' ? (onChainPrice ?? getCurrentPrice(supportSupply)) : getCurrentPrice(opposeSupply)).toFixed(4)} tTRUST/share
                            </p>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded-full border border-[#C8963C]/25 text-[#B5BDC6]">Active</span>
                        </div>

                        {/* First Oppose Buy hint */}
                        {signalSide === 'oppose' && tradeAction === 'buy' && claimTriple.counterTermId && (
                          <div className="flex items-start gap-2 p-2.5 mb-3 bg-[#b8860b10] border border-[#b8860b20] rounded-lg">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                              <circle cx="12" cy="12" r="9" stroke="#b8860b" strokeWidth="2"/>
                              <path d="M12 8v4m0 4h.01" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            <p className="text-[#b8860b] text-[10px] leading-relaxed">
                              First Oppose Buy may require 2 confirmations: one to clear the activation deposit (FOR), then the actual Oppose deposit. Subsequent buys need only 1 confirmation.
                            </p>
                          </div>
                        )}

                        {/* Your shares info — visible in Sell mode */}
                        {tradeAction === 'sell' && (() => {
                          const ownedShares = signalSide === 'support'
                            ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                            : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                          const supply = signalSide === 'support' ? supportSupply : opposeSupply
                          return ownedShares > 0 ? (
                            <div className="mb-3 p-3 rounded-xl bg-[#171A1D] border border-[#C8963C]/12">
                              <div className="flex justify-between items-center">
                                <span className="text-[#B5BDC6] text-xs">Your shares</span>
                                <span className="text-white text-sm font-bold font-mono">{ownedShares.toFixed(4)} shares</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[#7A838D] text-[10px]">Current value</span>
                                <span className="text-[#7A838D] text-[10px] font-mono">{(signalSide === 'support' && onChainPrice ? ownedShares * onChainPrice : getSellProceeds(ownedShares, supply)).toFixed(6)} tTRUST</span>
                              </div>
                            </div>
                          ) : (
                            <div className="mb-3 p-3 rounded-xl bg-[#171A1D] border border-[#C8963C]/12 text-center">
                              <p className="text-[#7A838D] text-xs">No {signalSide} shares to sell</p>
                            </div>
                          )
                        })()}

                        {/* Amount input */}
                        <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-3 mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#B5BDC6] text-xs">{tradeAction === 'buy' ? 'Amount in tTRUST' : 'Shares to sell'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tradeAction === 'buy' ? (
                              <input type="number"
                                value={signalSide === 'support' ? voteAmount : untrustAmount}
                                onChange={e => signalSide === 'support' ? setVoteAmount(e.target.value) : setUntrustAmount(e.target.value)}
                                onClick={e => e.stopPropagation()} min="0.001" step="0.001"
                                className="flex-1 bg-transparent text-white text-lg font-bold outline-none" placeholder="0.05" />
                            ) : (
                              <input type="number" value={redeemShares}
                                onChange={e => {
                                  const maxShares = signalSide === 'support'
                                    ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                                    : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                                  const val = parseFloat(e.target.value)
                                  const effectiveMax = exitLimit?.isLimited ? Math.min(exitLimit.maxSellShares, maxShares) : maxShares
                                  if (!isNaN(val) && val > effectiveMax) setRedeemShares(effectiveMax.toFixed(6))
                                  else setRedeemShares(e.target.value)
                                }}
                                onClick={e => e.stopPropagation()} min="0" step="0.0001"
                                className="flex-1 bg-transparent text-white text-lg font-bold outline-none" placeholder="0.00" />
                            )}
                            <span className="text-[#B5BDC6] text-sm font-semibold">{tradeAction === 'buy' ? 'tTRUST' : 'shares'}</span>
                            {tradeAction === 'sell' && (
                              <button onClick={e => {
                                e.stopPropagation()
                                const maxRaw = signalSide === 'support' ? userPosition.forShares : userPosition.againstShares
                                if (maxRaw) {
                                  const maxShares = Number(maxRaw) / 1e18
                                  const effectiveMax = exitLimit?.isLimited ? Math.min(exitLimit.maxSellShares, maxShares) : maxShares
                                  setRedeemShares(effectiveMax.toFixed(6))
                                }
                              }} className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(200,150,60,0.12)] text-[#C8963C] hover:bg-[rgba(200,150,60,0.20)] transition-colors font-bold">
                                MAX
                              </button>
                            )}
                          </div>

                          {/* Percentage slider — sell mode only */}
                          {tradeAction === 'sell' && (() => {
                            const maxShares = signalSide === 'support'
                              ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                              : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                            if (maxShares <= 0) return null
                            return (
                              <div className="mt-2">
                                <input type="range" min="0" max={maxShares} step={maxShares / 100 || 0.0001}
                                  value={parseFloat(redeemShares) || 0}
                                  onChange={e => setRedeemShares(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full h-1 bg-[#1E2229] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#C8963C]" />
                                <div className="flex justify-between text-[10px] text-[#7A838D] mt-1">
                                  <span>0</span>
                                  {[0.25, 0.5, 0.75].map(pct => (
                                    <button key={pct} onClick={e => { e.stopPropagation(); setRedeemShares((maxShares * pct).toFixed(4)) }} className="hover:text-white transition-colors">{pct * 100}%</button>
                                  ))}
                                  <button onClick={e => { e.stopPropagation(); setRedeemShares(maxShares.toFixed(6)) }} className="hover:text-white transition-colors">MAX</button>
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Sell Reason selector */}
                        {tradeAction === 'sell' && parseFloat(redeemShares || '0') > 0 && (
                          <div style={{ marginTop:'12px', marginBottom:'12px' }}>
                            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginBottom:'8px', fontWeight:500 }}>
                              Why are you selling?
                              <span style={{ color:'rgba(255,255,255,0.2)', fontWeight:400, marginLeft:'4px' }}>(optional — contextual info)</span>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                              {SELL_REASONS.map(reason => {
                                const isSelected = sellReason === reason.id
                                return (
                                  <button key={reason.id} onClick={e => { e.stopPropagation(); setSellReason(isSelected ? null : reason.id) }}
                                    style={{ padding:'6px 12px', borderRadius:'8px', border: isSelected ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)', background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.5)', fontSize:'11px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                                    <span>{reason.icon}</span><span>{reason.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                            {sellReason && (() => {
                              const isDistrust = sellReason === 'distrust'
                              return (
                                <div style={{ marginTop:'8px', padding:'8px 12px', borderRadius:'8px',
                                  background: isDistrust ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                                  border: isDistrust ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(255,255,255,0.08)',
                                  fontSize:'11px' }}>
                                  {isDistrust ? (
                                    <>
                                      <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#ef4444', fontWeight:600, marginBottom:'4px' }}>
                                        <span>⚠️</span><span>Distrust not yet on-chain</span>
                                      </div>
                                      <div style={{ color:'rgba(255,255,255,0.4)', lineHeight:'1.5' }}>
                                        Selling removes your stake. To <strong style={{ color:'rgba(255,255,255,0.7)' }}>permanently record distrust</strong> in the Intuition Protocol, you will be prompted to buy <strong style={{ color:'#ef4444' }}>Oppose shares</strong> after this transaction.
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ color:'rgba(255,255,255,0.35)' }}>
                                      {getSellReasonConfig(sellReason).description}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        {/* Buy/Sell preview */}
                        {(() => {
                          const supply = signalSide === 'support' ? supportSupply : opposeSupply
                          if (tradeAction === 'buy') {
                            const inputAmt = Number(signalSide === 'support' ? voteAmount : untrustAmount) || 0
                            const localPreview = calculateBuy(inputAmt, supply)
                            const hasOC = buyPreviewOC.sharesFloat > 0 && !buyPreviewOC.loading
                            const sharesDisplay = hasOC ? buyPreviewOC.sharesFloat : localPreview.sharesReceived
                            const feeDisplay = hasOC ? buyPreviewOC.fee : localPreview.fee
                            const avgPriceDisplay = hasOC ? buyPreviewOC.avgPrice : localPreview.avgPricePerShare
                            const currentP = onChainPrice ?? getCurrentPrice(supply)
                            const priceImpact = avgPriceDisplay > 0 && currentP > 0 ? ((avgPriceDisplay - currentP) / currentP) * 100 : 0
                            return (
                              <div className="space-y-1 mb-3 px-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#B5BDC6] text-xs">You receive</span>
                                  <span className="text-white text-xs font-semibold">{buyPreviewOC.loading ? '...' : inputAmt > 0 ? `${sharesDisplay.toFixed(4)} shares` : '—'}</span>
                                </div>
                                {inputAmt > 0 && (<>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Fee{hasOC ? '' : ' (est.)'}</span>
                                    <span className="text-[#7A838D] text-[10px]">{buyPreviewOC.loading ? '...' : `${feeDisplay.toFixed(4)} tTRUST`}</span>
                                  </div>
                                  {platformFee && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-[#7A838D] text-[10px]">Platform fee ({Number(platformFee.bps) / 100}% + {(Number(platformFee.fixedFee) / 1e18).toFixed(4)})</span>
                                      <span className="text-[#7A838D] text-[10px]">{((inputAmt * Number(platformFee.bps) / 10000) + Number(platformFee.fixedFee) / 1e18).toFixed(4)} tTRUST</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Avg price{hasOC ? '' : ' (est.)'}</span>
                                    <span className="text-[#7A838D] text-[10px]">{buyPreviewOC.loading ? '...' : `${avgPriceDisplay.toFixed(4)} tTRUST/share`}</span>
                                  </div>
                                  {priceImpact > 0.01 && !buyPreviewOC.loading && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-[#7A838D] text-[10px]">Price impact</span>
                                      <span className={`text-[10px] ${priceImpact > 5 ? 'text-[#f85149]' : 'text-[#7A838D]'}`}>{priceImpact.toFixed(2)}%</span>
                                    </div>
                                  )}
                                  {platformFee && (
                                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#1E2229]">
                                      <span className="text-[#B5BDC6] text-[10px] font-medium">Total cost</span>
                                      <span className="text-white text-[10px] font-semibold">{(inputAmt + inputAmt * Number(platformFee.bps) / 10000 + Number(platformFee.fixedFee) / 1e18).toFixed(4)} tTRUST</span>
                                    </div>
                                  )}
                                </>)}
                              </div>
                            )
                          } else {
                            const inputShares = Number(redeemShares) || 0
                            const maxOwned = signalSide === 'support'
                              ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                              : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                            const validShares = inputShares > 0 && inputShares <= maxOwned
                            const localPreview = calculateSell(inputShares, supply)
                            const hasOC = sellPreviewOC.assetsFloat > 0 && !sellPreviewOC.loading
                            const netProceeds = hasOC ? sellPreviewOC.assetsFloat : localPreview.netProceeds
                            const avgSellPrice = inputShares > 0 ? netProceeds / inputShares : 0
                            const currentP = onChainPrice ?? getCurrentPrice(supply)
                            const priceImpact = currentP > 0 && avgSellPrice > 0 ? ((currentP - avgSellPrice) / currentP) * 100 : 0
                            return (
                              <div className="space-y-1 mb-3 px-1">
                                {inputShares > maxOwned && maxOwned > 0 && (
                                  <p className="text-[#f85149] text-[10px] mb-1">Exceeds owned shares ({maxOwned.toFixed(4)})</p>
                                )}
                                <div className="flex items-center justify-between">
                                  <span className="text-white text-xs font-medium">You receive</span>
                                  <span className="text-white text-xs font-bold font-mono">{sellPreviewOC.loading ? '...' : validShares ? `${netProceeds.toFixed(6)} tTRUST` : '—'}</span>
                                </div>
                                {validShares && !sellPreviewOC.loading && (<>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A838D] text-[10px]">Avg price{hasOC ? '' : ' (est.)'}</span>
                                    <span className="text-[#7A838D] text-[10px] font-mono">{avgSellPrice.toFixed(6)} tTRUST/share</span>
                                  </div>
                                  {priceImpact > 0.01 && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-[#7A838D] text-[10px]">Price impact</span>
                                      <span className={`text-[10px] font-mono ${priceImpact > 5 ? 'text-[#f85149]' : 'text-[#7A838D]'}`}>{priceImpact.toFixed(2)}%</span>
                                    </div>
                                  )}
                                </>)}
                              </div>
                            )
                          }
                        })()}

                        {/* Gradual exit warning */}
                        {tradeAction === 'sell' && exitLimit?.isLimited && (
                          <div style={{ marginBottom:'12px', padding:'10px 14px', borderRadius:'10px', background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.2)', fontSize:'11px', color:'#eab308', display:'flex', alignItems:'flex-start', gap:'8px' }}>
                            <span style={{ fontSize:'14px', flexShrink:0, marginTop:'1px' }}>⚠️</span>
                            <div>
                              <div style={{ fontWeight:600, marginBottom:'2px' }}>Gradual exit limit active</div>
                              <div style={{ color:'rgba(234,179,8,0.7)' }}>{exitLimit.reason}</div>
                              <div style={{ marginTop:'4px', color:'rgba(255,255,255,0.4)' }}>
                                Max today: <span style={{ color:'#eab308', fontFamily:'monospace', fontWeight:600 }}>{exitLimit.maxSellShares.toFixed(4)} shares</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action button */}
                        {tradeAction === 'buy' ? (
                          <button
                            onClick={() => {
                              const amount = signalSide === 'support' ? voteAmount : untrustAmount
                              setPendingVote({ type: signalSide === 'support' ? 'trust' : 'distrust', claim: selectedClaim, amount, counterTermId: claimTriple.counterTermId })
                              setShowConfirm(true)
                            }}
                            disabled={parseFloat(signalSide === 'support' ? voteAmount : untrustAmount) <= 0}
                            className={cn('w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50',
                              signalSide === 'support' ? 'bg-[#2d7a5f] hover:bg-[#34a872] text-white' : 'bg-[#8b3a3a] hover:bg-[#c45454] text-white'
                            )}
                          >
                            {signalSide === 'support' ? '▲ Support → Get Shares' : '▼ Oppose → Get Shares'}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setPendingVote({ type: signalSide === 'support' ? 'redeem_trust' : 'redeem_distrust', claim: selectedClaim, amount: redeemShares, counterTermId: claimTriple.counterTermId, sellReason: sellReason ?? null })
                              setShowConfirm(true)
                            }}
                            disabled={!parseFloat(redeemShares) || parseFloat(redeemShares) <= 0}
                            className="w-full py-2.5 rounded-xl text-sm font-bold border border-[#C8963C]/12 text-[#B5BDC6] hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
                          >
                            Sell Shares → Redeem tTRUST
                          </button>
                        )}

                        {tradeAction === 'sell' && (
                          <p className="text-[10px] text-[#4A5260] text-center mt-2 leading-relaxed">
                            Proceeds shown are UI estimates. Actual tTRUST received is determined by the Intuition MultiVault contract on-chain.
                          </p>
                        )}

                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 bg-[#171A1D] rounded-xl border border-[#C8963C]/12">
                    <p className="text-[#B5BDC6] text-sm font-medium mb-1">Connect wallet to trade</p>
                    <p className="text-[#7A838D] text-xs">You need a connected wallet to support or oppose claims</p>
                  </div>
                )}
              </div>

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
                              <p className="text-[#34a872] text-xs font-semibold">Support</p>
                              <p className="text-[#7A838D] text-[10px]">FOR vault</p>
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
                              <p className="text-[#c45454] text-xs font-semibold">Oppose</p>
                              <p className="text-[#7A838D] text-[10px]">AGAINST vault</p>
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

              {/* === CARD 3: AgentScore + Stake Breakdown === */}
              {(() => {
                const t = claimTrust
                const score = hybridScore ?? t?.score ?? 50
                const level = hybridScore != null ? getHybridLevel(hybridScore) : (t?.level ?? 'moderate')
                const confidence = t?.confidence ?? 0
                const momentum = t?.momentum ?? 0
                const supportWei = t?.supportStake ?? BigInt(0)
                const opposeWei = t?.opposeStake ?? BigInt(0)
                const netWei = t?.netStake ?? BigInt(0)
                const totalWei = t?.totalStake ?? BigInt(0)
                const supportPct = totalWei > BigInt(0)
                  ? Number((supportWei * BigInt(1000)) / totalWei) / 10
                  : 100
                const scoreColor = level === 'excellent' ? '#06B6D4'
                  : level === 'good' ? '#22C55E'
                  : level === 'moderate' ? '#EAB308'
                  : level === 'low' ? '#F97316'
                  : '#EF4444'
                const momDir = momentum > 0.1 ? 'up' : momentum < -0.1 ? 'down' : 'stable'
                const momText = momDir === 'up' ? `+${momentum.toFixed(1)} pts` : momDir === 'down' ? `${momentum.toFixed(1)} pts` : 'Stable'
                const circumference = 2 * Math.PI * 32
                const dashLen = (score / 100) * circumference
                return (
                  <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-6 mb-3">
                    <div className="grid grid-cols-2 gap-6">
                      {/* LEFT: AgentScore gauge */}
                      <div>
                        <h3 className="text-white font-bold mb-4">AGENTSCORE</h3>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="relative w-20 h-20 flex-shrink-0">
                            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                              <circle cx="40" cy="40" r="32" fill="none" stroke="#21262d" strokeWidth="6"/>
                              <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="6"
                                strokeDasharray={`${dashLen} ${circumference}`} strokeLinecap="round"/>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="font-bold text-lg" style={{ color: scoreColor }}>{score}</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              {momDir === 'up' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H7M17 7v10" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/></svg>}
                              {momDir === 'down' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 7L17 17M17 17H7M17 17V7" stroke="#f85149" strokeWidth="2" strokeLinecap="round"/></svg>}
                              <span className={`text-sm font-medium ${momDir === 'up' ? 'text-[#10b981]' : momDir === 'down' ? 'text-[#f85149]' : 'text-[#B5BDC6]'}`}>{momText}</span>
                            </div>
                            <p className="text-[#B5BDC6] text-xs">Trust Level</p>
                            <p className="text-white text-sm font-semibold capitalize">{level}</p>
                            <p className="text-[#B5BDC6] text-xs mt-1">Confidence</p>
                            <p className="text-white text-sm font-semibold">{(confidence * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                      {/* RIGHT: Stake Breakdown */}
                      <div>
                        <h3 className="text-white font-bold mb-4">Stake Breakdown</h3>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#10b981]">Support ({supportPct.toFixed(1)}%)</span>
                          <span className="text-[#f85149]">Oppose ({(100 - supportPct).toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 bg-[#1E2229] rounded-full overflow-hidden mb-4">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#10b981] to-[#059669] transition-all" style={{ width: `${supportPct}%` }} />
                        </div>
                        <div className="space-y-2">
                          <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-lg p-3">
                            <p className="text-xs text-[#B5BDC6] mb-0.5">Support Stake</p>
                            <p className="text-[#10b981] font-bold">{formatStakes(supportWei)}</p>
                          </div>
                          <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-lg p-3">
                            <p className="text-xs text-[#B5BDC6] mb-0.5">Oppose Stake</p>
                            <p className="text-[#f85149] font-bold">{formatStakes(opposeWei)}</p>
                          </div>
                          <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-lg p-3">
                            <p className="text-xs text-[#B5BDC6] mb-0.5">Net Stake</p>
                            <p className="text-[#C8963C] font-bold">{netWei >= BigInt(0) ? '+' : ''}{formatStakes(netWei)} tTRUST</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* === BONDING CURVE INFO BANNER === */}
              <div className="bg-[rgba(200,150,60,0.10)] border border-[#1f6feb25] rounded-2xl p-4 mb-3">
                <div className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="9" stroke="#C8963C" strokeWidth="2" />
                    <path d="M12 8v4m0 4h.01" stroke="#C8963C" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className="text-[#C8963C] text-sm font-semibold mb-1">Bonding Curve Economics</p>
                    <p className="text-[#B5BDC6] text-xs leading-relaxed">
                      Early stakers get more shares per tTRUST. As more people support this claim, your shares increase in value. Redeem anytime to realize gains.
                    </p>
                  </div>
                </div>
              </div>

              {/* === TABS: Overview / Attestations / Activity === */}
              <div className="bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl overflow-hidden mb-3">
                <div className="flex border-b border-[#C8963C]/12">
                  {[
                    { id: 'overview', label: 'Overview', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg> },
                    { id: 'attestations', label: 'Attestations', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                    { id: 'activity', label: 'Activity', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === tab.id ? 'text-white border-[#34a872]' : 'text-[#B5BDC6] border-transparent hover:text-white hover:border-[#C8963C]/25'
                      }`}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                {/* ── OVERVIEW TAB ── */}
                {activeTab === 'overview' && (() => {
                  const t = claimTrust
                  const score = hybridScore ?? t?.score ?? 50
                  const level = hybridScore != null ? getHybridLevel(hybridScore) : (t?.level ?? 'moderate')
                  const confidence = t?.confidence ?? 0
                  const momentum = t?.momentum ?? 0
                  const supportWei = t?.supportStake ?? BigInt(0)
                  const opposeWei = t?.opposeStake ?? BigInt(0)
                  const totalWei = supportWei + opposeWei
                  const supportPct = totalWei > BigInt(0) ? Number((supportWei * BigInt(100)) / totalWei) : 50
                  const opsPct = 100 - supportPct
                  const netStake = Number(supportWei - opposeWei) / 1e18
                  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
                    excellent: { bg: '#2ECC7120', text: '#06b6d4', border: '#2ECC7140' },
                    good:      { bg: '#22c55e20', text: '#22c55e', border: '#22c55e40' },
                    moderate:  { bg: '#eab30820', text: '#eab308', border: '#eab30840' },
                    low:       { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
                    critical:  { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
                  }
                  const lc = levelColors[level] || levelColors.moderate
                  const ageDays = Math.floor((Date.now() - new Date(selectedClaim.created_at).getTime()) / 86400000)
                  const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1 day' : `${ageDays} days`
                  return (
                    <div className="p-5 space-y-5">
                      {/* AGENTSCORE Visual */}
                      <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">Trust Score</p>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
                            {level}
                          </span>
                        </div>
                        <div className="flex items-end gap-4 mb-3">
                          <p className="text-4xl font-bold text-white leading-none">{typeof score === 'number' ? score.toFixed(1) : score}</p>
                          <p className="text-[#B5BDC6] text-xs pb-1">/100</p>
                          {momentum !== 0 && (
                            <span className={`text-xs font-medium pb-1 ${momentum > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                              {momentum > 0 ? '▲' : '▼'} {Math.abs(momentum).toFixed(1)} momentum
                            </span>
                          )}
                        </div>
                        <div className="w-full h-2 bg-[#1E2229] rounded-full overflow-hidden mb-2">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${score}%`, background: `linear-gradient(90deg, ${lc.text}80, ${lc.text})` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#7A838D]">
                          <span>Critical</span><span>Low</span><span>Moderate</span><span>Good</span><span>Excellent</span>
                        </div>

                        {/* Components breakdown (only when hybridScore available) */}
                        {hybridScore != null && claimTrust && compositeTrust && (
                          <div className="mt-3 pt-3 border-t border-[#C8963C]/10 space-y-1.5">
                            <p className="text-[#7A838D] text-[10px] uppercase tracking-wider mb-1">Components</p>
                            <div className="flex justify-between text-xs">
                              <span className="text-[#B5BDC6]">Economic confidence</span>
                              <span className="text-white font-semibold">{claimTrust.score}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-[#B5BDC6]">Quality metrics</span>
                              <span className="text-white font-semibold">{compositeTrust.score.toFixed(1)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Weighted Trust */}
                      {weightedTrust && (
                        <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">Trust Score (time-weighted)</p>
                            <span className="text-base font-bold" style={{ color: weightedTrust.weightedRatio >= 60 ? '#22c55e' : weightedTrust.weightedRatio >= 40 ? '#eab308' : '#ef4444' }}>
                              {weightedTrust.weightedRatio.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E2229] rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${weightedTrust.weightedRatio}%`, background: weightedTrust.weightedRatio >= 60 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : weightedTrust.weightedRatio >= 40 ? 'linear-gradient(90deg, #eab308, #facc15)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-[#7A838D]">Raw: {weightedTrust.rawRatio.toFixed(1)}%{weightedTrust.decayImpact !== 0 && <span style={{ color: weightedTrust.decayImpact > 0 ? '#22c55e' : '#ef4444', marginLeft: '4px' }}>({weightedTrust.decayImpact > 0 ? '+' : ''}{weightedTrust.decayImpact.toFixed(1)}% freshness)</span>}</span>
                            <span className="text-[#7A838D]">{weightedTrust.freshSignalsCount} fresh / {weightedTrust.totalSignalsCount} signals</span>
                          </div>
                        </div>
                      )}

                      {/* Quality Metrics (Composite) */}
                      {compositeTrust && (
                        <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">Quality Metrics</p>
                            <div className="flex items-center gap-2">
                              {compositeTrust.isStable && <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>Stable</span>}
                              <span className="text-base font-bold" style={{ color: compositeTrust.score >= 60 ? '#22c55e' : compositeTrust.score >= 40 ? '#eab308' : '#ef4444' }}>{compositeTrust.score.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E2229] rounded-full overflow-hidden mb-3">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${compositeTrust.score}%`, background: compositeTrust.score >= 60 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : compositeTrust.score >= 40 ? 'linear-gradient(90deg, #eab308, #facc15)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { label: 'Signal Ratio', value: compositeTrust.breakdown.signalScore, weight: Math.round(COMPOSITE_WEIGHTS.SIGNAL_RATIO * 100) },
                              { label: 'Staker Diversity', value: compositeTrust.breakdown.stakerScore, weight: Math.round(COMPOSITE_WEIGHTS.STAKERS * 100) },
                              { label: 'Stability', value: compositeTrust.breakdown.stabilityScore, weight: Math.round(COMPOSITE_WEIGHTS.STABILITY * 100) },
                              { label: 'Price Retention', value: compositeTrust.breakdown.priceScore, weight: Math.round(COMPOSITE_WEIGHTS.PRICE_RETENTION * 100) },
                            ].map(({ label, value, weight }) => (
                              <div key={label}>
                                <div className="flex justify-between text-[10px] text-[#7A838D] mb-0.5">
                                  <span>{label} <span style={{ color:'rgba(255,255,255,0.2)' }}>({weight}%)</span></span>
                                  <span style={{ color: value >= 60 ? '#22c55e' : value >= 40 ? '#eab308' : '#ef4444' }}>{value}</span>
                                </div>
                                <div className="w-full h-1 bg-[#0F1113] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: value >= 60 ? '#22c55e' : value >= 40 ? '#eab308' : '#ef4444', opacity: 0.7 }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-[#7A838D] mt-2">
                            <span>Price retention: {(compositeTrust.priceRetentionRatio * 100).toFixed(0)}% of ATH</span>
                            <span style={{ color: compositeTrust.isStable ? '#22c55e' : '#6b7280' }}>{compositeTrust.isStable ? '● Stable' : '● Unstable'}</span>
                          </div>
                        </div>
                      )}

                      {/* Community Sentiment */}
                      <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                        <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Community Sentiment</p>
                        <div className="w-full h-3 bg-[#1E2229] rounded-full overflow-hidden flex mb-2">
                          {supportPct > 0 && <div className="h-full bg-[#34a872] transition-all duration-500" style={{ width: `${supportPct}%` }} />}
                          {opsPct > 0 && <div className="h-full bg-[#c45454] transition-all duration-500" style={{ width: `${opsPct}%` }} />}
                        </div>
                        <div className="flex justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#34a872]" />
                            <span className="text-white text-xs font-medium">{supportPct}% Support</span>
                            <span className="text-[#7A838D] text-[10px]">({(Number(supportWei) / 1e18).toFixed(4)} tTRUST)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#7A838D] text-[10px]">({(Number(opposeWei) / 1e18).toFixed(4)} tTRUST)</span>
                            <span className="text-white text-xs font-medium">{opsPct}% Oppose</span>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#c45454]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-[#0F1113] rounded-lg p-2.5 text-center">
                            <p className="text-white text-sm font-bold">{(Number(totalWei) / 1e18).toFixed(4)}</p>
                            <p className="text-[#7A838D] text-[10px]">Total TVL</p>
                          </div>
                          <div className="bg-[#0F1113] rounded-lg p-2.5 text-center">
                            <p className={`text-sm font-bold ${netStake >= 0 ? 'text-[#34a872]' : 'text-[#c45454]'}`}>{netStake >= 0 ? '+' : ''}{netStake.toFixed(4)}</p>
                            <p className="text-[#7A838D] text-[10px]">Net Stake</p>
                          </div>
                          <div className="bg-[#0F1113] rounded-lg p-2.5 text-center">
                            <p className="text-white text-sm font-bold">{(confidence * 100).toFixed(0)}%</p>
                            <p className="text-[#7A838D] text-[10px]">Confidence</p>
                          </div>
                        </div>
                      </div>

                      {/* Bonding Curves (dual) */}
                      <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                        <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Bonding Curves</p>
                        <div className="grid grid-cols-2 gap-4">
                          {(() => {
                            const data = generateCurveData(supportSupply)
                            const localPrice = getCurrentPrice(supportSupply)
                            const cp = onChainPrice ?? localPrice
                            return (
                              <div>
                                <p className="text-[#34a872] text-[10px] font-bold mb-2 uppercase">Support</p>
                                <div className="h-32">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data}>
                                      <defs><linearGradient id="claimSupportGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34a872" stopOpacity={0.3}/><stop offset="95%" stopColor="#34a872" stopOpacity={0}/></linearGradient></defs>
                                      <XAxis dataKey="supply" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                                      <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                                      <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${Number(v).toFixed(4)} tTRUST`, 'Price']} />
                                      <Area type="monotone" dataKey="price" stroke="#34a872" fillOpacity={1} fill="url(#claimSupportGrad)" strokeWidth={2} />
                                      {supportSupply > 0 && <ReferenceDot x={parseFloat(supportSupply.toFixed(4))} y={parseFloat(cp.toFixed(6))} r={5} fill="#34a872" stroke="#fff" strokeWidth={2} />}
                                      {onChainPrice != null && <ReferenceLine y={onChainPrice} stroke="#34a872" strokeDasharray="3 3" strokeOpacity={0.5} />}
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                                <p className="text-[#7A838D] text-[10px] mt-1">Supply: {supportSupply.toFixed(2)} · Price: {cp.toFixed(4)}{onChainPrice != null ? ' (on-chain)' : ''}</p>
                              </div>
                            )
                          })()}
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
                            const cp = getCurrentPrice(opposeSupply)
                            return (
                              <div>
                                <p className="text-[#c45454] text-[10px] font-bold mb-2 uppercase">Oppose</p>
                                <div className="h-32">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data}>
                                      <defs><linearGradient id="claimOpposeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c45454" stopOpacity={0.3}/><stop offset="95%" stopColor="#c45454" stopOpacity={0}/></linearGradient></defs>
                                      <XAxis dataKey="supply" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                                      <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                                      <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${Number(v).toFixed(4)} tTRUST`, 'Price']} />
                                      <Area type="monotone" dataKey="price" stroke="#c45454" fillOpacity={1} fill="url(#claimOpposeGrad)" strokeWidth={2} />
                                      {opposeSupply > 0 && <ReferenceDot x={parseFloat(opposeSupply.toFixed(4))} y={parseFloat(cp.toFixed(6))} r={5} fill="#c45454" stroke="#fff" strokeWidth={2} />}
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                                <p className="text-[#7A838D] text-[10px] mt-1">Supply: {opposeSupply.toFixed(2)} · Price: {cp.toFixed(4)}</p>
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      {/* Trust History */}
                      {(() => {
                        const chartData = buildTrustChartData(claimSignals, claimTriple.counterTermId)
                        if (chartData.length < 2) return null
                        return (
                          <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                            <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Trust History</p>
                            <div className="h-40">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                  <defs><linearGradient id="claimTrustHistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34a872" stopOpacity={0.3}/><stop offset="95%" stopColor="#34a872" stopOpacity={0}/></linearGradient></defs>
                                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                                  <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Trust Ratio']} />
                                  <ReferenceLine y={50} stroke="#21262d" strokeDasharray="3 3" />
                                  <Area type="monotone" dataKey="trustRatio" stroke="#34a872" fillOpacity={1} fill="url(#claimTrustHistGrad)" strokeWidth={2} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between text-[10px] text-[#7A838D] mt-1">
                              <span>0% = All Oppose</span><span>50% = Balanced</span><span>100% = All Support</span>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Positions Table */}
                      {(() => {
                        if (positionsLoading) return <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4"><div className="h-16 animate-pulse bg-[#1E2229] rounded-lg" /></div>
                        if (allPositions.length === 0) return null
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
                                    const isOppose = claimTriple.counterTermId && pos.term_id === claimTriple.counterTermId
                                    let shares = 0n; try { shares = BigInt(pos.shares || '0') } catch { shares = 0n }
                                    const pct = totalShares > 0n ? Number((shares * 10000n) / totalShares) / 100 : 0
                                    const walletLabel = pos.account?.label || pos.account_id
                                    const isENS = walletLabel?.includes('.eth')
                                    const displayWallet = isENS ? walletLabel : walletLabel?.length > 14 ? walletLabel.slice(0, 8) + '...' + walletLabel.slice(-4) : walletLabel
                                    const isCreator = false // creator = FeeProxy address when routing via proxy
                                    return (
                                      <tr key={`${pos.account_id}-${pos.term_id}-${i}`} className="border-b border-[#C8963C]/12/50 hover:bg-[#0F1113]">
                                        <td className="py-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <Link href={`/profile/${pos.account_id}`} className="text-[#C8963C] hover:underline">{displayWallet}</Link>
                                            <EarlySupporterBadge rank={i + 1} />
                                            {isCreator && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[rgba(200,150,60,0.12)] text-[#C8963C] border border-[rgba(200,150,60,0.20)]">CREATOR</span>}
                                          </div>
                                        </td>
                                        <td className="py-2">
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOppose ? 'bg-[#8b3a3a20] text-[#c45454]' : 'bg-[#2d7a5f20] text-[#34a872]'}`}>
                                            {isOppose ? 'Oppose' : 'Support'}
                                          </span>
                                        </td>
                                        <td className="py-2 text-right text-white font-medium">{(Number(shares) / 1e18).toFixed(4)}</td>
                                        <td className="py-2 text-right text-[#B5BDC6]">{(!isOppose && onChainPrice ? (Number(shares) / 1e18) * onChainPrice : getSellProceeds(Number(shares) / 1e18, isOppose ? opposeSupply : supportSupply)).toFixed(4)}</td>
                                        <td className="py-2 text-right text-[#B5BDC6]">{pct.toFixed(1)}%</td>
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
                              return <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'4px', background:`${loyalty.color}15`, color:loyalty.color, border:`1px solid ${loyalty.color}30`, fontWeight:600 }}>{loyalty.label} · {loyalty.daysStaked}d</span>
                            })()}
                          </div>
                          {(userPosition.forShares || userPosition.againstShares) ? (
                            <div className="space-y-2">
                              {userPosition.forShares && Number(userPosition.forShares) > 0 && (() => {
                                const sf = Number(userPosition.forShares) / 1e18
                                const val = onChainPrice ? sf * onChainPrice : getSellProceeds(sf, supportSupply)
                                return <div className="bg-[#2d7a5f15] border border-[#2d7a5f30] rounded-lg px-3 py-2">
                                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#34a872]" /><span className="text-[#34a872] text-xs font-medium">Support</span></div><span className="text-white text-xs font-bold">{sf.toFixed(4)} shares</span></div>
                                  <div className="flex items-center justify-between mt-1"><span className="text-[#7A838D] text-[10px]">Current Value</span><span className="text-[#34a872] text-[10px] font-semibold">{val.toFixed(4)} tTRUST</span></div>
                                </div>
                              })()}
                              {userPosition.againstShares && Number(userPosition.againstShares) > 0 && (() => {
                                const sf = Number(userPosition.againstShares) / 1e18
                                const val = getSellProceeds(sf, opposeSupply)
                                return <div className="bg-[#8b3a3a15] border border-[#8b3a3a30] rounded-lg px-3 py-2">
                                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#c45454]" /><span className="text-[#c45454] text-xs font-medium">Oppose</span></div><span className="text-white text-xs font-bold">{sf.toFixed(4)} shares</span></div>
                                  <div className="flex items-center justify-between mt-1"><span className="text-[#7A838D] text-[10px]">Current Value</span><span className="text-[#c45454] text-[10px] font-semibold">{val.toFixed(4)} tTRUST</span></div>
                                </div>
                              })()}
                            </div>
                          ) : (
                            <div className="text-center py-3 bg-[#0F1113] rounded-lg">
                              <p className="text-[#7A838D] text-xs">You haven't staked on this claim yet</p>
                              <p className="text-[#B5BDC6] text-[10px] mt-0.5">Use the Bonding Curve Market above to take a position</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Claim Details */}
                      <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                        <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">Details</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                          <div>
                            <p className="text-[#7A838D] text-[10px] mb-0.5">Platform</p>
                            <p className="text-white text-xs font-medium">AgentScore</p>
                          </div>
                          {[
                            { label: 'Claim Age', value: ageLabel },
                            { label: 'Created', value: new Date(selectedClaim.created_at).toLocaleDateString('pl-PL') },
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
                            {['Triple Claim', selectedClaim.subject.type === 'agent' ? 'AI Agent' : 'Skill', selectedClaim.object.type === 'agent' ? 'AI Agent' : 'Skill'].filter((v,i,a) => a.indexOf(v)===i).map((tag, i) => (
                              <span key={i} className="px-2.5 py-0.5 bg-[rgba(200,150,60,0.10)] border border-[rgba(200,150,60,0.20)] rounded-full text-[#C8963C] text-[10px] font-medium">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* ── ATTESTATIONS TAB ── */}
                {activeTab === 'attestations' && (() => {
                  const profileMap = new Map<string, { label: string; accountId: string; supportCount: number; opposeCount: number; totalSignals: number; netShares: number; lastSeen: string }>()
                  for (const signal of claimSignals) {
                    const key = signal.account_id || 'unknown'
                    const existing = profileMap.get(key)
                    const delta = Number(signal.delta || 0) / 1e18
                    const isDeposit = !!signal.deposit_id
                    const isAgainst = claimTriple.counterTermId ? signal.term_id === claimTriple.counterTermId : false
                    const signed = isDeposit ? delta : -delta
                    if (!existing) {
                      profileMap.set(key, { label: signal.account?.label || key, accountId: key, supportCount: (!isAgainst && isDeposit) ? 1 : 0, opposeCount: (isAgainst && isDeposit) ? 1 : 0, totalSignals: 1, netShares: isAgainst ? -signed : signed, lastSeen: signal.created_at })
                    } else {
                      if (!isAgainst && isDeposit) existing.supportCount++
                      if (isAgainst && isDeposit) existing.opposeCount++
                      existing.totalSignals++
                      existing.netShares += isAgainst ? -signed : signed
                      if (new Date(signal.created_at) > new Date(existing.lastSeen)) existing.lastSeen = signal.created_at
                    }
                  }
                  const profiles = [...profileMap.values()].sort((a, b) => Math.abs(b.netShares) - Math.abs(a.netShares))
                  return (
                    <div className="p-4 space-y-3">
                      {profiles.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-[#B5BDC6] text-sm">No attestations yet</p>
                          <p className="text-[#7A838D] text-xs mt-1">Be the first to stake on this claim</p>
                        </div>
                      ) : profiles.map(profile => {
                        const isSupporter = profile.netShares > 0
                        const walletLabel = profile.label
                        const isENS = walletLabel?.includes('.eth')
                        const displayWallet = isENS ? walletLabel : walletLabel?.length > 20 ? walletLabel.slice(0, 12) + '...' + walletLabel.slice(-4) : walletLabel
                        return (
                          <div key={profile.accountId} className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSupporter ? 'bg-[#2d7a5f20] text-[#34a872]' : 'bg-[#8b3a3a20] text-[#c45454]'}`}>
                                  {isSupporter ? '▲' : '▼'}
                                </div>
                                <div>
                                  <Link href={`/profile/${profile.accountId}`} className="text-white text-sm font-medium hover:text-[#C8963C] transition-colors">{displayWallet}</Link>
                                  <p className="text-[#7A838D] text-[10px] mt-0.5">Last active {new Date(profile.lastSeen).toLocaleDateString('pl-PL')}</p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-sm font-bold ${isSupporter ? 'text-[#34a872]' : 'text-[#c45454]'}`}>
                                  {isSupporter ? '+' : ''}{profile.netShares.toFixed(4)}
                                </p>
                                <p className="text-[#7A838D] text-[10px]">net shares</p>
                              </div>
                            </div>
                            <div className="flex gap-4 mt-3 pt-3 border-t border-[#C8963C]/12">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#34a872]" />
                                <span className="text-[#7A838D] text-[10px]">{profile.supportCount} support signal{profile.supportCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#c45454]" />
                                <span className="text-[#7A838D] text-[10px]">{profile.opposeCount} oppose signal{profile.opposeCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="ml-auto">
                                <span className="text-[#B5BDC6] text-[10px]">{profile.totalSignals} total</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* ── ACTIVITY TAB ── */}
                {activeTab === 'activity' && (
                  <div className="p-4 space-y-3">
                    {/* Creation event */}
                    <div className="flex items-start gap-3 bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                      <div className="w-8 h-8 rounded-full bg-[rgba(200,150,60,0.12)] border border-[#1f6feb40] flex items-center justify-center flex-shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#C8963C" strokeWidth="2" strokeLinecap="round"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium">Claim Created</p>
                        <p className="text-[#7A838D] text-[10px] mt-0.5">
                          via AgentScore{' · '}{new Date(selectedClaim.created_at).toLocaleDateString('pl-PL')}
                        </p>
                      </div>
                    </div>
                    {claimSignals.length === 0 ? (
                      <p className="text-center text-[#B5BDC6] text-sm py-4">No staking activity yet</p>
                    ) : [...claimSignals].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((sig: any) => {
                      const isDeposit = !!sig.deposit_id
                      const isOppose = claimTriple.counterTermId && sig.term_id === claimTriple.counterTermId
                      const delta = Math.abs(Number(sig.delta || 0)) / 1e18
                      const isFeeProxy = sig.account_id?.toLowerCase() === '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41'
                      const walletLabel = isFeeProxy ? 'via AgentScore' : (sig.account?.label || sig.account_id?.slice(0,8) + '...')
                      return (
                        <div key={sig.id} className="flex items-start gap-3 bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                            isDeposit
                              ? isOppose ? 'bg-[#8b3a3a20] text-[#c45454]' : 'bg-[#2d7a5f20] text-[#34a872]'
                              : 'bg-[#1E2229] text-[#B5BDC6]'
                          }`}>
                            {isDeposit ? (isOppose ? '▼' : '▲') : '↩'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-white text-xs font-medium">{isDeposit ? (isOppose ? 'Oppose Stake' : 'Support Stake') : 'Redeem'}</span>
                              <span className="text-[#7A838D] text-[10px]">by</span>
                              {sig.account_id && !isFeeProxy
                                ? <Link href={`/profile/${sig.account_id}`} className="text-[#C8963C] text-[10px] hover:underline">{walletLabel}</Link>
                                : <span className="text-[#7A838D] text-[10px]">{walletLabel}</span>}
                            </div>
                            <p className="text-[#7A838D] text-[10px] mt-0.5">{new Date(sig.created_at).toLocaleDateString('pl-PL')}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xs font-bold ${isDeposit ? (isOppose ? 'text-[#c45454]' : 'text-[#34a872]') : 'text-[#B5BDC6]'}`}>
                              {isDeposit ? '+' : '-'}{delta.toFixed(4)} tTRUST
                            </p>
                            {sig.transaction_hash && (
                              <a href={`https://testnet.explorer.intuition.systems/tx/${sig.transaction_hash}`} target="_blank" rel="noopener noreferrer" className="text-[#C8963C] text-[10px] hover:underline">tx →</a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Backdrop click to close */}
          <div className="fixed inset-0 top-[64px] -z-10" onClick={() => setSelectedClaim(null)} />
        </div>
      )}

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {showConfirm && pendingVote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/70" onClick={() => setShowConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-96 z-[61]">
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4">Confirm Transaction</h3>
                <dl className="space-y-2 text-sm mb-6">
                  <div className="flex justify-between"><dt className="text-[#7A838D]">Action</dt><dd className="capitalize">{pendingVote.type.replace('_', ' ')}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#7A838D]">Claim</dt><dd className="text-xs truncate max-w-[200px]">{formatClaimText(pendingVote.claim)}</dd></div>
                  {pendingVote.amount && (
                    pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust'
                      ? <>
                          <div className="flex justify-between"><dt className="text-[#7A838D]">Shares to redeem</dt><dd className="font-mono">{pendingVote.amount} shares</dd></div>
                          {redeemAmount !== null && redeemAmount > 0 && (
                            <div className="flex justify-between"><dt className="text-[#7A838D]">Est. proceeds</dt><dd className="font-mono text-[#2ECC71]">~{(redeemAmount * 0.95).toFixed(6)} tTRUST</dd></div>
                          )}
                        </>
                      : <div className="flex justify-between"><dt className="text-[#7A838D]">Amount</dt><dd className="font-mono">{pendingVote.amount} tTRUST</dd></div>
                  )}
                </dl>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">Cancel</Button>
                  <Button onClick={executeVote} className="flex-1 shrink-0">Confirm</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 glass-card rounded-xl text-sm shadow-2xl text-white font-medium">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Distrust CTA — prompt to buy Oppose shares after "Lost Trust" sell ── */}
      {showDistrustCta && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
          <div className="bg-[#0F1113] border border-[#ef4444]/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-white text-lg font-bold text-center mb-1">Register Distrust On-Chain?</h3>
            <p className="text-[#B5BDC6] text-sm text-center mb-2">
              You sold your support shares citing <span className="text-[#ef4444] font-semibold">Lost Trust</span>.
            </p>
            <p className="text-[#7A838D] text-xs text-center mb-4 leading-relaxed">
              To permanently record your distrust in the Intuition Protocol, buy <strong className="text-white">Oppose shares</strong>. This registers a negative signal on-chain and directly lowers the Trust Score.
            </p>
            <div className="flex items-start gap-2 p-3 bg-[#C8963C]/5 border border-[#C8963C]/20 rounded-xl mb-5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="9" stroke="#C8963C" strokeWidth="2"/>
                <path d="M12 8v4m0 4h.01" stroke="#C8963C" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-[#C8963C] text-xs leading-relaxed">
                If you still have remaining Support shares, the protocol will <strong>automatically clear them</strong> before depositing Oppose (may require an extra wallet confirmation).
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDistrustCta(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-[#7A838D] hover:text-white hover:border-white/20 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  setShowDistrustCta(null)
                  setSelectedClaim(showDistrustCta)
                  setSignalSide('oppose')
                  setTradeAction('buy')
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#ef4444]/10 border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
              >
                Buy Oppose Shares →
              </button>
            </div>
          </div>
        </div>
      )}
    </PageBackground>
  )
}
