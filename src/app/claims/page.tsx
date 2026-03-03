'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther, getAddress } from 'viem'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import {
  createWriteConfig,
  depositToVault,
  redeemFromVault,
  getVaultSupply,
} from '@/lib/intuition'
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
  const [showOnlyOurs, setShowOnlyOurs] = useState(true)
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
        setClaimTriple(prev => ({ ...prev, counterTermId }))
        await depositToVault(cfg, counterTermId as `0x${string}`, parseAmount(pendingVote.amount))
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
            <div className="flex gap-2 flex-wrap items-center">
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
              <div className="flex-1" />
              <button
                onClick={() => setShowOnlyOurs(v => !v)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  showOnlyOurs
                    ? 'bg-[#1f6feb20] border-[#1f6feb50] text-[#58a6ff]'
                    : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                {showOnlyOurs ? '🔵 Platform only' : '🌐 All Intuition'}
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
      {selectedClaim && (
        <div className="fixed inset-0 top-[64px] bg-black/80 backdrop-blur-sm z-40 overflow-y-auto">
          <div className="min-h-full p-4 flex items-start justify-center">
            <div className="w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>

              {/* === TOP CARD: Claim Header === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 mb-3">
                <div className="flex items-start gap-4 mb-4">
                  {/* Triple icon */}
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 bg-indigo-500/10 border-2 border-indigo-500/30">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M10 3H6a2 2 0 00-2 2v14c0 1.1.9 2 2 2h4M16 17l5-5-5-5M21 12H9" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Triple chips + meta */}
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
                    <div className="flex items-center gap-2 text-sm text-[#8b949e]">
                      {selectedClaim.creator?.id ? (
                        <a href={`/profile/${selectedClaim.creator.id}`} className="bg-[#21262d] px-2 py-0.5 rounded text-xs hover:bg-[#30363d] hover:text-white transition-colors">
                          {selectedClaim.creator.label || selectedClaim.creator.id.slice(0, 10)}
                        </a>
                      ) : selectedClaim.creator?.label ? (
                        <span className="bg-[#21262d] px-2 py-0.5 rounded text-xs">{selectedClaim.creator.label}</span>
                      ) : null}
                      <span>·</span>
                      <span>{new Date(selectedClaim.created_at).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedClaim(null)}
                    className="w-8 h-8 rounded-lg bg-[#21262d] hover:bg-[#30363d] flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#8b949e" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Term ID row */}
                <div className="flex items-center gap-2 text-sm mb-5">
                  <span className="text-[#8b949e] w-16 flex-shrink-0">Term ID:</span>
                  <code className="text-[#8b949e] text-xs font-mono">
                    {selectedClaim.term_id.slice(0, 14)}...{selectedClaim.term_id.slice(-8)}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedClaim.term_id)}
                    className="text-[#8b949e] hover:text-white transition-colors"
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
                    <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-xs text-[#8b949e] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* === ACTION CARD: Bonding Curve Market === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-5 mb-3">
                <p className="text-[#8b949e] text-xs font-semibold mb-1">Bonding Curve Market</p>
                <p className="text-[#6b7280] text-xs mb-3">Choose side (Support/Oppose) and action (Buy/Sell).</p>

                {/* Support / Oppose */}
                <div className="flex rounded-xl overflow-hidden border border-[#21262d] mb-3">
                  {(['support', 'oppose'] as const).map(side => (
                    <button key={side} onClick={(e) => { e.stopPropagation(); setSignalSide(side); setTradeAction('buy') }}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${
                        signalSide === side
                          ? side === 'support' ? 'bg-[#2d7a5f] text-white' : 'bg-[#8b3a3a] text-white'
                          : 'bg-transparent text-[#8b949e] hover:text-white'
                      }`}>
                      {side === 'support' ? '▲ Support' : '▼ Oppose'}
                    </button>
                  ))}
                </div>

                {/* Buy / Sell */}
                <div className="flex rounded-xl overflow-hidden border border-[#21262d] mb-4">
                  {(['buy', 'sell'] as const).map(action => (
                    <button key={action} onClick={(e) => { e.stopPropagation(); setTradeAction(action) }}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${
                        tradeAction === action ? 'bg-white text-black' : 'bg-transparent text-[#8b949e] hover:text-white'
                      }`}>
                      {action === 'buy' ? 'Buy' : 'Sell'}
                    </button>
                  ))}
                </div>

                {tradeAction === 'buy' ? (
                  <>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-3">
                        <input type="number" value={voteAmount} onChange={e => setVoteAmount(e.target.value)} min="0.001" step="0.01"
                          className="flex-1 px-3 py-2 bg-[#161b22] border border-[#21262d] rounded-lg text-white focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono text-sm" />
                        <span className="text-sm text-[#8b949e] shrink-0">tTRUST</span>
                      </div>
                      <div className="flex gap-2">
                        {['0.01', '0.05', '0.1', '0.5'].map(v => (
                          <button key={v} onClick={() => setVoteAmount(v)}
                            className={cn('px-2.5 py-1 rounded text-xs font-mono transition-all border',
                              voteAmount === v ? 'bg-indigo-500/20 border-indigo-500/40 text-white' : 'border-[#21262d] text-[#8b949e] hover:text-white'
                            )}>{v}</button>
                        ))}
                      </div>
                    </div>
                    {buyPreview && (
                      <div className="text-xs text-[#8b949e] mb-3 space-y-1">
                        <div className="flex justify-between"><span>Shares to receive</span><span className="text-white font-mono">{buyPreview.sharesReceived.toFixed(4)}</span></div>
                        <div className="flex justify-between"><span>Price per share</span><span className="text-white font-mono">{buyPreview.avgPricePerShare.toFixed(6)} tTRUST</span></div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setPendingVote({ type: signalSide === 'support' ? 'trust' : 'distrust', claim: selectedClaim, amount: voteAmount, counterTermId: claimTriple.counterTermId })
                        setShowConfirm(true)
                      }}
                      disabled={!isConnected || parseFloat(voteAmount) <= 0}
                      className={cn(
                        'w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50',
                        signalSide === 'support' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-700 hover:bg-red-600 text-white'
                      )}
                    >
                      {signalSide === 'support' ? '▲ Support Claim' : '▼ Oppose Claim'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-[#8b949e] mb-3 flex justify-between">
                      <span>Your {signalSide} shares</span>
                      <span className="text-white font-mono">{(Number(userSharesBigInt) / 1e18).toFixed(4)}</span>
                    </div>
                    <input type="number" value={redeemShares} onChange={e => setRedeemShares(e.target.value)} min="0" step="0.001"
                      placeholder="Shares to redeem"
                      className="w-full px-3 py-2 bg-[#161b22] border border-[#21262d] rounded-lg text-white focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono text-sm mb-3" />
                    {redeemAmount && (
                      <div className="text-xs text-[#8b949e] mb-3">
                        <div className="flex justify-between"><span>You receive</span><span className="text-white font-mono">{redeemAmount.toFixed(6)} tTRUST</span></div>
                      </div>
                    )}
                    {sellReason && (
                      <div className="p-3 rounded-lg mb-3 text-xs bg-white/5">
                        {getSellReasonConfig(sellReason).icon} {getSellReasonConfig(sellReason).label}
                      </div>
                    )}
                    <div className="mb-3">
                      <p className="text-xs text-[#8b949e] mb-2">Reason for selling</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SELL_REASONS.map(cfg => (
                          <button key={cfg.id} onClick={() => setSellReason(cfg.id)}
                            className={cn('px-2 py-1 rounded text-xs transition-all border',
                              sellReason === cfg.id ? 'bg-indigo-500/20 border-indigo-500/40 text-white' : 'border-[#21262d] text-[#8b949e] hover:text-white'
                            )}>
                            {cfg.icon} {cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPendingVote({ type: signalSide === 'support' ? 'redeem_trust' : 'redeem_distrust', claim: selectedClaim, amount: redeemShares, counterTermId: claimTriple.counterTermId })
                        setShowConfirm(true)
                      }}
                      disabled={!isConnected || (!userPosition.forShares && !userPosition.againstShares)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold border border-[#21262d] text-[#8b949e] hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
                    >
                      Sell Shares
                    </button>
                  </>
                )}
              </div>

              {/* === TABS CARD: Trust Score + Overview / Attestations / Activity === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-5">

                {/* Trust Score */}
                {claimTier && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[#8b949e] text-xs font-semibold">Trust Score</p>
                      <TrustTierBadgeWithProgress tier={claimTier} progress={calculateTierProgress(combinedStakerCount, supportSupply, 50, getAgentAgeDays(selectedClaim?.created_at ?? ''))} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: selectedClaim.trust_score ?? 0, label: 'Score' },
                        { value: combinedStakerCount, label: 'Stakers' },
                        { value: compositeTrust?.score ?? '-', label: 'Composite' },
                      ].map((s, i) => (
                        <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-white font-mono">{s.value}</p>
                          <p className="text-xs text-[#8b949e] mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex rounded-xl overflow-hidden border border-[#21262d] mb-4">
                  {(['overview', 'attestations', 'activity'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                        activeTab === tab ? 'bg-white/15 text-white' : 'text-[#8b949e] hover:text-white'
                      }`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-3">
                    {curveData.length > 0 && (
                      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                        <h4 className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-3">Bonding Curve</h4>
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

                    {enrichedPositions.length > 0 && (
                      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                        <h4 className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-3">Stakers ({combinedStakerCount})</h4>
                        <div className="space-y-2">
                          {enrichedPositions.slice(0, 8).map((pos, idx) => {
                            const isOppose = claimTriple.counterTermId && pos.term_id === claimTriple.counterTermId
                            const shares = Number(pos.shares || '0') / 1e18
                            return (
                              <div key={pos.account_id + pos.term_id} className="flex items-center gap-3">
                                <EarlySupporterBadge rank={idx + 1} />
                                <span className="flex-1 text-xs text-[#8b949e] truncate font-mono">{pos.account?.label || pos.account_id?.slice(0, 8) + '...'}</span>
                                <span className={cn('text-xs font-mono', isOppose ? 'text-red-400' : 'text-emerald-400')}>
                                  {isOppose ? '▼' : '▲'} {shares.toFixed(3)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                      <h4 className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-3">Claim Details</h4>
                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between"><dt className="text-[#8b949e]">Type</dt><dd>Triple Claim</dd></div>
                        <div className="flex justify-between"><dt className="text-[#8b949e]">Subject Type</dt><dd className="capitalize">{selectedClaim.subject.type}</dd></div>
                        <div className="flex justify-between"><dt className="text-[#8b949e]">Object Type</dt><dd className="capitalize">{selectedClaim.object.type}</dd></div>
                        <div className="flex justify-between"><dt className="text-[#8b949e]">Created</dt><dd>{new Date(selectedClaim.created_at).toLocaleDateString()}</dd></div>
                        <div className="flex justify-between"><dt className="text-[#8b949e]">Term ID</dt><dd className="font-mono text-emerald-400 text-[10px] truncate max-w-[180px]">{selectedClaim.term_id}</dd></div>
                      </dl>
                    </div>
                  </div>
                )}

                {/* Attestations Tab */}
                {activeTab === 'attestations' && (
                  <div className="space-y-2">
                    {claimSignals.length === 0 ? (
                      <p className="text-center text-[#8b949e] text-sm py-8">No signals yet. Be the first to stake!</p>
                    ) : claimSignals.map((sig: any) => {
                      const delta = Number(sig.delta || '0')
                      const isPos = delta > 0
                      const accountLabel = sig.account?.label || sig.account_id?.slice(0, 10) + '...'
                      return (
                        <div key={sig.id} className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#21262d] rounded-lg text-xs">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0', isPos ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                            {isPos ? '▲' : '▼'}
                          </div>
                          <div className="flex-1 min-w-0">
                            {sig.account_id ? (
                              <a href={`/profile/${sig.account_id}`} className="text-[#8b949e] hover:text-[#58a6ff] truncate block transition-colors">{accountLabel}</a>
                            ) : (
                              <p className="text-[#8b949e] truncate">{accountLabel}</p>
                            )}
                            <p className="text-[#6b7280]">{new Date(sig.created_at).toLocaleDateString()}</p>
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
                      <p className="text-center text-[#8b949e] text-sm py-8">No activity yet</p>
                    ) : claimSignals.map((sig: any) => {
                      const isDeposit = sig.deposit_id
                      return (
                        <div key={sig.id} className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#21262d] rounded-lg text-xs">
                          <span className="text-lg">{isDeposit ? '⬆️' : '⬇️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[#8b949e]">{isDeposit ? 'Stake' : 'Redeem'} by {sig.account?.label || sig.account_id?.slice(0, 8) + '...'}</p>
                            <p className="text-[#6b7280]">{new Date(sig.created_at).toLocaleDateString()}</p>
                          </div>
                          <a href={`https://testnet.explorer.intuition.systems/tx/${sig.transaction_hash}`} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] hover:underline shrink-0">→</a>
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
