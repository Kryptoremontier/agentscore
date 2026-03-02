'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther, getAddress } from 'viem'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import { calculateBuy, calculateSell, getSellProceeds, generateCurveData } from '@/lib/bonding-curve'
import { calculateTier, calculateTierProgress, getAgentAgeDays } from '@/lib/trust-tiers'
import { calculateWeightedTrust } from '@/lib/reputation-decay'
import {
  calculateCompositeTrust, calculateStableDays, findPeakPrice,
  getMaxDailySell, getSellReasonConfig,
  SELL_REASONS, type SellReason, type CompositeResult,
} from '@/lib/composite-trust'
import { BONDING_CURVE_CONFIG } from '@/lib/bonding-curve'
import { TrustTierBadge, TrustTierBadgeWithProgress } from '@/components/agents/TrustTierBadge'
import { EarlySupporterBadge } from '@/components/agents/EarlySupporterBadge'
import { CreateClaimForm } from '@/components/claims/CreateClaimForm'
import { PREDICATES, getPredicateConfig, getAtomName, getAtomType, formatClaimText, type Claim } from '@/types/claim'
import { cn } from '@/lib/cn'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

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
    trust_score: Math.min(100, Math.round(Number(t.positions_aggregate?.aggregate?.sum?.shares ?? 0) / 1e18)),
    stakers_count: t.positions_aggregate?.aggregate?.count ?? 0,
  }
}

const CLAIM_FILTERS = [
  { label: 'All', value: 'all' },
  { label: '🔥 Positive', value: 'positive' },
  { label: '⚔️ Comparative', value: 'comparative' },
  { label: '🔗 Neutral', value: 'neutral' },
  { label: '🤖 Agent-Agent', value: 'agent-agent' },
  { label: '⚡ Skill-Skill', value: 'skill-skill' },
  { label: '🤖⚡ Mixed', value: 'mixed' },
]

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
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'attestations' | 'activity'>('overview')
  const [toast, setToast] = useState<string | null>(null)

  // Trust data for selected claim
  const [claimTriple, setClaimTriple] = useState<{ termId: string | null; counterTermId: string | null; loading: boolean }>({ termId: null, counterTermId: null, loading: false })
  const [claimSignals, setClaimSignals] = useState<any[]>([])
  const [claimSignalsCount, setClaimSignalsCount] = useState(0)
  const [allPositions, setAllPositions] = useState<any[]>([])
  const [combinedStakerCount, setCombinedStakerCount] = useState(0)
  const [supportSupply, setSupportSupply] = useState(0)
  const [opposeSupply, setOpposeSupply] = useState(0)
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [userPosition, setUserPosition] = useState<{ forShares: string | null; againstShares: string | null; rawPositions: any[]; againstRawPositions: any[] }>({ forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] })

  // Trading state
  const [signalSide, setSignalSide] = useState<'support' | 'oppose'>('support')
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy')
  const [voteAmount, setVoteAmount] = useState('0.05')
  const [redeemShares, setRedeemShares] = useState('0')
  const [sellReason, setSellReason] = useState<SellReason | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingVote, setPendingVote] = useState<any>(null)
  const [voteStatus, setVoteStatus] = useState<Record<string, string>>({})
  const [creatingTriple, setCreatingTriple] = useState(false)
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
                    { _or: [
                      { subject: { label: { _ilike: "Agent:%" } } }
                      { subject: { label: { _ilike: "Skill:%" } } }
                    ]}
                    { _or: [
                      { object: { label: { _ilike: "Agent:%" } } }
                      { object: { label: { _ilike: "Skill:%" } } }
                    ]}
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

  // ── Positions helpers ──
  const fetchUserPosition = async (termId: string, userAddr: string, counterTermId?: string | null) => {
    try {
      const qAddr = getAddress(userAddr).toLowerCase()
      const forRes = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetForPos($t: String!, $a: String!) { forPositions: positions(where: { term_id: { _eq: $t }, account_id: { _eq: $a } } limit: 5) { shares curve_id updated_at } }`,
          variables: { t: termId, a: qAddr },
        }),
      })
      const forData = await forRes.json()
      const forPos = forData.data?.forPositions || []
      const forSharesRaw = forPos[0]?.shares
      let forBigInt = 0n; try { forBigInt = BigInt(forSharesRaw ?? '0') } catch { forBigInt = 0n }
      const forShares = (forSharesRaw && forBigInt > 0n) ? forSharesRaw : null
      let againstShares: string | null = null
      let againstRawPositions: any[] = []
      if (counterTermId) {
        const agRes = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query GetAgainst($t: String!, $a: String!) { againstPositions: positions(where: { term_id: { _eq: $t }, account_id: { _eq: $a } } limit: 5) { shares curve_id updated_at } }`,
            variables: { t: counterTermId, a: qAddr },
          }),
        })
        const agData = await agRes.json()
        againstRawPositions = agData.data?.againstPositions || []
        const agSharesRaw = againstRawPositions[0]?.shares
        let agBigInt = 0n; try { agBigInt = BigInt(agSharesRaw ?? '0') } catch { agBigInt = 0n }
        againstShares = (agSharesRaw && agBigInt > 0n) ? agSharesRaw : null
      }
      return { forShares, againstShares, rawPositions: forPos, againstRawPositions }
    } catch { return { forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] } }
  }

  const fetchAllPositions = async (termId: string, counterTermId?: string | null) => {
    try {
      const termIds = [termId]; if (counterTermId) termIds.push(counterTermId)
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetAll($ids: [String!]!) { positions(where: { term_id: { _in: $ids } } order_by: { shares: desc } limit: 100) { account_id account { label } shares term_id updated_at } }`,
          variables: { termIds },
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
          variables: { termIds },
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
          const { getVaultSupply } = await import('@/lib/intuition')
          const [sup, opp] = await Promise.all([
            getVaultSupply(publicClient, termId),
            counterTermId ? getVaultSupply(publicClient, counterTermId) : Promise.resolve(0),
          ])
          setSupportSupply(sup); setOpposeSupply(opp)
        } catch { /* fallback below */ }
      }
      const { positions, uniqueCount } = await posPromise
      setAllPositions(positions); setCombinedStakerCount(uniqueCount)
    } finally { if (showLoading) setPositionsLoading(false) }
  }

  // When claim modal opens
  useEffect(() => {
    if (!selectedClaim) {
      setClaimTriple({ termId: null, counterTermId: null, loading: false })
      setAllPositions([]); setCombinedStakerCount(0); setSupportSupply(0); setOpposeSupply(0)
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

  useEffect(() => {
    if (!selectedClaim || !address) return
    fetchUserPosition(selectedClaim.term_id, address, claimTriple.counterTermId).then(setUserPosition)
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
      const currentPrice = BONDING_CURVE_CONFIG.BASE_PRICE + BONDING_CURVE_CONFIG.SLOPE * supportSupply
      const peakPrice = findPeakPrice(
        mapped.filter(s => s.side === 'support'),
        BONDING_CURVE_CONFIG.BASE_PRICE,
        BONDING_CURVE_CONFIG.SLOPE,
      )
      return calculateCompositeTrust({
        weightedSignalRatio: weightedTrust.weightedRatio,
        uniqueStakers: combinedStakerCount,
        stableDays,
        currentPrice,
        peakPrice: Math.max(peakPrice, currentPrice),
        recentSells: [],
      })
    } catch { return null }
  }, [selectedClaim, claimSignals, weightedTrust, supportSupply, combinedStakerCount, claimTriple.counterTermId])

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

  // ── Bonding curve preview ──
  const parseAmount = (v: string) => { try { return parseEther(v) } catch { return 0n } }
  const buyAmount = parseAmount(voteAmount)
  const currentSupply = signalSide === 'support' ? supportSupply : opposeSupply
  const buyPreview = useMemo(() => {
    try { return calculateBuy(currentSupply, Number(buyAmount) / 1e18) } catch { return null }
  }, [currentSupply, buyAmount])
  const userSharesBigInt = useMemo(() => {
    try { return signalSide === 'support' ? BigInt(userPosition.forShares ?? '0') : BigInt(userPosition.againstShares ?? '0') } catch { return 0n }
  }, [signalSide, userPosition])
  const redeemAmount = useMemo(() => {
    const shares = parseFloat(redeemShares) || 0
    try { return getSellProceeds(currentSupply, shares) } catch { return null }
  }, [currentSupply, redeemShares])
  const curveData = useMemo(() => generateCurveData(currentSupply), [currentSupply])

  // ── Execute vote ──
  const executeVote = async () => {
    if (isExecutingRef.current || !pendingVote || !publicClient) return
    isExecutingRef.current = true
    setShowConfirm(false); setSellReason(null)
    const key = pendingVote.claim.term_id
    setVoteStatus(prev => ({ ...prev, [key]: 'pending' }))
    try {
      const { getWalletClient } = await import('@wagmi/core')
      const { config: wagmiConfig } = await import('@/lib/wagmi')
      const freshWalletClient = walletClient ?? await getWalletClient(wagmiConfig)
      if (!freshWalletClient) throw new Error('Wallet client unavailable — please reconnect')
      const { createWriteConfig, depositToVault, redeemFromVault } = await import('@/lib/intuition')
      const cfg = createWriteConfig(freshWalletClient, publicClient)

      if (pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust') {
        const isDistrust = pendingVote.type === 'redeem_distrust'
        const redeemVaultId = isDistrust ? pendingVote.counterTermId : pendingVote.claim.term_id
        if (!redeemVaultId) { alert('Vault not found'); return }
        const freshPos = await fetchUserPosition(pendingVote.claim.term_id, address!, isDistrust ? redeemVaultId : null)
        const rawPos = isDistrust ? freshPos.againstRawPositions : freshPos.rawPositions
        const freshSharesRaw = rawPos[0]?.shares ?? '0'
        let freshSharesBig = 0n; try { freshSharesBig = BigInt(freshSharesRaw) } catch { freshSharesBig = 0n }
        if (freshSharesBig === 0n) { alert('No shares to redeem'); return }
        await redeemFromVault(cfg, redeemVaultId as `0x${string}`, freshSharesBig)
      } else if (pendingVote.type === 'trust') {
        await depositToVault(cfg, pendingVote.claim.term_id as `0x${string}`, parseAmount(pendingVote.amount))
      } else if (pendingVote.type === 'distrust') {
        if (!pendingVote.counterTermId) {
          // Need to create triple first (Oppose vault)
          setCreatingTriple(true)
          const { createWriteConfig: cwc, createTrustTriple } = await import('@/lib/intuition')
          const triple = await createTrustTriple(pendingVote.claim.term_id as `0x${string}`, cfg)
          setClaimTriple({ termId: triple.termId, counterTermId: triple.counterTermId, loading: false })
          setCreatingTriple(false)
          await depositToVault(cfg, triple.counterTermId, parseAmount(pendingVote.amount))
        } else {
          await depositToVault(cfg, pendingVote.counterTermId as `0x${string}`, parseAmount(pendingVote.amount))
        }
      }

      setVoteStatus(prev => ({ ...prev, [key]: 'success' }))
      setToast('Transaction confirmed! Refreshing...')
      setTimeout(() => setToast(null), 4000)
      await fetchClaims(searchTerm)
      if (selectedClaim) {
        await refreshPositionsAndSupply(selectedClaim.term_id, claimTriple.counterTermId, false)
        if (address) {
          const newPos = await fetchUserPosition(selectedClaim.term_id, address, claimTriple.counterTermId)
          setUserPosition(newPos)
        }
      }
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
    return [...allPositions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [allPositions])

  // ── Atom type color helper ──
  const atomColor = (type: string) => type === 'agent' ? { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', text: '#818cf8' } : { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' }

  return (
    <PageBackground image="diagonal" opacity={0.3}>
      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">💬 Claims Registry</h1>
                <p className="text-slate-400">On-chain relationship claims between Agents and Skills</p>
              </div>
              <Button onClick={() => setShowCreateModal(true)} className="glow-blue shrink-0">
                + Create Claim
              </Button>
            </div>
          </motion.div>

          {/* Search + Filters */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6 space-y-3">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search claims by subject..."
              className="w-full px-4 py-3 glass rounded-xl border border-white/10 focus:ring-2 focus:ring-primary outline-none bg-transparent"
            />
            <div className="flex gap-2 flex-wrap">
              {CLAIM_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilterValue(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    filterValue === f.value
                      ? 'bg-primary/20 border-primary/40 text-white'
                      : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {f.label}
                </button>
              ))}
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
              <p className="text-4xl mb-4">💬</p>
              <p className="text-slate-400 mb-2">No claims found</p>
              <p className="text-slate-500 text-sm mb-6">Be the first to create an on-chain relationship claim</p>
              <Button onClick={() => setShowCreateModal(true)}>+ Create First Claim</Button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClaims.map((claim, i) => {
                const predCfg = claim.predicate.config
                const sc = atomColor(claim.subject.type)
                const oc = atomColor(claim.object.type)
                const tierCfg = calculateTier(claim.stakers_count || 0, claim.trust_score || 0, 50, getAgentAgeDays(claim.created_at))
                const score = claim.trust_score ?? 0
                return (
                  <motion.div
                    key={claim.term_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelectedClaim(claim); setActiveTab('overview') }}
                    className="glass-card rounded-xl p-4 cursor-pointer hover:bg-white/[0.04] transition-all border border-white/5 hover:border-white/10"
                  >
                    {/* Triple display */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                        {claim.subject.type === 'agent' ? '🤖' : '⚡'} {getAtomName(claim.subject.label)}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: (predCfg?.color ?? '#6b7280') + '15', border: `1px solid ${(predCfg?.color ?? '#6b7280')}30`, color: predCfg?.color ?? '#9ca3af' }}>
                        {predCfg?.icon ?? '💬'} {claim.predicate.label}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: oc.bg, border: `1px solid ${oc.border}`, color: oc.text }}>
                        {claim.object.type === 'agent' ? '🤖' : '⚡'} {getAtomName(claim.object.label)}
                      </span>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrustTierBadge tier={tierCfg} size="sm" />
                        <span className="text-xs text-slate-500">{claim.stakers_count ?? 0} stakers</span>
                      </div>
                      <span className={cn('text-sm font-bold font-mono', score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-slate-400')}>
                        {score}
                      </span>
                    </div>
                    {/* Bar */}
                    <div className="w-full h-1 bg-white/5 rounded-full mt-2.5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(100, score)}%` }} />
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Create Claim Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
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
                      setToast('Claim created on Intuition!')
                      setTimeout(() => setToast(null), 4000)
                      fetchClaims(searchTerm)
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
      <AnimatePresence>
        {selectedClaim && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedClaim(null)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-2xl z-50 overflow-y-auto bg-[rgb(10,10,15)] border-l border-white/10 shadow-2xl"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(() => {
                        const sc = atomColor(selectedClaim.subject.type)
                        const oc = atomColor(selectedClaim.object.type)
                        const predCfg = selectedClaim.predicate.config
                        return (<>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                            {selectedClaim.subject.type === 'agent' ? '🤖' : '⚡'} {getAtomName(selectedClaim.subject.label)}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: (predCfg?.color ?? '#6b7280') + '15', border: `1px solid ${(predCfg?.color ?? '#6b7280')}30`, color: predCfg?.color ?? '#9ca3af' }}>
                            {predCfg?.icon ?? '💬'} {selectedClaim.predicate.label}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: oc.bg, border: `1px solid ${oc.border}`, color: oc.text }}>
                            {selectedClaim.object.type === 'agent' ? '🤖' : '⚡'} {getAtomName(selectedClaim.object.label)}
                          </span>
                        </>)
                      })()}
                    </div>
                    <p className="text-xs text-slate-500">
                      {selectedClaim.creator?.label ? `by ${selectedClaim.creator.label}` : 'Unknown creator'} · {new Date(selectedClaim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => setSelectedClaim(null)} className="ml-4 p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Bonding Curve Market */}
                <div className="glass rounded-xl p-5 mb-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Bonding Curve Market</h3>

                  {/* Support / Oppose */}
                  <div className="flex gap-1 p-1 bg-black/40 rounded-lg mb-4">
                    {(['support', 'oppose'] as const).map(side => (
                      <button key={side} onClick={() => { setSignalSide(side); setTradeAction('buy') }}
                        className={cn('flex-1 py-2 rounded-md text-sm font-semibold transition-all',
                          signalSide === side
                            ? side === 'support' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'text-slate-400 hover:text-white'
                        )}>
                        {side === 'support' ? '▲ Support' : '▼ Oppose'}
                      </button>
                    ))}
                  </div>

                  {/* Buy / Sell */}
                  <div className="flex gap-1 p-1 bg-black/20 rounded-lg mb-4">
                    {(['buy', 'sell'] as const).map(action => (
                      <button key={action} onClick={() => setTradeAction(action)}
                        className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-all',
                          tradeAction === action ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-white'
                        )}>
                        {action === 'buy' ? 'Buy' : 'Sell'}
                      </button>
                    ))}
                  </div>

                  {tradeAction === 'buy' ? (
                    <>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-3">
                          <input type="number" value={voteAmount} onChange={e => setVoteAmount(e.target.value)} min="0.001" step="0.01"
                            className="flex-1 px-3 py-2 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none font-mono text-sm" />
                          <span className="text-sm text-slate-400 shrink-0">tTRUST</span>
                        </div>
                        <div className="flex gap-2">
                          {['0.01', '0.05', '0.1', '0.5'].map(v => (
                            <button key={v} onClick={() => setVoteAmount(v)} className={cn('px-2.5 py-1 rounded text-xs font-mono transition-all border', voteAmount === v ? 'bg-primary/20 border-primary/40 text-white' : 'border-white/10 text-slate-400 hover:text-white')}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {buyPreview && (
                        <div className="text-xs text-slate-500 mb-3 space-y-1">
                          <div className="flex justify-between"><span>Shares to receive</span><span className="text-white font-mono">{buyPreview.sharesReceived.toFixed(4)}</span></div>
                          <div className="flex justify-between"><span>Price per share</span><span className="text-white font-mono">{buyPreview.avgPricePerShare.toFixed(6)} tTRUST</span></div>
                        </div>
                      )}
                      <Button
                        onClick={() => {
                          setPendingVote({ type: signalSide === 'support' ? 'trust' : 'distrust', claim: selectedClaim, amount: voteAmount, counterTermId: claimTriple.counterTermId })
                          setShowConfirm(true)
                        }}
                        disabled={!isConnected || parseFloat(voteAmount) <= 0}
                        className={cn('w-full', signalSide === 'support' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-700 hover:bg-red-600')}
                      >
                        {signalSide === 'support' ? '▲ Support Claim' : '▼ Oppose Claim'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-slate-500 mb-3 flex justify-between">
                        <span>Your {signalSide} shares</span>
                        <span className="text-white font-mono">{(Number(userSharesBigInt) / 1e18).toFixed(4)}</span>
                      </div>
                      <input type="number" value={redeemShares} onChange={e => setRedeemShares(e.target.value)} min="0" step="0.001"
                        placeholder="Shares to redeem"
                        className="w-full px-3 py-2 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none font-mono text-sm mb-3" />
                      {redeemAmount && (
                        <div className="text-xs text-slate-500 mb-3">
                          <div className="flex justify-between"><span>You receive</span><span className="text-white font-mono">{redeemAmount.toFixed(6)} tTRUST</span></div>
                        </div>
                      )}
                      {sellReason && (
                        <div className="p-3 rounded-lg mb-3 text-xs bg-white/5">
                          {getSellReasonConfig(sellReason).icon} {getSellReasonConfig(sellReason).label}
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="text-xs text-slate-500 mb-2">Reason for selling</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SELL_REASONS.map(cfg => (
                            <button key={cfg.id} onClick={() => setSellReason(cfg.id)} className={cn('px-2 py-1 rounded text-xs transition-all border', sellReason === cfg.id ? 'bg-primary/20 border-primary/40 text-white' : 'border-white/10 text-slate-400 hover:text-white')}>
                              {cfg.icon} {cfg.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button onClick={() => {
                        setPendingVote({ type: signalSide === 'support' ? 'redeem_trust' : 'redeem_distrust', claim: selectedClaim, amount: redeemShares, counterTermId: claimTriple.counterTermId })
                        setShowConfirm(true)
                      }} disabled={!isConnected || !userPosition.forShares && !userPosition.againstShares} variant="outline" className="w-full">
                        Sell Shares
                      </Button>
                    </>
                  )}

                  {/* Supply stats */}
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-slate-500 mb-1">Support Pool</p><p className="font-mono font-bold text-emerald-400">{supportSupply.toFixed(4)} shares</p></div>
                    <div><p className="text-slate-500 mb-1">Oppose Pool</p><p className="font-mono font-bold text-red-400">{opposeSupply.toFixed(4)} shares</p></div>
                  </div>
                </div>

                {/* Trust Score */}
                {claimTier && (
                  <div className="glass rounded-xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Trust Score</h3>
                      <TrustTierBadgeWithProgress tier={claimTier} progress={calculateTierProgress(combinedStakerCount, supportSupply, 50, getAgentAgeDays(selectedClaim?.created_at ?? ''))} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="glass rounded-lg p-3 text-center">
                        <p className="text-slate-500 mb-1">Score</p>
                        <p className="text-2xl font-bold font-mono">{selectedClaim.trust_score ?? 0}</p>
                      </div>
                      <div className="glass rounded-lg p-3 text-center">
                        <p className="text-slate-500 mb-1">Stakers</p>
                        <p className="text-2xl font-bold font-mono">{combinedStakerCount}</p>
                      </div>
                      <div className="glass rounded-lg p-3 text-center">
                        <p className="text-slate-500 mb-1">Composite</p>
                        <p className="text-2xl font-bold font-mono">{compositeTrust?.score ?? '-'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-black/30 rounded-lg mb-4">
                  {(['overview', 'attestations', 'activity'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={cn('flex-1 py-2 rounded-md text-xs font-medium capitalize transition-all',
                        activeTab === tab ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-white'
                      )}>
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Bonding Curve Chart */}
                    {curveData.length > 0 && (
                      <div className="glass rounded-xl p-4">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Bonding Curve</h4>
                        <ResponsiveContainer width="100%" height={120}>
                          <AreaChart data={curveData}>
                            <defs>
                              <linearGradient id="claimCurveGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="supply" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => v.toFixed(1)} />
                            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => v.toFixed(3)} width={45} />
                            <Tooltip formatter={((v: number) => [`${(v as number).toFixed(4)} tTRUST`, 'Price']) as any} contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                            <Area type="monotone" dataKey="price" stroke="#6366f1" fill="url(#claimCurveGrad)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Positions leaderboard */}
                    {enrichedPositions.length > 0 && (
                      <div className="glass rounded-xl p-4">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Stakers ({combinedStakerCount})</h4>
                        <div className="space-y-2">
                          {enrichedPositions.slice(0, 8).map((pos, idx) => {
                            const isOppose = claimTriple.counterTermId && pos.term_id === claimTriple.counterTermId
                            const shares = Number(pos.shares || '0') / 1e18
                            return (
                              <div key={pos.account_id + pos.term_id} className="flex items-center gap-3">
                                <EarlySupporterBadge rank={idx + 1} />
                                <span className="flex-1 text-xs text-slate-300 truncate font-mono">{pos.account?.label || pos.account_id?.slice(0, 8) + '...'}</span>
                                <span className={cn('text-xs font-mono', isOppose ? 'text-red-400' : 'text-emerald-400')}>
                                  {isOppose ? '▼' : '▲'} {shares.toFixed(3)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Claim details */}
                    <div className="glass rounded-xl p-4">
                      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Claim Details</h4>
                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd>Triple Claim</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Subject Type</dt><dd className="capitalize">{selectedClaim.subject.type}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Object Type</dt><dd className="capitalize">{selectedClaim.object.type}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Created</dt><dd>{new Date(selectedClaim.created_at).toLocaleDateString()}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Term ID</dt><dd className="font-mono text-emerald-400 text-[10px] truncate max-w-[180px]">{selectedClaim.term_id}</dd></div>
                      </dl>
                    </div>
                  </div>
                )}

                {/* Attestations Tab */}
                {activeTab === 'attestations' && (
                  <div className="space-y-2">
                    {claimSignals.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-8">No signals yet. Be the first to stake!</p>
                    ) : claimSignals.map((sig: any) => {
                      const delta = Number(sig.delta || '0')
                      const isPos = delta > 0
                      return (
                        <div key={sig.id} className="flex items-center gap-3 p-3 glass rounded-lg text-xs">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0', isPos ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                            {isPos ? '▲' : '▼'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 truncate">{sig.account?.label || sig.account_id?.slice(0, 10) + '...'}</p>
                            <p className="text-slate-500">{new Date(sig.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={cn('font-mono font-bold', isPos ? 'text-emerald-400' : 'text-red-400')}>
                            {isPos ? '+' : ''}{(delta / 1e18).toFixed(4)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="space-y-2">
                    {claimSignals.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-8">No activity yet</p>
                    ) : claimSignals.map((sig: any) => {
                      const delta = Number(sig.delta || '0')
                      const isDeposit = sig.deposit_id
                      return (
                        <div key={sig.id} className="flex items-center gap-3 p-3 glass rounded-lg text-xs">
                          <span className="text-lg">{isDeposit ? '⬆️' : '⬇️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300">{isDeposit ? 'Stake' : 'Redeem'} by {sig.account?.label || sig.account_id?.slice(0, 8) + '...'}</p>
                            <p className="text-slate-500">{new Date(sig.created_at).toLocaleDateString()}</p>
                          </div>
                          <a href={`https://testnet.explorer.intuition.systems/tx/${sig.transaction_hash}`} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline shrink-0">→</a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {showConfirm && pendingVote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60" onClick={() => setShowConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-96 z-[61]">
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4">Confirm Transaction</h3>
                <dl className="space-y-2 text-sm mb-6">
                  <div className="flex justify-between"><dt className="text-slate-400">Action</dt><dd className="capitalize">{pendingVote.type.replace('_', ' ')}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Claim</dt><dd className="text-xs truncate max-w-[200px]">{formatClaimText(pendingVote.claim)}</dd></div>
                  {pendingVote.amount && <div className="flex justify-between"><dt className="text-slate-400">Amount</dt><dd className="font-mono">{pendingVote.amount} tTRUST</dd></div>}
                </dl>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">Cancel</Button>
                  <Button onClick={executeVote} className="flex-1 glow-blue">Confirm</Button>
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
    </PageBackground>
  )
}
