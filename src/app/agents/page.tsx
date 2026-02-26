'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther, getAddress } from 'viem'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
// Categories unused — filter now uses trust levels directly
import { calculateTrustScoreFromStakes, type TrustScoreResult } from '@/lib/trust-score-engine'
import { getCurrentPrice, calculateBuy, calculateSell, getSellProceeds, generateCurveData } from '@/lib/bonding-curve'
import { calculateTier, calculateTierProgress, getAgentAgeDays } from '@/lib/trust-tiers'
import { calculateWeightedTrust } from '@/lib/reputation-decay'
import { TrustTierBadge, TrustTierBadgeWithProgress } from '@/components/agents/TrustTierBadge'
import { EarlySupporterBadge } from '@/components/agents/EarlySupporterBadge'

// Real agents loaded from Intuition testnet via GraphQL
const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

interface GraphQLAgent {
  term_id: string
  label: string
  type: string
  created_at: string
  emoji?: string
  creator?: { label: string; id?: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
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

function AgentsPageContent() {
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { connector } = useAccount()

  const [agents, setAgents] = useState<GraphQLAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'newest' | 'score_desc' | 'score_asc' | 'stakers' | 'stake'>('newest')
  const [selectedAgent, setSelectedAgent] = useState<GraphQLAgent | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'attestations' | 'activity'>('overview')
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
    counterTermId?: string | null  // triple AGAINST vault — captured at click time
    tripleTermId?: string | null   // triple FOR vault — needed to seed before AGAINST deposit
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
  }>({ termId: null, counterTermId: null, loading: false })
  const [creatingTriple, setCreatingTriple] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
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
  const [supportSupply, setSupportSupply] = useState(0)
  const [opposeSupply, setOpposeSupply] = useState(0)
  const [pageError, setPageError] = useState<string | null>(null)

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

  const fetchAgents = async (search = '') => {
    setLoading(true)
    setError(null)
    try {
      // Build where clause: always filter by "Agent:" prefix
      const whereConditions = [
        `{ label: { _ilike: "Agent:%"} }`
      ]

      // Add search filter if provided
      if (search) {
        whereConditions.push(`{ label: { _ilike: "%${search}%" } }`)
      }

      const whereClause = whereConditions.length > 0
        ? `where: { _and: [${whereConditions.join(', ')}] }`
        : ''

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              atoms(
                ${whereClause}
                limit: 50
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
              }
            }
          `
        })
      })
      const data = await response.json()
      if (data.errors) throw new Error(data.errors[0].message)

      // All atoms already filtered by "Agent:" prefix in GraphQL
      setAgents(data.data.atoms || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  // Auto-open agent modal when ?open=TERM_ID is in URL
  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && agents.length > 0 && !selectedAgent) {
      const match = agents.find(a => a.term_id === openId)
      if (match) {
        setSelectedAgent(match)
      }
    }
  }, [agents, searchParams])

  useEffect(() => {
    const timer = setTimeout(() => fetchAgents(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

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

  // Fetch full signals list when modal opens (needed for chart + attestations + activity)
  useEffect(() => {
    if (!selectedAgent) return

    setSignalsLoading(true)
    setAgentSignals([])

    fetchAgentSignals(selectedAgent.term_id, agentTriple.counterTermId)
      .then(({ signals, totalCount }) => {
        setAgentSignals(signals)
        setAgentSignalsCount(totalCount)
      })
      .finally(() => setSignalsLoading(false))
  }, [selectedAgent?.term_id, agentTriple.counterTermId])

  const fetchUserPosition = async (
    agentTermId: string,
    userAddress: string,
    counterTermId?: string | null
  ) => {
    try {
      const checksummedAddress = userAddress ? getAddress(userAddress) : ''

      // Query FOR position (atom's own vault)
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
          variables: { termId: agentTermId, address: checksummedAddress },
        }),
      })
      const forData = await forRes.json()
      const forPos = forData.data?.forPositions || []
      const forSharesRaw = forPos[0]?.shares
      const forShares = (forSharesRaw && BigInt(forSharesRaw) > 0n) ? forSharesRaw : null

      // Query AGAINST position (triple counter vault) if counterTermId is known
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
            variables: { termId: counterTermId, address: checksummedAddress },
          }),
        })
        const agData = await agRes.json()
        againstRawPositions = agData.data?.againstPositions || []
        const agSharesRaw = againstRawPositions[0]?.shares
        againstShares = (agSharesRaw && BigInt(agSharesRaw) > 0n) ? agSharesRaw : null
      }

      console.log('fetchUserPosition:', { termId: agentTermId, counterTermId, forShares, againstShares })
      return { forShares, againstShares, rawPositions: forPos, againstRawPositions }
    } catch (e) {
      console.error('fetchUserPosition error:', e)
      return { forShares: null, againstShares: null, rawPositions: [], againstRawPositions: [] }
    }
  }

  const fetchVaultSharesForUser = async (termId: string, userAddress: string): Promise<bigint> => {
    try {
      const checksummedAddress = getAddress(userAddress)
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetVaultPosition($termId: String!, $address: String!) {
              positions(
                where: { term_id: { _eq: $termId }, account_id: { _eq: $address } }
                limit: 1
              ) {
                shares
              }
            }
          `,
          variables: { termId, address: checksummedAddress },
        }),
      })
      const data = await res.json()
      const shares = data?.data?.positions?.[0]?.shares
      return shares ? BigInt(shares) : 0n
    } catch (err) {
      console.warn('fetchVaultSharesForUser failed:', err)
      return 0n
    }
  }

  // Fetch ALL positions from both Support + Oppose vaults
  const fetchAllPositions = async (
    termId: string,
    counterTermId?: string | null
  ): Promise<{ positions: any[]; uniqueCount: number }> => {
    try {
      const termIds = [termId]
      if (counterTermId) termIds.push(counterTermId)

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetAllPositions($termIds: [String!]!) {
              positions(
                where: { term_id: { _in: $termIds } }
                order_by: { shares: desc }
                limit: 100
              ) {
                account_id
                account { label }
                shares
                term_id
                updated_at
              }
            }
          `,
          variables: { termIds }
        })
      })
      const data = await response.json()
      const raw = data.data?.positions || []
      // Only active holders (shares > 0)
      const active = raw.filter((p: any) => p.shares && BigInt(p.shares) > 0n)
      // Unique wallets
      const wallets = new Set(active.map((p: any) => p.account_id))
      return { positions: active, uniqueCount: wallets.size }
    } catch (e) {
      console.error('fetchAllPositions error:', e)
      return { positions: [], uniqueCount: 0 }
    }
  }

  // Fetch trust triple for selected agent (read-only, no wallet needed)
  useEffect(() => {
    if (!selectedAgent) {
      setAgentTriple({ termId: null, counterTermId: null, loading: false })
      return
    }
    setAgentTriple({ termId: null, counterTermId: null, loading: true })
    import('@/lib/intuition').then(({ findTrustTriple }) => {
      findTrustTriple(selectedAgent.term_id)
        .then(triple => setAgentTriple({
          termId: triple?.termId ?? null,
          counterTermId: triple?.counterTermId ?? null,
          loading: false,
        }))
        .catch(() => setAgentTriple({ termId: null, counterTermId: null, loading: false }))
    })
  }, [selectedAgent?.term_id])

  // Fetch user positions — re-fetches when triple counterTermId becomes available
  useEffect(() => {
    if (!selectedAgent || !address) return
    fetchUserPosition(selectedAgent.term_id, address, agentTriple.counterTermId).then(setUserPosition)
  }, [selectedAgent?.term_id, address, agentTriple.counterTermId])

  // Reusable: fetch positions + recompute supply in one shot
  const refreshPositionsAndSupply = async (
    termId: string,
    counterTermId?: string | null,
    showLoading = false
  ) => {
    if (showLoading) setPositionsLoading(true)
    try {
      // Fetch positions for the leaderboard table (runs in parallel with supply read)
      const positionsPromise = fetchAllPositions(termId, counterTermId)

      // PRIMARY: Read supply directly from contract — always up-to-date,
      // bypasses indexer lag that causes stale price/value after other wallets trade.
      if (publicClient) {
        try {
          const { getVaultSupply } = await import('@/lib/intuition')
          const [supShares, oppShares] = await Promise.all([
            getVaultSupply(publicClient, termId),
            counterTermId ? getVaultSupply(publicClient, counterTermId) : Promise.resolve(0),
          ])
          setSupportSupply(supShares)
          setOpposeSupply(oppShares)
        } catch (e) {
          console.warn('[supply] Contract read failed, falling back to indexer sum:', e)
          // Fallback computed below after positions resolve
        }
      }

      // Resolve positions for the leaderboard table
      const { positions, uniqueCount } = await positionsPromise
      setAllPositions(positions)
      setCombinedStakerCount(uniqueCount)

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

  // Fetch all positions when modal opens + poll every 15s while open
  useEffect(() => {
    if (!selectedAgent) {
      setAllPositions([])
      setCombinedStakerCount(0)
      setSupportSupply(0)
      setOpposeSupply(0)
      return
    }

    // Immediate fetch
    refreshPositionsAndSupply(
      selectedAgent.term_id,
      agentTriple.counterTermId,
      true // show loading spinner on first load
    )

    // Poll every 15s to catch other users' transactions
    const interval = setInterval(() => {
      refreshPositionsAndSupply(
        selectedAgent.term_id,
        agentTriple.counterTermId,
        false // silent refresh, no loading spinner
      )
    }, 15000)

    return () => clearInterval(interval)
  }, [selectedAgent?.term_id, agentTriple.counterTermId])

  // Compute trust score from real on-chain data whenever agent or triple changes
  useEffect(() => {
    if (!selectedAgent) {
      setAgentTrust(null)
      return
    }

    let supportWei = 0n
    try { supportWei = BigInt(selectedAgent.positions_aggregate?.aggregate?.sum?.shares || '0') } catch { supportWei = 0n }

    if (!agentTriple.counterTermId) {
      setAgentTrust(calculateTrustScoreFromStakes(supportWei, 0n))
      return
    }

    // Fetch oppose vault total shares from GraphQL
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetOpposeVault($termId: String!) {
            positions_aggregate(where: { term_id: { _eq: $termId } }) {
              aggregate {
                count
                sum { shares }
              }
            }
          }
        `,
        variables: { termId: agentTriple.counterTermId },
      }),
    })
      .then(r => r.json())
      .then(data => {
        let opposeWei = 0n
        try { opposeWei = BigInt(data?.data?.positions_aggregate?.aggregate?.sum?.shares || '0') } catch { opposeWei = 0n }
        setAgentTrust(calculateTrustScoreFromStakes(supportWei, opposeWei))
      })
      .catch(() => {
        setAgentTrust(calculateTrustScoreFromStakes(supportWei, 0n))
      })
  }, [selectedAgent?.term_id, selectedAgent?.positions_aggregate?.aggregate?.sum?.shares, agentTriple.counterTermId])

  // Reset redeem input when switching signal side to avoid stale values
  useEffect(() => {
    setRedeemShares('0')
  }, [signalSide])

  const executeVote = async () => {
    console.log('executeVote called with type:', pendingVote?.type)
    console.log('walletClient:', !!walletClient, 'publicClient:', !!publicClient)

    if (isExecutingRef.current) {
      console.log('Already executing, skipping')
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
      console.log('✅ import succeeded, keys:', Object.keys(intuitionLib))
    } catch (importErr: any) {
      console.error('❌ import failed:', importErr?.message)
      alert('Import error: ' + importErr?.message)
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
      console.log('walletClient fresh:', !!freshWalletClient)

      if (!freshWalletClient) {
        throw new Error('Wallet client unavailable — please reconnect your wallet')
      }

      const cfg = createWriteConfig(freshWalletClient, publicClient)
      console.log('✅ cfg created:', cfg)

      const agent = pendingVote.agent

      if (pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust') {
        console.log('=== REDEEM CASE ENTERED ===')
        console.log('type:', pendingVote.type, 'agent term_id:', agent.term_id, 'address:', address)

        let freshSharesRaw: string
        let redeemVaultId: `0x${string}`

        if (pendingVote.type === 'redeem_trust') {
          // FOR vault = atom's own term_id
          redeemVaultId = agent.term_id as `0x${string}`
          const freshPos2 = await fetchUserPosition(agent.term_id, address!)
          freshSharesRaw = freshPos2.rawPositions[0]?.shares ?? '0'
        } else {
          // AGAINST vault — use counterTermId captured at click time (agentTriple is reset by now)
          const counterTermId = pendingVote.counterTermId
          if (!counterTermId) {
            alert('Oppose vault not set up — please activate it first via the Oppose tab')
            return
          }
          redeemVaultId = counterTermId as `0x${string}`
          const freshPos2 = await fetchUserPosition(agent.term_id, address!, counterTermId)
          freshSharesRaw = freshPos2.againstRawPositions[0]?.shares ?? '0'
        }

        const freshShares = BigInt(freshSharesRaw)
        console.log('redeemVaultId:', redeemVaultId, 'freshSharesRaw:', freshSharesRaw, '→ BigInt:', freshShares.toString())

        if (freshShares === 0n) {
          alert(pendingVote.type === 'redeem_trust'
            ? 'No FOR shares to redeem — position may already be empty'
            : 'No AGAINST shares to redeem — you have not staked in the Oppose vault')
          return
        }

        const tx = await redeemFromVault(
          cfg,
          redeemVaultId,
          freshShares,
          address as `0x${string}`
        )
        console.log('✅ Redeem TX:', tx)

        // Refresh position after redeem — use pendingVote.counterTermId (agentTriple is reset by now)
        const updated = await fetchUserPosition(agent.term_id, address!, pendingVote.counterTermId)
        setUserPosition(updated)
        setToast(`Redeemed ${(Number(freshSharesRaw) / 1e18).toFixed(4)} shares!`)
        setTimeout(() => setToast(null), 4000)

      } else if (pendingVote.type === 'trust') {
        // Support → deposit into agent's atom vault (FOR)
        await depositToVault(cfg, agent.term_id as `0x${string}`, parseEther(pendingVote.amount))
      } else if (pendingVote.type === 'distrust') {
        // Oppose → deposit into triple's AGAINST vault (counter_term_id)
        // counterTermId and tripleTermId were captured at click time — agentTriple may be null now
        const { counterTermId, tripleTermId } = pendingVote
        if (!counterTermId) {
          alert('Oppose vault not set up — please activate it first via the Oppose tab')
          return
        }
        if (!tripleTermId) {
          alert('Oppose vault is not fully initialized. Please reopen the agent modal and try again.')
          return
        }
        console.log('distrust counterTermId:', counterTermId)
        console.log('distrust tripleTermId:', tripleTermId)

        // MultiVault enforces: user CANNOT hold shares in both FOR and AGAINST
        // vaults of the same triple simultaneously (HasCounterStake error).
        // Triple creation deposits into FOR on behalf of the creator, so we
        // must redeem any existing FOR shares before depositing into AGAINST.
        const existingForShares = address
          ? await fetchVaultSharesForUser(tripleTermId, address)
          : 0n

        if (existingForShares > 0n) {
          console.log(`Redeeming ${existingForShares} FOR shares from triple vault before AGAINST deposit...`)
          try {
            await redeemFromVault(
              cfg,
              tripleTermId as `0x${string}`,
              existingForShares,
              address as `0x${string}`
            )
            console.log('✅ FOR shares redeemed — clear to deposit into AGAINST')
          } catch (redeemErr: any) {
            console.error('❌ Failed to redeem FOR shares:', redeemErr)
            throw new Error(
              `Must clear FOR position before Opposing. Redeem failed: ${redeemErr?.message || 'unknown'}`
            )
          }
        }

        // Deposit into AGAINST vault
        await depositToVault(cfg, counterTermId as `0x${string}`, parseEther(pendingVote.amount))
      }

      setVoteStatus(prev => { const n = { ...prev }; delete n[agent.term_id]; return n })

      // Refetch after 2s (indexer lag) + again at 5s (backup)
      const refetchAll = () => {
        fetchAgents(searchTerm)
        fetchAgentSignals(agent.term_id, pendingVote.counterTermId)
          .then(({ signals, totalCount }) => {
            setAgentSignals(signals)
            setAgentSignalsCount(totalCount)
          })
        if (address) {
          fetchUserPosition(agent.term_id, address, pendingVote.counterTermId).then(setUserPosition)
        }
        refreshPositionsAndSupply(agent.term_id, pendingVote.counterTermId)
      }
      setTimeout(refetchAll, 2000)
      setTimeout(refetchAll, 5000)

    } catch (e: any) {
      console.error('❌ executeVote error:', e?.message, e)
      setVoteStatus(prev => { const n = { ...prev }; delete n[pendingVote.agent.term_id]; return n })
      alert(`Error: ${e?.message || 'Unknown error'}`)
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
      if (e?.message?.includes('InsufficientBalance') || e?.message?.includes('insufficient')) {
        alert('Insufficient tTRUST balance. Get tTRUST from the faucet at testnet.portal.intuition.systems')
      } else {
        alert(`Error creating Oppose vault: ${e?.message || 'Unknown error'}`)
      }
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

  // Fetch individual signals (deposit/redeem events) for an agent
  const fetchAgentSignals = async (
    agentTermId: string,
    counterTermId?: string | null
  ): Promise<{ signals: any[]; totalCount: number }> => {
    try {
      const termIds = [agentTermId]
      if (counterTermId) termIds.push(counterTermId)

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetSignals($termIds: [String!]!) {
              signals(
                where: { term_id: { _in: $termIds } }
                order_by: { created_at: desc }
                limit: 50
              ) {
                id
                delta
                account_id
                account { label }
                atom_id
                triple_id
                term_id
                created_at
                transaction_hash
                deposit_id
                redemption_id
              }
              signals_aggregate(where: { term_id: { _in: $termIds } }) {
                aggregate { count }
              }
            }
          `,
          variables: { termIds }
        })
      })
      const data = await response.json()
      return {
        signals: data.data?.signals || [],
        totalCount: data.data?.signals_aggregate?.aggregate?.count || 0
      }
    } catch (e) {
      console.error('Signals fetch error:', e)
      return { signals: [], totalCount: 0 }
    }
  }

  // Lightweight count-only query for stats grid
  const fetchAgentSignalsCount = async (
    agentTermId: string,
    counterTermId?: string | null
  ): Promise<number> => {
    try {
      const termIds = [agentTermId]
      if (counterTermId) termIds.push(counterTermId)

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetSignalsCount($termIds: [String!]!) {
              signals_aggregate(where: { term_id: { _in: $termIds } }) {
                aggregate { count }
              }
            }
          `,
          variables: { termIds }
        })
      })
      const data = await response.json()
      return data.data?.signals_aggregate?.aggregate?.count || 0
    } catch {
      return 0
    }
  }

  // Fetch reports for agent (count + details)
  const [reportCount, setReportCount] = useState(0)
  const [agentReports, setAgentReports] = useState<any[]>([])
  useEffect(() => {
    if (!selectedAgent) { setReportCount(0); setAgentReports([]); return }
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetReports($termId: String!) {
            triples(
              where: {
                subject_id: { _eq: $termId },
                predicate: { label: { _ilike: "reported_for_%" } }
              }
              order_by: { created_at: desc }
              limit: 20
            ) {
              id
              predicate { label }
              object { label }
              creator { label id }
              created_at
            }
            triples_aggregate(where: {
              subject_id: { _eq: $termId },
              predicate: { label: { _ilike: "reported_for_%" } }
            }) {
              aggregate { count }
            }
          }
        `,
        variables: { termId: selectedAgent.term_id }
      })
    })
      .then(r => r.json())
      .then(d => {
        setReportCount(d?.data?.triples_aggregate?.aggregate?.count || 0)
        setAgentReports(d?.data?.triples || [])
      })
      .catch(() => { setReportCount(0); setAgentReports([]) })
  }, [selectedAgent?.term_id])

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
      setToast('Report submitted on-chain!')
      setTimeout(() => setToast(null), 5000)
    } catch (e: any) {
      console.error('Report error:', e)
      if (e?.message?.includes('InsufficientBalance') || e?.message?.includes('insufficient')) {
        alert('Insufficient tTRUST balance.')
      } else {
        alert(`Report failed: ${e?.message || 'Unknown error'}`)
      }
    } finally {
      setReportSubmitting(false)
    }
  }

  // Helper: format stakes
  const formatStakes = (shares: string | null | undefined): string => {
    if (!shares) return '$0'
    const num = Number(shares) / 1e18
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
    if (num >= 1) return `$${num.toFixed(2)}`
    return `$${num.toFixed(4)}`
  }

  // Helper: trust score color (3 states matching shield colors)
  const getTrustColor = (score: number): string => {
    if (score >= 40) return '#34a872'   // green
    if (score >= 10) return '#c49a2a'   // orange
    return '#cd5c5c'                    // red
  }

  // Helper: clean agent name (remove "Agent: " prefix and description)
  const getAgentName = (label: string): string => {
    let name = label.replace(/^Agent:\s*/i, '')
    if (name.includes(' - ')) name = name.split(' - ')[0]
    return name.trim()
  }

  // Build trust ratio chart data from signals
  const buildTrustChartData = (signals: any[], counterTermId: string | null) => {
    if (signals.length < 2) return []
    const sorted = [...signals].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    let supportTotal = 0
    let opposeTotal = 0
    return sorted.map(signal => {
      const delta = Math.abs(Number(signal.delta || 0)) / 1e18
      const isDeposit = !!signal.deposit_id
      const isAgainst = counterTermId ? signal.term_id === counterTermId : false
      const change = isDeposit ? delta : -delta

      if (isAgainst) opposeTotal += change
      else supportTotal += change

      // Clamp to 0
      if (supportTotal < 0) supportTotal = 0
      if (opposeTotal < 0) opposeTotal = 0

      const total = supportTotal + opposeTotal
      const trustRatio = total > 0 ? Math.round((supportTotal / total) * 100) : 50

      return {
        date: new Date(signal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        trustRatio,
      }
    })
  }

  // ─── Trust Tier dla wybranego agenta ───
  const agentTrustTier = useMemo(() => {
    try {
      if (!selectedAgent) return null
      const stakers = combinedStakerCount
      const supportWei = agentTrust?.supportStake ?? 0n
      const opposeWei = agentTrust?.opposeStake ?? 0n
      const totalWei = supportWei + opposeWei
      const totalStake = Number(totalWei) / 1e18
      const trustRatio = totalWei > 0n ? Number((supportWei * 100n) / totalWei) : 50
      const ageDays = selectedAgent.created_at ? getAgentAgeDays(selectedAgent.created_at) : 0
      const tier = calculateTier(stakers, totalStake, trustRatio, ageDays)
      const progress = calculateTierProgress(stakers, totalStake, trustRatio, ageDays)
      return { tier, progress }
    } catch (e) {
      console.error('[agentTrustTier]', e)
      return null
    }
  }, [selectedAgent, combinedStakerCount, agentTrust])

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
            className="mb-10"
          >
            {/* Label */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#10b981] rounded-full" />
              <span className="text-xs font-semibold text-[#10b981] uppercase tracking-widest">
                Live on Intuition Testnet
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
              AI Agent
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-[#06b6d4]">
                {" "}Intelligence Registry
              </span>
            </h1>

            {/* Description */}
            <p className="text-[#6b7280] text-lg max-w-2xl leading-relaxed">
              Decentralized trust verification for AI agents.
              Stake <span className="text-[#9ca3af] font-medium">tTRUST</span> to signal
              confidence — every vote is transparent, on-chain, and permanent.
            </p>

            {/* Live indicator */}
            <div className="flex items-center gap-2 mt-4">
              <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-xs text-[#6b7280]">
                {agents.length} agents indexed · GraphQL live feed
              </span>
            </div>
          </motion.div>

          {/* Search + Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            {/* Search Input */}
            <div className="relative mb-4">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]">
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
                className="w-full pl-11 pr-10 py-3 bg-[#0d1117] border border-[#21262d] rounded-xl text-white text-sm placeholder:text-[#6b7280] focus:border-[#2d7a5f] focus:ring-1 focus:ring-[#2d7a5f40] outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Filter + Sort Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Trust Level filter */}
              {([
                { id: 'all', label: 'All', color: '' },
                { id: 'excellent', label: 'Excellent', color: '#06B6D4' },
                { id: 'good', label: 'Good', color: '#22C55E' },
                { id: 'moderate', label: 'Moderate', color: '#EAB308' },
                { id: 'low', label: 'Low', color: '#F97316' },
                { id: 'critical', label: 'Critical', color: '#EF4444' },
              ]).map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedCategory(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedCategory === f.id
                      ? 'bg-[#21262d] text-white border border-[#30363d]'
                      : 'text-[#8b949e] border border-transparent hover:text-white hover:bg-[#161b22]'
                  }`}
                >
                  {f.color ? (
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  ) : null}
                  <span>{f.label}</span>
                </button>
              ))}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-1.5 text-xs text-[#8b949e] focus:border-[#2d7a5f] outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="score_desc">Highest Score</option>
                <option value="score_asc">Lowest Score</option>
                <option value="stakers">Most Stakers</option>
                <option value="stake">Most Stake</option>
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

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
              <p className="text-red-400">Error: {error}</p>
              <button onClick={() => fetchAgents(searchTerm)} className="mt-2 text-sm text-accent-cyan hover:underline">
                Try again →
              </button>
            </div>
          )}

          {/* Empty State - No agents registered */}
          {!loading && !error && agents.length === 0 && !searchTerm && (
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
                  Register some real AI agents to get started.
                </p>
                <Button size="lg" asChild>
                  <a href="/test-intuition">
                    Register Agents →
                  </a>
                </Button>
              </div>
            </motion.div>
          )}

          {/* Empty Search Results */}
          {!loading && !error && agents.length === 0 && searchTerm && (
            <div className="text-center py-20">
              <p className="text-6xl mb-4">🔍</p>
              <h3 className="text-xl font-bold mb-2">No results for &quot;{searchTerm}&quot;</h3>
              <p className="text-text-secondary mb-6">Try a different search term</p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-primary rounded-lg text-white font-semibold hover:bg-primary-hover transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Agents Grid */}
          {!loading && agents.length > 0 && (() => {
            const enriched = agents.map(agent => {
              let supportWei = 0n
              try { supportWei = BigInt(agent.positions_aggregate?.aggregate?.sum?.shares || '0') } catch { supportWei = 0n }
              const cardTrust = calculateTrustScoreFromStakes(supportWei, BigInt(0))
              return { agent, trust: cardTrust }
            })

            const filtered = selectedCategory === 'all'
              ? enriched
              : enriched.filter(e => e.trust.level === selectedCategory)

            const sorted = [...filtered].sort((a, b) => {
              switch (sortBy) {
                case 'score_desc': return b.trust.score - a.trust.score
                case 'score_asc': return a.trust.score - b.trust.score
                case 'stakers':
                  return (b.agent.positions_aggregate?.aggregate?.count || 0)
                       - (a.agent.positions_aggregate?.aggregate?.count || 0)
                case 'stake':
                  return Number(BigInt(b.agent.positions_aggregate?.aggregate?.sum?.shares || '0')
                       - BigInt(a.agent.positions_aggregate?.aggregate?.sum?.shares || '0'))
                default: return 0
              }
            })

            return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="text-sm text-text-muted">
                  <span className="font-semibold text-text-primary">{sorted.length}</span>
                  {sorted.length !== agents.length && ` of ${agents.length}`} agents
                  {selectedCategory !== 'all' && (
                    <span className="text-[#8b949e]"> · filtered by <span className="text-white font-medium">{selectedCategory}</span></span>
                  )}
                </div>
              </div>

              {sorted.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-[#6b7280] text-sm">No agents match this filter</p>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="mt-2 text-xs text-[#58a6ff] hover:underline"
                  >
                    Show all agents
                  </button>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sorted.map(({ agent, trust: cardTrust }) => {
                  const trustScore = cardTrust.score
                  const color = cardTrust.level === 'excellent' ? '#06B6D4'
                    : cardTrust.level === 'good' ? '#22C55E'
                    : cardTrust.level === 'moderate' ? '#EAB308'
                    : cardTrust.level === 'low' ? '#F97316'
                    : '#EF4444'
                  const stakers = agent.positions_aggregate?.aggregate?.count || 0
                  const stakes = formatStakes(agent.positions_aggregate?.aggregate?.sum?.shares)
                  const name = getAgentName(agent.label)
                  const creator = agent.creator?.label || 'unknown'
                  const status = voteStatus[agent.term_id]

                  return (
                    <motion.div
                      key={agent.term_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      onClick={() => setSelectedAgent(agent)}
                      className="bg-[#111318] border border-[#1e2028] rounded-2xl p-5
                                 cursor-pointer
                                 transition-all duration-300 ease-out
                                 hover:-translate-y-1
                                 hover:border-[#2d7a5f40]
                                 hover:bg-[#111d18]
                                 hover:shadow-[0_8px_30px_rgba(45,122,95,0.12)]"
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {/* Icon */}
                          <div className="relative">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: color + '22', border: `1px solid ${color}44` }}
                            >
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                                  stroke={color}
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill={color + '33'}
                                />
                              </svg>
                            </div>
                            </div>

                          {/* Name + creator */}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <h3 className="font-bold text-white text-base leading-tight">{name}</h3>
                              {(() => { try { return <TrustTierBadge tier={calculateTier(stakers, Number(agent.positions_aggregate?.aggregate?.sum?.shares || '0') / 1e18, 50, agent.created_at ? getAgentAgeDays(agent.created_at) : 0)} size="sm" /> } catch { return null } })()}
                            </div>
                            <span className="text-xs text-[#6b7280] bg-[#1e2028] px-2 py-0.5 rounded inline-block">
                              {creator.replace('.eth', '')}
                            </span>
                          </div>
                        </div>

                        {/* Trust Score */}
                        <div className="text-right">
                          <p className="text-2xl font-bold leading-none" style={{ color: getTrustColor(trustScore) }}>
                            {trustScore}
                          </p>
                          <p className="text-xs text-[#6b7280] mt-0.5">Trust Score</p>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-sm text-[#9ca3af] mb-4">
                        <div className="flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>Stakes: <span className="text-white font-medium">{stakes}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>Stakers: <span className="text-white font-medium">{stakers}</span></span>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="w-full h-1.5 bg-[#1e2028] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${trustScore}%`, backgroundColor: color }}
                        />
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
        <div className="fixed inset-0 top-[64px] bg-black/80 backdrop-blur-sm z-40 overflow-y-auto">
          <div className="min-h-full p-4 flex items-start justify-center">
            <div className="w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>

              {/* === TOP CARD: Agent Header === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 mb-3">
                <div className="flex items-start gap-4 mb-4">
                  {/* Icon */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: getTrustStateColor(selectedAgent.positions_aggregate?.aggregate?.sum?.shares) + '20',
                      border: `2px solid ${getTrustStateColor(selectedAgent.positions_aggregate?.aggregate?.sum?.shares)}50`
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                        stroke={getTrustStateColor(selectedAgent.positions_aggregate?.aggregate?.sum?.shares)}
                        strokeWidth="2"
                        fill={getTrustStateColor(selectedAgent.positions_aggregate?.aggregate?.sum?.shares) + '30'}
                      />
                    </svg>
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-xl font-bold text-white">
                        {getAgentName(selectedAgent.label)}
                      </h2>
                      {agentTrustTier && (
                        <TrustTierBadgeWithProgress
                          tier={agentTrustTier.tier}
                          progress={agentTrustTier.progress}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#8b949e]">
                      {selectedAgent.creator?.id ? (
                        <Link
                          href={`/profile/${selectedAgent.creator.id}`}
                          className="bg-[#21262d] px-2 py-0.5 rounded text-xs hover:bg-[#30363d] hover:text-white transition-colors"
                        >
                          {selectedAgent.creator.label?.replace('.eth','') || selectedAgent.creator.id.slice(0, 10)}
                        </Link>
                      ) : (
                        <span className="bg-[#21262d] px-2 py-0.5 rounded text-xs">
                          {selectedAgent.creator?.label?.replace('.eth','') || 'unknown'}
                        </span>
                      )}
                      <span>·</span>
                      <span>Registered {new Date(selectedAgent.created_at).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>

                  {/* Close */}
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="w-8 h-8 rounded-lg bg-[#21262d] hover:bg-[#30363d] flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#8b949e" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Description */}
                <p className="text-[#8b949e] text-sm leading-relaxed mb-5">
                  {selectedAgent.label.includes(' - ')
                    ? selectedAgent.label.split(' - ').slice(1).join(' - ')
                    : 'AI Agent registered on Intuition Protocol.'}
                </p>

                {/* Wallet + Atom ID */}
                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#8b949e] w-16 flex-shrink-0">Wallet:</span>
                    {selectedAgent.creator?.id ? (
                      <Link
                        href={`/profile/${selectedAgent.creator.id}`}
                        className="text-[#58a6ff] text-xs font-mono hover:underline"
                      >
                        {selectedAgent.creator.label || selectedAgent.creator.id}
                      </Link>
                    ) : (
                      <code className="text-[#58a6ff] text-xs font-mono">
                        {selectedAgent.creator?.label || '0x???'}
                      </code>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#8b949e] w-16 flex-shrink-0">Atom ID:</span>
                    <code className="text-[#8b949e] text-xs font-mono">
                      {selectedAgent.term_id.slice(0, 14)}...{selectedAgent.term_id.slice(-8)}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedAgent.term_id)}
                      className="text-[#8b949e] hover:text-white transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: agentSignalsCount, label: 'Signals' },
                    { value: combinedStakerCount, label: 'Stakers' },
                    { value: formatStakes(selectedAgent.positions_aggregate?.aggregate?.sum?.shares), label: 'Total Stake' },
                    { value: reportCount, label: 'Reports' },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-xs text-[#8b949e] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* === ACTION SECTION: Support / Oppose / Buy / Sell === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-5 mb-3">
                <p className="text-[#8b949e] text-xs font-semibold mb-1">Bonding Curve Market</p>
                <p className="text-[#6b7280] text-xs mb-3">
                  One market: choose side (Support/Oppose) and action (Buy/Sell).
                </p>

                {isConnected ? (
                  <>
                    {/* Support / Oppose tabs */}
                    <div className="flex rounded-xl overflow-hidden border border-[#21262d] mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSignalSide('support'); setTradeAction('buy') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          signalSide === 'support'
                            ? 'bg-[#2d7a5f] text-white'
                            : 'bg-transparent text-[#8b949e] hover:text-white'
                        }`}
                      >
                        Support
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSignalSide('oppose'); setTradeAction('buy') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          signalSide === 'oppose'
                            ? 'bg-[#8b3a3a] text-white'
                            : 'bg-transparent text-[#8b949e] hover:text-white'
                        }`}
                      >
                        Oppose
                      </button>
                    </div>

                    {/* Oppose tab: show "Create Vault" panel if no triple exists yet */}
                    {signalSide === 'oppose' && !agentTriple.loading && !agentTriple.counterTermId ? (
                      <div className="bg-[#1a1018] border border-[#8b3a3a40] rounded-xl p-4 text-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 opacity-60">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                            stroke="#c45454" strokeWidth="2" fill="#c4545415"/>
                          <path d="M15 9l-6 6M9 9l6 6" stroke="#c45454" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p className="text-[#c45454] text-xs font-semibold mb-1">Oppose Vault Not Set Up</p>
                        <p className="text-[#8b949e] text-xs mb-3 leading-relaxed">
                          Opposing requires a Trust Triple on-chain.<br/>
                          One transaction to activate Oppose for this agent.
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCreateTrustTriple() }}
                          disabled={creatingTriple}
                          className="px-5 py-2 bg-[#8b3a3a] hover:bg-[#c45454] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          {creatingTriple ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
                              Creating Vault...
                            </span>
                          ) : 'Activate Oppose Vault →'}
                        </button>
                      </div>
                    ) : agentTriple.loading && signalSide === 'oppose' ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-[#8b949e] text-xs">
                        <span className="w-3 h-3 border border-[#8b949e] border-t-transparent rounded-full animate-spin" />
                        Checking Oppose vault...
                      </div>
                    ) : (
                      <>
                    {/* Buy / Sell tabs */}
                    <div className="flex rounded-xl overflow-hidden border border-[#21262d] mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setTradeAction('buy') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          tradeAction === 'buy'
                            ? 'bg-white text-black'
                            : 'bg-transparent text-[#8b949e] hover:text-white'
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTradeAction('sell') }}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          tradeAction === 'sell'
                            ? 'bg-white text-black'
                            : 'bg-transparent text-[#8b949e] hover:text-white'
                        }`}
                      >
                        Sell
                      </button>
                    </div>

                    {/* Curve info */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div>
                        <p className="text-white text-xs font-semibold">Bonding Curve</p>
                        <p className="text-[#8b949e] text-xs">
                          Current price: {getCurrentPrice(signalSide === 'support' ? supportSupply : opposeSupply).toFixed(4)} tTRUST/share
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full border border-[#30363d] text-[#8b949e]">
                        Active
                      </span>
                    </div>

                    {/* First Oppose Buy hint */}
                    {signalSide === 'oppose' && tradeAction === 'buy' && agentTriple.counterTermId && (
                      <div className="flex items-start gap-2 p-2.5 mb-3 bg-[#b8860b10] border border-[#b8860b20] rounded-lg">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                          <circle cx="12" cy="12" r="9" stroke="#b8860b" strokeWidth="2"/>
                          <path d="M12 8v4m0 4h.01" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <p className="text-[#b8860b] text-[10px] leading-relaxed">
                          First Oppose Buy may require 2 confirmations: one to clear the activation deposit (FOR), then the actual Oppose deposit.
                          Subsequent buys need only 1 confirmation.
                        </p>
                      </div>
                    )}

                    {/* Your shares info — visible in Sell mode */}
                    {tradeAction === 'sell' && (() => {
                      const ownedShares = signalSide === 'support'
                        ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                        : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                      const currentSupply = signalSide === 'support' ? supportSupply : opposeSupply
                      return ownedShares > 0 ? (
                        <div className="mb-3 p-3 rounded-xl bg-[#161b22] border border-[#21262d]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#8b949e] text-xs">Your shares</span>
                            <span className="text-white text-sm font-bold font-mono">
                              {ownedShares.toFixed(4)} shares
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[#6b7280] text-[10px]">Current value</span>
                            <span className="text-[#6b7280] text-[10px] font-mono">
                              {getSellProceeds(ownedShares, currentSupply).toFixed(6)} tTRUST
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 p-3 rounded-xl bg-[#161b22] border border-[#21262d] text-center">
                          <p className="text-[#6b7280] text-xs">No {signalSide} shares to sell</p>
                        </div>
                      )
                    })()}

                    {/* Amount input */}
                    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#8b949e] text-xs">
                          {tradeAction === 'buy' ? 'Amount in tTRUST' : 'Shares to sell'}
                        </span>
                        {tradeAction === 'buy' && (
                          <span className="text-[#8b949e] text-xs">
                            Balance: {tTrustBalance || '—'} tTRUST
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {tradeAction === 'buy' ? (
                          <input
                            type="number"
                            value={signalSide === 'support' ? voteAmount : untrustAmount}
                            onChange={(e) => {
                              if (signalSide === 'support') setVoteAmount(e.target.value)
                              else setUntrustAmount(e.target.value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            min="0.001"
                            step="0.001"
                            className="flex-1 bg-transparent text-white text-lg font-bold outline-none"
                            placeholder="0.05"
                          />
                        ) : (
                          <input
                            type="number"
                            value={redeemShares}
                            onChange={(e) => {
                              const maxShares = signalSide === 'support'
                                ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                                : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                              const val = parseFloat(e.target.value)
                              if (!isNaN(val) && val > maxShares) {
                                setRedeemShares(maxShares.toFixed(6))
                              } else {
                                setRedeemShares(e.target.value)
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            min="0"
                            step="0.0001"
                            className="flex-1 bg-transparent text-white text-lg font-bold outline-none"
                            placeholder="0.00"
                          />
                        )}
                        <span className="text-[#8b949e] text-sm font-semibold">
                          {tradeAction === 'buy' ? 'tTRUST' : 'shares'}
                        </span>
                        {tradeAction === 'sell' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const max = signalSide === 'support'
                                ? userPosition.forShares
                                : userPosition.againstShares
                              if (max) setRedeemShares((Number(max) / 1e18).toFixed(6))
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f6feb20] text-[#58a6ff] hover:bg-[#1f6feb30] transition-colors font-bold"
                          >
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
                            <input
                              type="range"
                              min="0"
                              max={maxShares}
                              step={maxShares / 100 || 0.0001}
                              value={parseFloat(redeemShares) || 0}
                              onChange={(e) => setRedeemShares(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full h-1 bg-[#21262d] rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#58a6ff]"
                            />
                            <div className="flex justify-between text-[10px] text-[#6b7280] mt-1">
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

                    {/* Buy/Sell preview */}
                    {(() => {
                      const currentSupply = signalSide === 'support' ? supportSupply : opposeSupply
                      if (tradeAction === 'buy') {
                        const inputAmt = Number(signalSide === 'support' ? voteAmount : untrustAmount) || 0
                        const preview = calculateBuy(inputAmt, currentSupply)
                        return (
                          <div className="space-y-1 mb-3 px-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[#8b949e] text-xs">You receive</span>
                              <span className="text-white text-xs font-semibold">
                                {inputAmt > 0 ? `${preview.sharesReceived.toFixed(4)} shares` : '—'}
                              </span>
                            </div>
                            {inputAmt > 0 && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6b7280] text-[10px]">Fee (5%)</span>
                                  <span className="text-[#6b7280] text-[10px]">{preview.fee.toFixed(4)} tTRUST</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6b7280] text-[10px]">Avg price</span>
                                  <span className="text-[#6b7280] text-[10px]">{preview.avgPricePerShare.toFixed(4)} tTRUST/share</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6b7280] text-[10px]">Price after</span>
                                  <span className="text-[#6b7280] text-[10px]">{preview.newPrice.toFixed(4)} tTRUST/share</span>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      } else {
                        const inputShares = Number(redeemShares) || 0
                        const maxOwned = signalSide === 'support'
                          ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                          : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                        const validShares = inputShares > 0 && inputShares <= maxOwned
                        const preview = calculateSell(inputShares, currentSupply)
                        return (
                          <div className="space-y-1 mb-3 px-1">
                            {inputShares > maxOwned && maxOwned > 0 && (
                              <p className="text-[#f85149] text-[10px] mb-1">Exceeds owned shares ({maxOwned.toFixed(4)})</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[#8b949e] text-xs">Gross proceeds</span>
                              <span className="text-[#8b949e] text-xs font-mono">
                                {validShares ? `${preview.grossProceeds.toFixed(6)} tTRUST` : '—'}
                              </span>
                            </div>
                            {validShares && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6b7280] text-[10px]">Fee (5%)</span>
                                  <span className="text-[#f85149] text-[10px] font-mono">-{preview.fee.toFixed(6)} tTRUST</span>
                                </div>
                                <div className="h-px bg-[#21262d] my-1" />
                                <div className="flex items-center justify-between">
                                  <span className="text-white text-xs font-medium">You receive</span>
                                  <span className="text-white text-xs font-bold font-mono">{preview.netProceeds.toFixed(6)} tTRUST</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6b7280] text-[10px]">Price per share</span>
                                  <span className="text-[#6b7280] text-[10px] font-mono">{(preview.grossProceeds / inputShares).toFixed(6)} tTRUST</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6b7280] text-[10px]">Price after sell</span>
                                  <span className="text-[#f85149] text-[10px] font-mono">{preview.newPrice.toFixed(6)} tTRUST/share</span>
                                </div>
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
                          // Unified bonding-curve flow:
                          // Buy Support / Buy Oppose both go directly to one confirmation step.
                          const isSupportBuy = signalSide === 'support'
                          setPendingVote({
                            type: isSupportBuy ? 'trust' : 'distrust',
                            agent: selectedAgent,
                            amount: isSupportBuy ? voteAmount : untrustAmount,
                            claim: '',
                            claimAtomId: null,
                            counterTermId: agentTriple.counterTermId,
                            tripleTermId: agentTriple.termId,
                          })
                          setSelectedAgent(null)
                          setShowConfirm(true)
                        } else {
                          const type = signalSide === 'support' ? 'redeem_trust' : 'redeem_distrust'
                          setPendingVote({
                            type,
                            agent: selectedAgent,
                            amount: redeemShares,
                            claim: '',
                            claimAtomId: null,
                            counterTermId: agentTriple.counterTermId,  // captured before modal closes
                          })
                          setSelectedAgent(null)
                          setShowConfirm(true)
                        }
                      }}
                      disabled={
                        (tradeAction === 'buy' && (
                          Number(signalSide === 'support' ? voteAmount : untrustAmount) <= 0
                        )) || (
                          tradeAction === 'sell' && (() => {
                            const shares = Number(redeemShares) || 0
                            const maxOwned = signalSide === 'support'
                              ? (userPosition.forShares ? Number(userPosition.forShares) / 1e18 : 0)
                              : (userPosition.againstShares ? Number(userPosition.againstShares) / 1e18 : 0)
                            return shares <= 0 || shares > maxOwned || maxOwned <= 0
                          })()
                        )
                      }
                      className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${signalSide === 'support'
                          ? 'bg-[#2d7a5f] hover:bg-[#34a872]'
                          : 'bg-[#8b3a3a] hover:bg-[#c45454]'
                        }`}
                    >
                      {tradeAction === 'buy'
                        ? `${signalSide === 'support' ? 'Support' : 'Oppose'} → Get Shares`
                        : `Sell ${Number(redeemShares) > 0 ? Number(redeemShares).toFixed(4) : '0'} shares → tTRUST`
                      }
                    </button>
                      </>
                    )}

                    {/* Your Position */}
                    {(userPosition.forShares || userPosition.againstShares) && (
                      <div className="mt-3 pt-3 border-t border-[#21262d]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#8b949e] text-xs">Your Position</span>
                          <div className="flex items-center gap-3">
                            {userPosition.forShares && (
                              <span className="text-[#34a872] text-xs font-semibold">
                                Support {(Number(userPosition.forShares) / 1e18).toFixed(4)} shares
                              </span>
                            )}
                            {userPosition.againstShares && (
                              <span className="text-[#c45454] text-xs font-semibold">
                                Oppose {(Number(userPosition.againstShares) / 1e18).toFixed(4)} shares
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl text-center">
                    <p className="text-[#8b949e] font-semibold mb-1">Connect wallet to vote</p>
                    <p className="text-xs text-[#6b7280]">Intuition Testnet · Chain ID 13579</p>
                  </div>
                )}
              </div>

              {/* === TRUST SCORE + STAKE BREAKDOWN === */}
              {(() => {
                const t = agentTrust
                const score = t?.score ?? 50
                const level = t?.level ?? 'moderate'
                const confidence = t?.confidence ?? 0
                const momentum = t?.momentum ?? 0
                const supportWei = t?.supportStake ?? BigInt(0)
                const opposeWei = t?.opposeStake ?? BigInt(0)
                const netWei = t?.netStake ?? BigInt(0)
                const totalWei = t?.totalStake ?? BigInt(0)
                const supportPct = totalWei > BigInt(0)
                  ? Number((supportWei * BigInt(1000)) / totalWei) / 10
                  : 100
                const fmtWei = (wei: bigint) => {
                  const n = Number(wei) / 1e18
                  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
                  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
                  return `$${n.toFixed(4)}`
                }
                const scoreColor = level === 'excellent' ? '#06B6D4'
                  : level === 'good' ? '#22C55E'
                  : level === 'moderate' ? '#EAB308'
                  : level === 'low' ? '#F97316'
                  : '#EF4444'
                const momDir = momentum > 0.1 ? 'up' : momentum < -0.1 ? 'down' : 'stable'
                const momText = momDir === 'up'
                  ? `+${momentum.toFixed(1)} pts`
                  : momDir === 'down'
                    ? `${momentum.toFixed(1)} pts`
                    : 'Stable'
                const circumference = 2 * Math.PI * 32
                const dashLen = (score / 100) * circumference

                return (
                  <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 mb-3">
                    <div className="grid grid-cols-2 gap-6">

                      {/* LEFT: Trust Score */}
                      <div>
                        <h3 className="text-white font-bold mb-4">Trust Score</h3>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="relative w-20 h-20 flex-shrink-0">
                            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                              <circle cx="40" cy="40" r="32" fill="none" stroke="#21262d" strokeWidth="6"/>
                              <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="6"
                                strokeDasharray={`${dashLen} ${circumference}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="font-bold text-lg" style={{ color: scoreColor }}>
                                {score}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              {momDir === 'up' && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                  <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              )}
                              {momDir === 'down' && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                  <path d="M7 7L17 17M17 17H7M17 17V7" stroke="#f85149" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              )}
                              <span className={`text-sm font-medium ${
                                momDir === 'up' ? 'text-[#10b981]' : momDir === 'down' ? 'text-[#f85149]' : 'text-[#8b949e]'
                              }`}>
                                {momText}
                              </span>
                            </div>
                            <p className="text-[#8b949e] text-xs">Trust Level</p>
                            <p className="text-white text-sm font-semibold capitalize">{level}</p>
                            <p className="text-[#8b949e] text-xs mt-1">Confidence</p>
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
                        <div className="h-2 bg-[#21262d] rounded-full overflow-hidden mb-4">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#10b981] to-[#059669] transition-all"
                            style={{ width: `${supportPct}%` }}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                            <p className="text-xs text-[#8b949e] mb-0.5">Support Stake</p>
                            <p className="text-[#10b981] font-bold">{fmtWei(supportWei)}</p>
                          </div>
                          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                            <p className="text-xs text-[#8b949e] mb-0.5">Oppose Stake</p>
                            <p className="text-[#f85149] font-bold">{fmtWei(opposeWei)}</p>
                          </div>
                          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                            <p className="text-xs text-[#8b949e] mb-0.5">Net Stake</p>
                            <p className="text-[#58a6ff] font-bold">
                              {netWei >= BigInt(0) ? '+' : ''}{fmtWei(netWei)} tTRUST
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* === BONDING CURVE INFO === */}
              <div className="bg-[#1f6feb15] border border-[#1f6feb25] rounded-2xl p-4 mb-3">
                <div className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="9" stroke="#58a6ff" strokeWidth="2" />
                    <path d="M12 8v4m0 4h.01" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className="text-[#58a6ff] text-sm font-semibold mb-1">Bonding Curve Economics</p>
                    <p className="text-[#8b949e] text-xs leading-relaxed">
                      Early stakers get more shares per tTRUST. As more people trust this agent,
                      your shares increase in value. Redeem anytime to realize gains.
                    </p>
                  </div>
                </div>
              </div>

              {/* === TABS: Overview / Attestations / Activity === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl overflow-hidden mb-3">
                <div className="flex border-b border-[#21262d]">
                  {[
                    { id: 'overview', label: 'Overview', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg> },
                    { id: 'attestations', label: 'Attestations', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                    { id: 'activity', label: 'Activity', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === tab.id
                          ? 'text-white border-[#34a872]'
                          : 'text-[#8b949e] border-transparent hover:text-white hover:border-[#30363d]'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (() => {
                  const score = agentTrust?.score ?? 50
                  const level = agentTrust?.level ?? 'moderate'
                  const confidence = agentTrust?.confidence ?? 0
                  const momentum = agentTrust?.momentum ?? 0
                  const supportWei = agentTrust?.supportStake ?? BigInt(0)
                  const opposeWei = agentTrust?.opposeStake ?? BigInt(0)
                  const totalWei = supportWei + opposeWei
                  const supportPct = totalWei > BigInt(0) ? Number((supportWei * BigInt(100)) / totalWei) : 50
                  const opsPct = 100 - supportPct
                  const netStake = Number(supportWei - opposeWei) / 1e18

                  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
                    excellent: { bg: '#06b6d420', text: '#06b6d4', border: '#06b6d440' },
                    good:      { bg: '#22c55e20', text: '#22c55e', border: '#22c55e40' },
                    moderate:  { bg: '#eab30820', text: '#eab308', border: '#eab30840' },
                    low:       { bg: '#f9731620', text: '#f97316', border: '#f9731640' },
                    critical:  { bg: '#ef444420', text: '#ef4444', border: '#ef444440' },
                  }
                  const lc = levelColors[level] || levelColors.moderate

                  const ageDays = Math.floor((Date.now() - new Date(selectedAgent.created_at).getTime()) / 86400000)
                  const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1 day' : `${ageDays} days`

                  return (
                  <div className="p-5 space-y-5">
                    {/* Trust Score Visual */}
                    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider">Trust Score</p>
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}
                        >
                          {level}
                        </span>
                      </div>

                      {/* Score gauge */}
                      <div className="flex items-end gap-4 mb-3">
                        <p className="text-4xl font-bold text-white leading-none">{score}</p>
                        <p className="text-[#8b949e] text-xs pb-1">/100</p>
                        {momentum !== 0 && (
                          <span className={`text-xs font-medium pb-1 ${momentum > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                            {momentum > 0 ? '▲' : '▼'} {Math.abs(momentum).toFixed(1)} momentum
                          </span>
                        )}
                      </div>

                      {/* Score bar */}
                      <div className="w-full h-2 bg-[#21262d] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${score}%`,
                            background: `linear-gradient(90deg, ${lc.text}80, ${lc.text})`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#6b7280]">
                        <span>Critical</span>
                        <span>Low</span>
                        <span>Moderate</span>
                        <span>Good</span>
                        <span>Excellent</span>
                      </div>
                    </div>

                    {/* Weighted Trust (time-decayed) */}
                    {weightedTrust && (
                      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider">
                            Trust Score (time-weighted)
                          </p>
                          <span
                            className="text-base font-bold"
                            style={{
                              color: weightedTrust.weightedRatio >= 60 ? '#22c55e'
                                   : weightedTrust.weightedRatio >= 40 ? '#eab308'
                                   : '#ef4444',
                            }}
                          >
                            {weightedTrust.weightedRatio.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${weightedTrust.weightedRatio}%`,
                              background: weightedTrust.weightedRatio >= 60
                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                : weightedTrust.weightedRatio >= 40
                                  ? 'linear-gradient(90deg, #eab308, #facc15)'
                                  : 'linear-gradient(90deg, #ef4444, #f87171)',
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-[#6b7280]">
                            Raw: {weightedTrust.rawRatio.toFixed(1)}%
                            {weightedTrust.decayImpact !== 0 && (
                              <span style={{ color: weightedTrust.decayImpact > 0 ? '#22c55e' : '#ef4444', marginLeft: '4px' }}>
                                ({weightedTrust.decayImpact > 0 ? '+' : ''}{weightedTrust.decayImpact.toFixed(1)}% freshness)
                              </span>
                            )}
                          </span>
                          <span className="text-[#6b7280]">
                            {weightedTrust.freshSignalsCount} fresh / {weightedTrust.totalSignalsCount} signals
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Support vs Oppose breakdown */}
                    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                      <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider mb-3">Community Sentiment</p>

                      {/* Stacked bar */}
                      <div className="w-full h-3 bg-[#21262d] rounded-full overflow-hidden flex mb-2">
                        {supportPct > 0 && (
                          <div className="h-full bg-[#34a872] transition-all duration-500" style={{ width: `${supportPct}%` }} />
                        )}
                        {opsPct > 0 && (
                          <div className="h-full bg-[#c45454] transition-all duration-500" style={{ width: `${opsPct}%` }} />
                        )}
                      </div>

                      <div className="flex justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#34a872]" />
                          <span className="text-white text-xs font-medium">{supportPct}% Support</span>
                          <span className="text-[#6b7280] text-[10px]">({(Number(supportWei) / 1e18).toFixed(4)} tTRUST)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#6b7280] text-[10px]">({(Number(opposeWei) / 1e18).toFixed(4)} tTRUST)</span>
                          <span className="text-white text-xs font-medium">{opsPct}% Oppose</span>
                          <div className="w-2.5 h-2.5 rounded-full bg-[#c45454]" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0d1117] rounded-lg p-2.5 text-center">
                          <p className="text-white text-sm font-bold">{(Number(totalWei) / 1e18).toFixed(4)}</p>
                          <p className="text-[#6b7280] text-[10px]">Total TVL</p>
                        </div>
                        <div className="bg-[#0d1117] rounded-lg p-2.5 text-center">
                          <p className={`text-sm font-bold ${netStake >= 0 ? 'text-[#34a872]' : 'text-[#c45454]'}`}>
                            {netStake >= 0 ? '+' : ''}{netStake.toFixed(4)}
                          </p>
                          <p className="text-[#6b7280] text-[10px]">Net Stake</p>
                        </div>
                        <div className="bg-[#0d1117] rounded-lg p-2.5 text-center">
                          <p className="text-white text-sm font-bold">{(confidence * 100).toFixed(0)}%</p>
                          <p className="text-[#6b7280] text-[10px]">Confidence</p>
                        </div>
                      </div>
                    </div>

                    {/* Bonding Curve Charts */}
                    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                      <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider mb-3">Bonding Curves</p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Support curve */}
                        {(() => {
                          const data = generateCurveData(supportSupply)
                          const currentPrice = getCurrentPrice(supportSupply)
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
                                      <ReferenceDot x={parseFloat(supportSupply.toFixed(4))} y={parseFloat(currentPrice.toFixed(6))} r={5} fill="#34a872" stroke="#fff" strokeWidth={2} />
                                    )}
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                              <p className="text-[#6b7280] text-[10px] mt-1">Supply: {supportSupply.toFixed(2)} · Price: {currentPrice.toFixed(4)}</p>
                            </div>
                          )
                        })()}
                        {/* Oppose curve */}
                        {(() => {
                          const data = generateCurveData(opposeSupply)
                          const currentPrice = getCurrentPrice(opposeSupply)
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
                                      <ReferenceDot x={parseFloat(opposeSupply.toFixed(4))} y={parseFloat(currentPrice.toFixed(6))} r={5} fill="#c45454" stroke="#fff" strokeWidth={2} />
                                    )}
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                              <p className="text-[#6b7280] text-[10px] mt-1">Supply: {opposeSupply.toFixed(2)} · Price: {currentPrice.toFixed(4)}</p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Trust History Chart */}
                    {(() => {
                      const chartData = buildTrustChartData(agentSignals, agentTriple.counterTermId)
                      if (chartData.length < 2) return null
                      return (
                        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                          <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider mb-3">Trust History</p>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData}>
                                <defs>
                                  <linearGradient id="trustGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#34a872" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#34a872" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 12 }}
                                  labelStyle={{ color: '#8b949e' }}
                                  formatter={(value: any) => [`${value}%`, 'Trust Ratio']}
                                />
                                <ReferenceLine y={50} stroke="#21262d" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="trustRatio" stroke="#34a872" fillOpacity={1} fill="url(#trustGrad)" strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex justify-between text-[10px] text-[#6b7280] mt-1">
                            <span>0% = All Oppose</span>
                            <span>50% = Balanced</span>
                            <span>100% = All Support</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Positions Table */}
                    {(() => {
                      if (positionsLoading) return (
                        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                          <div className="h-16 animate-pulse bg-[#21262d] rounded-lg" />
                        </div>
                      )
                      if (allPositions.length === 0) return null

                      // Compute total shares for % supply
                      let totalShares = 0n
                      try { totalShares = allPositions.reduce((acc: bigint, p: any) => { try { return acc + BigInt(p.shares || '0') } catch { return acc } }, 0n) } catch { totalShares = 0n }

                      return (
                        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                          <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider mb-3">
                            Positions ({combinedStakerCount} staker{combinedStakerCount !== 1 ? 's' : ''})
                          </p>
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[#6b7280] border-b border-[#21262d]">
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
                                  const walletLabel = pos.account?.label || pos.account_id
                                  const isENS = walletLabel?.includes('.eth')
                                  const displayWallet = isENS
                                    ? walletLabel
                                    : walletLabel?.length > 14
                                      ? walletLabel.slice(0, 8) + '...' + walletLabel.slice(-4)
                                      : walletLabel
                                  const isCreator = selectedAgent.creator?.id &&
                                    pos.account_id?.toLowerCase() === selectedAgent.creator.id.toLowerCase()

                                  return (
                                    <tr key={`${pos.account_id}-${pos.term_id}-${i}`} className="border-b border-[#21262d]/50 hover:bg-[#0d1117]">
                                      <td className="py-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Link href={`/profile/${pos.account_id}`} className="text-[#58a6ff] hover:underline">
                                            {displayWallet}
                                          </Link>
                                          <EarlySupporterBadge rank={pos.rank} />
                                          {isCreator && (
                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#1f6feb20] text-[#58a6ff] border border-[#1f6feb30]">
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
                                      <td className="py-2 text-right text-[#8b949e]">
                                        {getSellProceeds(
                                          Number(shares) / 1e18,
                                          isOppose ? opposeSupply : supportSupply
                                        ).toFixed(4)}
                                      </td>
                                      <td className="py-2 text-right text-[#8b949e]">
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
                      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                        <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider mb-3">Your Position</p>
                        {(userPosition.forShares || userPosition.againstShares) ? (
                          <div className="space-y-2">
                            {userPosition.forShares && Number(userPosition.forShares) > 0 && (() => {
                              const sharesFloat = Number(userPosition.forShares) / 1e18
                              const value = getSellProceeds(sharesFloat, supportSupply)
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
                                  <span className="text-[#6b7280] text-[10px]">Current Value</span>
                                  <span className="text-[#34a872] text-[10px] font-semibold">{value.toFixed(4)} tTRUST</span>
                                </div>
                              </div>
                              )
                            })()}
                            {userPosition.againstShares && Number(userPosition.againstShares) > 0 && (() => {
                              const sharesFloat = Number(userPosition.againstShares) / 1e18
                              const value = getSellProceeds(sharesFloat, opposeSupply)
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
                                  <span className="text-[#6b7280] text-[10px]">Current Value</span>
                                  <span className="text-[#c45454] text-[10px] font-semibold">{value.toFixed(4)} tTRUST</span>
                                </div>
                              </div>
                              )
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-3 bg-[#0d1117] rounded-lg">
                            <p className="text-[#6b7280] text-xs">You haven't staked on this agent yet</p>
                            <p className="text-[#8b949e] text-[10px] mt-0.5">Use the Bonding Curve Market above to take a position</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reports Info */}
                    {reportCount > 0 && (
                      <div className="bg-[#161b22] border border-[#f9731630] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="12" y1="9" x2="12" y2="13" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <p className="text-[#f97316] text-xs font-semibold uppercase tracking-wider">
                            {reportCount} Report{reportCount !== 1 ? 's' : ''} Filed
                          </p>
                        </div>
                        <div className="space-y-2">
                          {agentReports.map((report, i) => {
                            const predLabel = (report.predicate?.label || '').replace('reported_for_', '').replace(/_/g, ' ')
                            const reason = report.object?.label || ''
                            const reporter = report.creator?.label || report.creator?.id?.slice(0, 10) || '?'
                            const isENS = reporter.includes('.eth')
                            const displayReporter = isENS
                              ? reporter
                              : reporter.length > 14
                                ? reporter.slice(0, 8) + '...' + reporter.slice(-4)
                                : reporter
                            const date = new Date(report.created_at).toLocaleDateString('pl-PL')

                            const categoryIcons: Record<string, string> = {
                              scam: '🚨', spam: '📢', injection: '💉', impersonation: '🎭',
                            }
                            const icon = categoryIcons[predLabel] || '⚠️'

                            return (
                              <div key={report.id || i} className="flex items-start gap-2.5 bg-[#0d1117] rounded-lg px-3 py-2">
                                <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[#f97316] text-[10px] font-bold uppercase">{predLabel}</span>
                                    <span className="text-[#30363d]">·</span>
                                    {report.creator?.id ? (
                                      <Link href={`/profile/${report.creator.id}`} className="text-[#58a6ff] text-[10px] hover:underline">
                                        by {displayReporter}
                                      </Link>
                                    ) : (
                                      <span className="text-[#8b949e] text-[10px]">by {displayReporter}</span>
                                    )}
                                    <span className="text-[#30363d]">·</span>
                                    <span className="text-[#6b7280] text-[10px]">{date}</span>
                                  </div>
                                  {reason && reason !== `${predLabel} report` && (
                                    <p className="text-[#8b949e] text-[11px] mt-0.5 truncate">{reason}</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Agent Details */}
                    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                      <p className="text-[#8b949e] text-xs font-semibold uppercase tracking-wider mb-3">Details</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <div>
                          <p className="text-[#6b7280] text-[10px] mb-0.5">Creator</p>
                          {selectedAgent.creator?.id ? (
                            <Link href={`/profile/${selectedAgent.creator.id}`} className="text-[#58a6ff] text-xs font-medium hover:underline">
                              {selectedAgent.creator.label?.replace('.eth', '') || selectedAgent.creator.id.slice(0, 10)}
                            </Link>
                          ) : (
                            <p className="text-white text-xs font-medium">{selectedAgent.creator?.label || 'unknown'}</p>
                          )}
                        </div>
                        {[
                          { label: 'Agent Age', value: ageLabel },
                          { label: 'First Seen', value: new Date(selectedAgent.created_at).toLocaleDateString('pl-PL') },
                          { label: 'Stakers', value: String(combinedStakerCount) },
                        ].map((item, i) => (
                          <div key={i}>
                            <p className="text-[#6b7280] text-[10px] mb-0.5">{item.label}</p>
                            <p className="text-white text-xs font-medium">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#21262d]">
                        <div className="flex gap-2 flex-wrap">
                          {['AI Agent', selectedAgent.type || 'General'].map((tag, i) => (
                            <span key={i} className="px-2.5 py-0.5 bg-[#1f6feb15] border border-[#1f6feb30] rounded-full text-[#58a6ff] text-[10px] font-medium">
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

                  const profiles = Array.from(profileMap.values())
                    .sort((a, b) => b.totalSignals - a.totalSignals)

                  const uniqueStakers = profiles.length

                  return (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-semibold text-sm">Attestors</h4>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#34a872] animate-pulse" />
                          <span className="text-xs text-[#8b949e]">live</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-1 rounded-full">
                        {uniqueStakers} profile{uniqueStakers !== 1 ? 's' : ''} · {agentSignalsCount} signal{agentSignalsCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {signalsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-16 bg-[#161b22] border border-[#21262d] rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : profiles.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-12 h-12 rounded-full bg-[#21262d] flex items-center justify-center mx-auto mb-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#8b949e" strokeWidth="2"/>
                          </svg>
                        </div>
                        <p className="text-[#8b949e] text-sm">No attestors yet</p>
                        <p className="text-[#6b7280] text-xs mt-1">Be the first to stake on this agent</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {profiles.map((profile) => {
                          const isENS = profile.label.includes('.eth')
                          const displayName = isENS
                            ? profile.label
                            : profile.label.length > 14
                              ? profile.label.slice(0, 8) + '...' + profile.label.slice(-6)
                              : profile.label
                          const netPositive = profile.netShares >= 0
                          const lastDate = new Date(profile.lastSeen).toLocaleDateString('pl-PL')

                          return (
                            <Link
                              key={profile.accountId}
                              href={`/profile/${profile.accountId}`}
                              className="flex items-center justify-between p-3.5 bg-[#161b22] border border-[#21262d] rounded-xl hover:border-[#30363d] transition-colors cursor-pointer"
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
                                  <p className="text-white text-sm font-medium hover:text-[#58a6ff] transition-colors">{displayName}</p>
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
                                    <span className="text-[#6b7280] text-[10px]">{lastDate}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-white text-sm font-bold">{profile.totalSignals}</p>
                                <p className="text-[#6b7280] text-[10px]">attestation{profile.totalSignals !== 1 ? 's' : ''}</p>
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
                      <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-1 rounded-full">
                        {agentSignalsCount + 1} event{agentSignalsCount !== 0 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-0">
                      {/* Registration event - always first */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-[#1f6feb20] border border-[#1f6feb40] flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                                stroke="#58a6ff" strokeWidth="2"/>
                            </svg>
                          </div>
                          {agentSignals.length > 0 && (
                            <div className="w-px flex-1 bg-[#21262d] my-1" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="text-white text-sm font-medium">Agent Registered</p>
                          <p className="text-[#8b949e] text-xs mt-0.5">
                            Registered on Intuition Protocol
                          </p>
                          <p className="text-[#8b949e] text-xs mt-1">
                            {new Date(selectedAgent.created_at).toLocaleDateString('pl-PL', {
                              day: 'numeric', month: 'long', year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {signalsLoading ? (
                        <div className="space-y-2 ml-11">
                          {[1, 2].map(i => (
                            <div key={i} className="h-10 bg-[#161b22] border border-[#21262d] rounded-lg animate-pulse" />
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
                          const accountLabel = signal.account?.label || signal.account_id?.slice(0, 10) || '?'
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
                                {!isLast && <div className="w-px flex-1 bg-[#21262d] my-1" />}
                              </div>
                              <div className="pb-4">
                                <p className="text-white text-sm font-medium">
                                  {actionLabel}
                                  <span className="text-[#8b949e] font-normal ml-1.5">by </span>
                                  {signal.account_id ? (
                                    <Link
                                      href={`/profile/${signal.account_id}`}
                                      className="text-[#58a6ff] font-normal hover:underline"
                                    >
                                      {accountLabel}
                                    </Link>
                                  ) : (
                                    <span className="text-[#8b949e] font-normal">{accountLabel}</span>
                                  )}
                                </p>
                                <p style={{ color: dotColor }} className="text-xs font-medium mt-0.5">
                                  {isDeposit ? '+' : '-'}{sharesDisplay} shares
                                </p>
                                <p className="text-[#8b949e] text-xs mt-0.5">
                                  {new Date(signal.created_at).toLocaleDateString('pl-PL', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {!signalsLoading && agentSignals.length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-[#8b949e] text-sm">No staking activity yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* === REPORT SECTION === */}
              {isConnected && (
                <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold text-sm">Something wrong?</h4>
                      <p className="text-[#6b7280] text-xs mt-0.5">
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

      {/* Report Modal */}
      {showReportModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 max-w-lg w-full shadow-2xl">
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
                <p className="text-[#8b949e] text-sm">
                  Report <span className="text-white font-medium">{getAgentName(selectedAgent.label)}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowReportModal(false); setReportReason('') }}
                className="w-8 h-8 rounded-lg bg-[#21262d] hover:bg-[#30363d] flex items-center justify-center transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#8b949e" strokeWidth="2" strokeLinecap="round"/>
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
                        : 'bg-[#161b22] border-[#21262d] hover:border-[#30363d]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{cat.icon}</span>
                      <span className={`text-xs font-bold ${reportCategory === cat.id ? 'text-[#f97316]' : 'text-white'}`}>
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-[#6b7280] text-[10px] leading-tight">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="mb-4">
              <p className="text-white text-sm font-medium mb-2">Description <span className="text-[#6b7280] font-normal">(optional)</span></p>
              <textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                placeholder="Describe what happened or why you're reporting this agent..."
                rows={3}
                maxLength={200}
                className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#6b7280] focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f9731640] resize-none"
              />
              <p className="text-[#6b7280] text-[10px] text-right mt-1">{reportReason.length}/200</p>
            </div>

            {/* Cost notice */}
            <div className="bg-[#f9731610] border border-[#f9731625] rounded-lg px-3 py-2 mb-4">
              <p className="text-[#f97316] text-xs">
                <strong>On-chain report:</strong> Submitting this report creates an on-chain attestation triple and costs ~0.03 tTRUST (atom creation + triple deposit).
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowReportModal(false); setReportReason('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#8b949e] bg-[#161b22] border border-[#21262d] hover:border-[#30363d] transition-colors"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 max-w-lg w-full shadow-2xl">

            {/* Header */}
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white mb-1">
                Select a Claim
              </h2>
              <p className="text-[#8b949e] text-sm">
                Choose what you want to attest about{' '}
                <span className="text-white font-medium">
                  {getAgentName(pendingVote.agent.label)}
                </span>
              </p>
            </div>

            {/* Loading State */}
            {claimsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#34a872] border-t-transparent mr-3" />
                <span className="text-[#8b949e]">Loading claims from graph...</span>
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
                        ? (pendingVote.type === 'trust' ? 'rgba(45,122,95,0.12)' : 'rgba(139,58,58,0.12)')
                        : '#161b22',
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">
                          {claim.label}
                        </span>
                        {claim.term_id && (
                          <span className="px-2 py-0.5 bg-[#10b98115] border border-[#10b98130] rounded-full text-[#10b981] text-xs font-medium">
                            On-chain
                          </span>
                        )}
                      </div>
                      {claim.creator && (
                        <p className="text-[#8b949e] text-xs">
                          Created by {claim.creator.label?.replace('.eth', '') || 'unknown'}
                        </p>
                      )}
                      {claim.positions_aggregate?.aggregate?.count > 0 && (
                        <p className="text-[#8b949e] text-xs mt-1">
                          {claim.positions_aggregate.aggregate.count} attestations
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
                <div className="w-12 h-12 rounded-full bg-[#21262d] flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#8b949e" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="#8b949e" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="#8b949e" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[#8b949e] text-sm">No claims found</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowClaimSelect(false)
                  setPendingVote(null)
                }}
                className="flex-1 py-3 bg-[#21262d] hover:bg-[#30363d] rounded-xl text-[#8b949e] hover:text-white font-semibold text-sm transition-colors"
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 max-w-sm w-full shadow-2xl">

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
            <p className="text-[#8b949e] text-sm text-center mb-6">
              Review your signal before confirming
            </p>

            {/* Details */}
            <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden mb-5">
              <div className="flex justify-between items-center px-4 py-3 border-b border-[#21262d]">
                <span className="text-[#8b949e] text-sm">Agent</span>
                <span className="text-white text-sm font-semibold text-right max-w-[180px] truncate">
                  {pendingVote.agent.label
                    .replace(/^Agent:\s*/i, '')
                    .split(' - ')[0]
                    .replace(/\s*from\s+Kryptoremont.*/i, '')
                    .trim()
                  }
                </span>
              </div>

              {pendingVote.claim && pendingVote.type !== 'redeem_trust' && pendingVote.type !== 'redeem_distrust' && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#21262d]">
                  <span className="text-[#8b949e] text-sm">Claim</span>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-white text-sm font-semibold">
                      {pendingVote.claim}
                    </span>
                    {pendingVote.claimAtomId && (
                      <span className="px-2 py-0.5 bg-[#10b98115] border border-[#10b98130] rounded-full text-[#10b981] text-xs font-medium">
                        On-chain
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(pendingVote.type === 'trust' || pendingVote.type === 'distrust') && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#21262d]">
                  <span className="text-[#8b949e] text-sm">Deposit</span>
                  <span className="font-bold text-sm" style={{ color: pendingVote.type === 'trust' ? '#5ab8a0' : '#c45454' }}>
                    {pendingVote.amount} tTRUST → {pendingVote.type === 'trust' ? 'FOR' : 'AGAINST'} shares
                  </span>
                </div>
              )}

              {(pendingVote.type === 'redeem_trust' || pendingVote.type === 'redeem_distrust') && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#21262d]">
                  <span className="text-[#8b949e] text-sm">Redeem</span>
                  <span className="font-bold text-sm" style={{ color: pendingVote.type === 'redeem_trust' ? '#34a872' : '#c45454' }}>
                    {Number(pendingVote.amount).toFixed(4)} {pendingVote.type === 'redeem_trust' ? 'FOR' : 'AGAINST'} shares → tTRUST
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-[#8b949e] text-sm">Network</span>
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
              <div className="flex items-start gap-2 p-3 bg-[#58a6ff10] border border-[#58a6ff20] rounded-lg mb-5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="9" stroke="#58a6ff" strokeWidth="2"/>
                  <path d="M12 8v4m0 4h.01" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p className="text-[#58a6ff] text-xs leading-relaxed">
                  First Oppose Buy needs <strong>2 wallet confirmations</strong>: clear activation deposit, then Oppose deposit. Later buys require only 1.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setPendingVote(null) }}
                className="flex-1 py-3 bg-[#21262d] hover:bg-[#30363d] rounded-xl text-[#8b949e] hover:text-white font-semibold text-sm transition-colors"
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
