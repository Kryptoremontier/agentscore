'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther } from 'viem'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import { AGENT_CATEGORIES } from '@/data/realAgents'

// Real agents loaded from Intuition testnet via GraphQL
const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

interface GraphQLAgent {
  term_id: string
  label: string
  type: string
  created_at: string
  emoji?: string
  creator?: { label: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

export default function AgentsPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [agents, setAgents] = useState<GraphQLAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedAgent, setSelectedAgent] = useState<GraphQLAgent | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'attestations' | 'activity'>('overview')
  const [trustAmount, setTrustAmount] = useState('0.05')
  const [untrustAmount, setUntrustAmount] = useState('0.05')
  const [claims, setClaims] = useState<any[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [agentPositions, setAgentPositions] = useState<any[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [voteStatus, setVoteStatus] = useState<Record<string, string>>({})
  const [showClaimSelect, setShowClaimSelect] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingVote, setPendingVote] = useState<{
    type: 'trust' | 'distrust'
    agent: GraphQLAgent
    amount: string
    claim: string
    claimAtomId: string | null
  } | null>(null)

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
                creator { label }
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

  useEffect(() => {
    const timer = setTimeout(() => fetchAgents(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch positions when attestations tab is selected
  useEffect(() => {
    if (!selectedAgent) return
    if (activeTab !== 'attestations') return

    setPositionsLoading(true)
    setAgentPositions([])

    console.log('Fetching positions for agent:', selectedAgent.term_id)

    fetchAgentPositions(selectedAgent.term_id)
      .then(positions => {
        console.log('Got positions:', positions.length)
        setAgentPositions(positions)
      })
      .finally(() => setPositionsLoading(false))
  }, [selectedAgent?.term_id, activeTab])

  const executeVote = async () => {
    if (!pendingVote || !walletClient || !publicClient) return
    setShowConfirm(false)
    const key = pendingVote.agent.term_id
    setVoteStatus(prev => ({ ...prev, [key]: 'pending' }))

    try {
      const { createWriteConfig, trustAgent, distrustAgent } = await import('@/lib/intuition')
      const cfg = createWriteConfig(walletClient, publicClient)

      if (pendingVote.type === 'trust') {
        await trustAgent(cfg, pendingVote.agent.term_id as `0x${string}`, parseEther(pendingVote.amount))
      } else {
        await distrustAgent(cfg, pendingVote.agent.term_id as `0x${string}`, 1n)
      }

      // Clear pending status and refresh to show updated Trust Score
      setVoteStatus(prev => {
        const newStatus = { ...prev }
        delete newStatus[key]
        return newStatus
      })

      // Refresh agents to show updated data
      setTimeout(() => fetchAgents(searchTerm), 2000)
    } catch (e: any) {
      setVoteStatus(prev => {
        const newStatus = { ...prev }
        delete newStatus[key]
        return newStatus
      })
      alert(`Error: ${e.message}`)
    } finally {
      setPendingVote(null)
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

  // Fetch positions (stakers) for an agent
  const fetchAgentPositions = async (agentTermId: string) => {
    try {
      const response = await fetch('https://testnet.intuition.sh/v1/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetPositions($termId: String!) {
              positions(
                where: { term: { id: { _eq: $termId } } }
                order_by: { updated_at: desc }
                limit: 20
              ) {
                shares
                updated_at
                account { label }
              }
            }
          `,
          variables: { termId: agentTermId }
        })
      })
      const data = await response.json()
      return data.data?.positions || []
    } catch (e) {
      console.error('Positions fetch error:', e)
      return []
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

  return (
    <PageBackground image="hero" opacity={0.4}>
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
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Search agents..."
                className="flex-1 px-4 py-3 bg-background-secondary border border-border rounded-lg text-white placeholder:text-text-muted focus:border-primary outline-none transition-colors"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {AGENT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-white'
                      : 'bg-background-secondary border border-border text-text-secondary hover:border-primary'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
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
          {!loading && agents.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="mb-6 text-sm text-text-muted">
                <span className="font-semibold text-text-primary">{agents.length}</span> agents found
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.map((agent) => {
                  const color = getTrustStateColor(agent.positions_aggregate?.aggregate?.sum?.shares)
                  const trustScore = Math.round(
                    Number(agent.positions_aggregate?.aggregate?.sum?.shares || 0) / 1e15
                  )
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
                            {/* Verified badge */}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#10b981] rounded-full flex items-center justify-center border-2 border-[#111318]">
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>

                          {/* Name + creator */}
                          <div>
                            <h3 className="font-bold text-white text-base leading-tight">{name}</h3>
                            <span className="text-xs text-[#6b7280] bg-[#1e2028] px-2 py-0.5 rounded mt-1 inline-block">
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
                          <span>Attestations: <span className="text-white font-medium">{stakers}</span></span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[#1e2028] mb-4" />

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {/* TRUST Button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            setPendingVote({
                              type: 'trust',
                              agent: agent,
                              amount: trustAmount,
                              claim: '',
                              claimAtomId: null
                            })
                            setShowClaimSelect(true)
                            await fetchClaims('trust')
                          }}
                          disabled={status === 'pending'}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                          style={{
                            backgroundColor: '#1a7f5422',
                            color: '#34a872',
                            border: '1px solid #1a7f5433'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                              stroke="#34a872" strokeWidth="2" fill="#34a87220"/>
                          </svg>
                          {status === 'pending' ? '...' : 'Trust'}
                        </button>

                        {/* UNTRUST Button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            setPendingVote({
                              type: 'distrust',
                              agent: agent,
                              amount: '0',
                              claim: '',
                              claimAtomId: null
                            })
                            setShowClaimSelect(true)
                            await fetchClaims('distrust')
                          }}
                          disabled={status === 'pending'}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                          style={{
                            backgroundColor: '#b91c1c22',
                            color: '#cd5c5c',
                            border: '1px solid #b91c1c33'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                              stroke="#cd5c5c" strokeWidth="2" fill="#cd5c5c20"/>
                            <path d="M15 9l-6 6M9 9l6 6" stroke="#cd5c5c" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          {status === 'pending' ? '...' : 'Untrust'}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen p-4 flex items-start justify-center">
            <div className="w-full max-w-3xl my-8" onClick={e => e.stopPropagation()}>

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
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-[#10b98115] border border-[#10b98130] rounded-full">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-[#10b981] text-xs font-medium">Verified</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#8b949e]">
                      <span className="bg-[#21262d] px-2 py-0.5 rounded text-xs">
                        {selectedAgent.creator?.label?.replace('.eth','') || 'unknown'}
                      </span>
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
                    <code className="text-[#58a6ff] text-xs font-mono">
                      {selectedAgent.creator?.label || '0x???'}
                    </code>
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
                    { value: selectedAgent.positions_aggregate?.aggregate?.count || 0, label: 'Attestations' },
                    { value: selectedAgent.positions_aggregate?.aggregate?.count || 0, label: 'Stakers' },
                    { value: formatStakes(selectedAgent.positions_aggregate?.aggregate?.sum?.shares), label: 'Total Stake' },
                    { value: '0', label: 'Reports' },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-xs text-[#8b949e] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* === ACTION SECTION: Amount Input + Buttons === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-5 mb-3">
                <h3 className="text-white font-bold mb-4">Cast Your Signal</h3>

                {isConnected ? (
                  <div className="space-y-4">
                    {/* Amount Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Trust Amount */}
                      <div>
                        <label className="text-[#8b949e] text-xs mb-2 block">Trust Amount</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={trustAmount}
                            onChange={(e) => setTrustAmount(e.target.value)}
                            min="0.01"
                            step="0.01"
                            className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2 text-white text-sm focus:border-[#34a872] focus:outline-none"
                            placeholder="0.05"
                          />
                        </div>
                      </div>

                      {/* Untrust Amount */}
                      <div>
                        <label className="text-[#8b949e] text-xs mb-2 block">Untrust Amount</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={untrustAmount}
                            onChange={(e) => setUntrustAmount(e.target.value)}
                            min="0.001"
                            step="0.001"
                            className="w-full bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2 text-white text-sm focus:border-[#cd5c5c] focus:outline-none"
                            placeholder="0.05"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-[#6b7280] text-xs">
                      Deposit to earn shares on bonding curve · Redeem shares anytime
                    </p>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* TRUST */}
                      <button
                        onClick={async () => {
                          setPendingVote({
                            type: 'trust',
                            agent: selectedAgent,
                            amount: trustAmount,
                            claim: '',
                            claimAtomId: null
                          })
                          setSelectedAgent(null)
                          setShowClaimSelect(true)
                          await fetchClaims('trust')
                        }}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-white text-sm transition-all"
                        style={{ background: 'linear-gradient(135deg, #1a7f54 0%, #166a45 100%)' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                            stroke="white" strokeWidth="2" fill="rgba(255,255,255,0.2)"/>
                        </svg>
                        Trust
                      </button>

                      {/* UNTRUST */}
                      <button
                        onClick={async () => {
                          setPendingVote({
                            type: 'distrust',
                            agent: selectedAgent,
                            amount: untrustAmount,
                            claim: '',
                            claimAtomId: null
                          })
                          setSelectedAgent(null)
                          setShowClaimSelect(true)
                          await fetchClaims('distrust')
                        }}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm transition-all"
                        style={{
                          background: 'transparent',
                          border: '1px solid #b91c1c40',
                          color: '#cd5c5c'
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                            stroke="#cd5c5c" strokeWidth="2" fill="rgba(205,92,92,0.15)"/>
                          <path d="M15 9l-6 6M9 9l6 6" stroke="#cd5c5c" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        Untrust
                      </button>

                      {/* REPORT */}
                      <button
                        onClick={() => {
                          alert('Report Issue feature coming soon. Please contact us on Discord.')
                        }}
                        className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm transition-all text-[#8b949e] hover:text-white"
                        style={{
                          background: 'transparent',
                          border: '1px solid #21262d',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                            stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        Report
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#161b22] border border-[#21262d] rounded-xl text-center">
                    <p className="text-[#8b949e] font-semibold mb-1">Connect wallet to vote</p>
                    <p className="text-xs text-[#6b7280]">Intuition Testnet · Chain ID 13579</p>
                  </div>
                )}
              </div>

              {/* === TRUST SCORE + STAKE BREAKDOWN === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-6 mb-3">
                <div className="grid grid-cols-2 gap-6">

                  {/* LEFT: Trust Score */}
                  <div>
                    <h3 className="text-white font-bold mb-4">Trust Score</h3>
                    <div className="flex items-center gap-4 mb-4">
                      {/* Circle */}
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                          <circle cx="40" cy="40" r="32" fill="none" stroke="#21262d" strokeWidth="6"/>
                          <circle cx="40" cy="40" r="32" fill="none" stroke="#10b981" strokeWidth="6"
                            strokeDasharray={`${Math.min(Math.round(Number(selectedAgent.positions_aggregate?.aggregate?.sum?.shares || 0) / 1e15), 100) * 2.01} 201`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {Math.round(Number(selectedAgent.positions_aggregate?.aggregate?.sum?.shares || 0) / 1e15)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <span className="text-[#10b981] text-sm font-medium">+5.2% vs last week</span>
                        </div>
                        <p className="text-[#8b949e] text-xs">Trust Level</p>
                        <p className="text-white text-sm font-semibold">Good</p>
                        <p className="text-[#8b949e] text-xs mt-1">Percentile</p>
                        <p className="text-white text-sm font-semibold">Top 32%</p>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Stake Breakdown */}
                  <div>
                    <h3 className="text-white font-bold mb-4">Stake Breakdown</h3>

                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#10b981]">Positive</span>
                      <span className="text-[#f85149]">Negative</span>
                    </div>
                    <div className="h-2 bg-[#21262d] rounded-full overflow-hidden mb-4">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#10b981] to-[#059669]" style={{ width: '94.3%' }}>
                        <span className="sr-only">94.3% positive</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                        <p className="text-xs text-[#8b949e] mb-0.5">Positive Stake</p>
                        <p className="text-[#10b981] font-bold">
                          {formatStakes(selectedAgent.positions_aggregate?.aggregate?.sum?.shares)}
                        </p>
                      </div>
                      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                        <p className="text-xs text-[#8b949e] mb-0.5">Negative Stake</p>
                        <p className="text-[#f85149] font-bold">$0.00</p>
                      </div>
                      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3">
                        <p className="text-xs text-[#8b949e] mb-0.5">Net Stake</p>
                        <p className="text-[#58a6ff] font-bold">
                          +{formatStakes(selectedAgent.positions_aggregate?.aggregate?.sum?.shares)} tTRUST
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
                {activeTab === 'overview' && (
                  <div className="p-5">
                    <h4 className="text-white font-semibold mb-3">About This Agent</h4>
                    <p className="text-[#8b949e] text-sm leading-relaxed mb-5">
                      {selectedAgent.label.includes(' - ')
                        ? selectedAgent.label.split(' - ').slice(1).join(' - ')
                        : 'AI Agent registered on Intuition Protocol.'}
                    </p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                      {[
                        { label: 'Platform', value: selectedAgent.creator?.label?.replace('.eth','') || 'unknown' },
                        { label: 'Verification Level', value: 'Wallet' },
                        { label: 'First Seen', value: new Date(selectedAgent.created_at).toLocaleDateString('pl-PL') },
                        { label: 'Last Active', value: '—' },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-[#8b949e] text-xs mb-0.5">{item.label}</p>
                          <p className="text-white text-sm font-medium">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[#8b949e] text-xs mb-2">Tags & Categories</p>
                      <div className="flex gap-2 flex-wrap">
                        {['AI Agent', selectedAgent.type || 'General'].map((tag, i) => (
                          <span key={i} className="px-3 py-1 bg-[#1f6feb20] border border-[#1f6feb40] rounded-full text-[#58a6ff] text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Attestations Tab */}
                {activeTab === 'attestations' && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-semibold text-sm">Stakers</h4>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#34a872] animate-pulse" />
                          <span className="text-xs text-[#8b949e]">live</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-1 rounded-full">
                        {agentPositions.length} position{agentPositions.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {positionsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-14 bg-[#161b22] border border-[#21262d] rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : agentPositions.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-12 h-12 rounded-full bg-[#21262d] flex items-center justify-center mx-auto mb-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                              stroke="#8b949e"
                              strokeWidth="2"
                            />
                          </svg>
                        </div>
                        <p className="text-[#8b949e] text-sm">No stakers yet</p>
                        <p className="text-[#6b7280] text-xs mt-1">Be the first to trust this agent</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {agentPositions.map((position, i) => {
                          const shares = Number(position.shares || 0)
                          const sharesDisplay = (shares / 1e18).toFixed(4)
                          const accountLabel = position.account?.label || '0x????'
                          const isENS = accountLabel.includes('.eth')
                          const displayName = isENS
                            ? accountLabel
                            : accountLabel.slice(0, 8) + '...' + accountLabel.slice(-6)
                          const date = new Date(position.updated_at).toLocaleDateString('pl-PL')

                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-[#161b22] border border-[#21262d] rounded-xl hover:border-[#30363d] transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#2d7a5f20] border border-[#2d7a5f30] flex items-center justify-center flex-shrink-0">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                                      stroke="#34a872"
                                      strokeWidth="2"
                                      fill="#34a87220"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-white text-xs font-medium">{displayName}</p>
                                  <p className="text-[#6b7280] text-xs">{date}</p>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="bg-[#2d7a5f20] border border-[#2d7a5f30] rounded-lg px-2 py-1">
                                  <p className="text-[#34a872] text-xs font-bold">+{sharesDisplay} shares</p>
                                </div>
                                <p className="text-[#6b7280] text-xs mt-0.5">bonding curve</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-semibold">Activity</h4>
                    </div>
                    <div className="space-y-3">
                      {/* Registration event - always exists */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-[#1f6feb20] border border-[#1f6feb40] flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                                stroke="#58a6ff" strokeWidth="2"/>
                            </svg>
                          </div>
                          <div className="w-px flex-1 bg-[#21262d] my-1" />
                        </div>
                        <div className="pb-4">
                          <p className="text-white text-sm font-medium">Agent Registered</p>
                          <p className="text-[#8b949e] text-xs mt-0.5">
                            Registered on Intuition Protocol testnet
                          </p>
                          <p className="text-[#8b949e] text-xs mt-1">
                            {new Date(selectedAgent.created_at).toLocaleDateString('pl-PL', {
                              day: 'numeric', month: 'long', year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Trust events */}
                      {(selectedAgent.positions_aggregate?.aggregate?.count || 0) > 0 && (
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-[#34a87220] border border-[#34a87240] flex items-center justify-center flex-shrink-0">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="#34a872" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">
                              {selectedAgent.positions_aggregate?.aggregate?.count} Trust Signal{(selectedAgent.positions_aggregate?.aggregate?.count || 0) > 1 ? 's' : ''}
                            </p>
                            <p className="text-[#8b949e] text-xs mt-0.5">
                              {selectedAgent.positions_aggregate?.aggregate?.count} staker{(selectedAgent.positions_aggregate?.aggregate?.count || 0) > 1 ? 's' : ''} deposited tTRUST
                            </p>
                            <p className="text-[#34a872] text-xs font-medium mt-1">
                              Total: {formatStakes(selectedAgent.positions_aggregate?.aggregate?.sum?.shares)}
                            </p>
                          </div>
                        </div>
                      )}

                      {(selectedAgent.positions_aggregate?.aggregate?.count || 0) === 0 && (
                        <div className="text-center py-6">
                          <p className="text-[#8b949e] text-sm">No activity yet beyond registration</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* === SIMILAR AGENTS === */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl p-5">
                <h4 className="text-white font-semibold mb-3">Similar Agents</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-3 text-center">
                      <p className="text-[#8b949e] text-xs">Coming soon...</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Backdrop click to close */}
          <div className="fixed inset-0 -z-10" onClick={() => setSelectedAgent(null)} />
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
                  backgroundColor: pendingVote.type === 'trust' ? '#1a7f5420' : '#b91c1c20',
                  border: `1px solid ${pendingVote.type === 'trust' ? '#1a7f5440' : '#b91c1c40'}`
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                    stroke={pendingVote.type === 'trust' ? '#34a872' : '#cd5c5c'}
                    strokeWidth="2"
                    fill={pendingVote.type === 'trust' ? '#34a87220' : '#cd5c5c20'}
                  />
                  {pendingVote.type === 'distrust' && (
                    <path d="M15 9l-6 6M9 9l6 6"
                      stroke="#cd5c5c" strokeWidth="1.5" strokeLinecap="round"/>
                  )}
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white text-center mb-1">
              Confirm {pendingVote.type === 'trust' ? 'Trust' : 'Distrust'}
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

              {pendingVote.claim && (
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

              {pendingVote.type === 'trust' && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#21262d]">
                  <span className="text-[#8b949e] text-sm">Amount</span>
                  <span className="font-bold text-sm" style={{ color: '#5ab8a0' }}>
                    {pendingVote.amount} tTRUST
                  </span>
                </div>
              )}

              {pendingVote.type === 'distrust' && (
                <div className="flex justify-between items-center px-4 py-3 border-b border-[#21262d]">
                  <span className="text-[#8b949e] text-sm">Action</span>
                  <span className="text-sm font-medium" style={{ color: '#cd5c5c' }}>
                    Redeem 1 share
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
            <div className="flex items-start gap-2 p-3 bg-[#b8860b15] border border-[#b8860b25] rounded-lg mb-5">
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
                  backgroundColor: pendingVote.type === 'trust' ? '#1a7f54' : '#b91c1c',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = pendingVote.type === 'trust' ? '#166a45' : '#991b1b')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = pendingVote.type === 'trust' ? '#1a7f54' : '#b91c1c')}
              >
                {pendingVote.type === 'trust' ? 'Confirm Trust' : 'Confirm Distrust'}
              </button>
            </div>

          </div>
        </div>
      )}
    </PageBackground>
  )
}
