'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import {
  Trophy, Medal, Users, TrendingUp, Zap, Blocks,
  Crown, Bot, MessageSquare, Star, Loader2,
} from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { cn } from '@/lib/cn'

import { APP_CONFIG } from '@/lib/app-config'
import {
  AGENT_WHERE_STR, SKILL_WHERE_STR,
  AGENT_VAULT_POSITION_STR, SKILL_VAULT_POSITION_STR, CLAIM_VAULT_POSITION_STR,
  AGENT_SIGNAL_WHERE_STR, SKILL_SIGNAL_WHERE_STR, CLAIM_SIGNAL_WHERE_STR,
  AGENT_PREFIX, SKILL_PREFIX,
} from '@/lib/gql-filters'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

interface LeaderboardEntry {
  address: string
  agentsRegistered: number
  skillsRegistered: number
  claimsCreated: number
  totalEntities: number
  totalPositions: number
  tTrustStaked: number
  totalSignals: number
  score: number
}

type SortKey = 'score' | 'entities' | 'staked' | 'signals'

const TABS: { id: SortKey; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'score',    label: 'Overall',   icon: Trophy,        color: '#C8963C', desc: 'Composite score' },
  { id: 'entities', label: 'Builders',  icon: Blocks,        color: '#2EE6D6', desc: 'Entities created' },
  { id: 'staked',   label: 'Stakers',   icon: TrendingUp,    color: '#A78BFA', desc: 'tTRUST staked' },
  { id: 'signals',  label: 'Explorers', icon: Zap,           color: '#38B6FF', desc: 'On-chain signals' },
]

async function gql<T>(query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data as T
}

const FEE_PROXY_LC = '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41'

async function fetchLeaderboardData(): Promise<LeaderboardEntry[]> {
  const data = await gql<{
    agents: Array<{ positions: Array<{ account_id: string }> }>
    skills: Array<{ positions: Array<{ account_id: string }> }>
    claims: Array<{ creator_id: string }>
    agentPositions: Array<{ account_id: string; shares: string }>
    skillPositions: Array<{ account_id: string; shares: string }>
    claimPositions: Array<{ account_id: string; shares: string }>
    agentSignals: Array<{ account_id: string }>
    skillSignals: Array<{ account_id: string }>
    claimSignals: Array<{ account_id: string }>
  }>(`
    query LeaderboardData {
      agents: atoms(
        where: ${AGENT_WHERE_STR}
        limit: 500
      ) {
        positions(order_by: { created_at: asc }, limit: 1) { account_id }
      }

      skills: atoms(
        where: ${SKILL_WHERE_STR}
        limit: 500
      ) {
        positions(order_by: { created_at: asc }, limit: 1) { account_id }
      }

      claims: triples(
        where: {
          creator_id: { _neq: "${FEE_PROXY_LC}" }
          _or: [
            { subject: { label: { _ilike: "${AGENT_PREFIX}%" } } }
            { subject: { label: { _ilike: "${SKILL_PREFIX}%" } } }
            { subject: { as_subject_triples: { predicate_id: { _eq: "0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba" } } } }
            { subject: { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } } }
          ]
        }
        limit: 500
      ) { creator_id }

      agentPositions: positions(
        where: { ${AGENT_VAULT_POSITION_STR} }
        limit: 1000
      ) { account_id shares }

      skillPositions: positions(
        where: { ${SKILL_VAULT_POSITION_STR} }
        limit: 1000
      ) { account_id shares }

      claimPositions: positions(
        where: { ${CLAIM_VAULT_POSITION_STR} }
        limit: 1000
      ) { account_id shares }

      agentSignals: signals(
        where: { ${AGENT_SIGNAL_WHERE_STR} }
        limit: 3000
        order_by: { created_at: desc }
      ) { account_id }

      skillSignals: signals(
        where: { ${SKILL_SIGNAL_WHERE_STR} }
        limit: 1000
        order_by: { created_at: desc }
      ) { account_id }

      claimSignals: signals(
        where: { ${CLAIM_SIGNAL_WHERE_STR} }
        limit: 1000
        order_by: { created_at: desc }
      ) { account_id }
    }
  `)

  const map = new Map<string, LeaderboardEntry>()

  const ensure = (addr: string): LeaderboardEntry => {
    if (!addr) return { address: '', agentsRegistered: 0, skillsRegistered: 0, claimsCreated: 0, totalEntities: 0, totalPositions: 0, tTrustStaked: 0, totalSignals: 0, score: 0 }
    if (!map.has(addr)) {
      map.set(addr, { address: addr, agentsRegistered: 0, skillsRegistered: 0, claimsCreated: 0, totalEntities: 0, totalPositions: 0, tTrustStaked: 0, totalSignals: 0, score: 0 })
    }
    return map.get(addr)!
  }

  // Użyj pierwszego position holdera jako registranta (FeeProxy jako receiver = user jest first holder)
  for (const a of data.agents || []) {
    const holder = a.positions?.[0]?.account_id
    if (holder && holder.toLowerCase() !== FEE_PROXY_LC) ensure(holder).agentsRegistered++
  }
  for (const s of data.skills || []) {
    const holder = s.positions?.[0]?.account_id
    if (holder && holder.toLowerCase() !== FEE_PROXY_LC) ensure(holder).skillsRegistered++
  }
  // Claims: creator_id (legacy, FeeProxy odfiltrowany w query) + TODO: localStorage per-user
  for (const c of data.claims || []) { if (c.creator_id) ensure(c.creator_id).claimsCreated++ }

  const allPositions = [
    ...(data.agentPositions || []),
    ...(data.skillPositions || []),
    ...(data.claimPositions || []),
  ]
  for (const p of allPositions) {
    if (p.account_id) {
      const e = ensure(p.account_id)
      e.totalPositions++
      e.tTrustStaked += Number(p.shares) / 1e18
    }
  }

  const allSignals = [
    ...(data.agentSignals || []),
    ...(data.skillSignals || []),
    ...(data.claimSignals || []),
  ]
  for (const sig of allSignals) {
    if (sig.account_id && sig.account_id.toLowerCase() !== FEE_PROXY_LC) {
      ensure(sig.account_id).totalSignals++
    }
  }

  return Array.from(map.values())
    .map(e => ({
      ...e,
      totalEntities: e.agentsRegistered + e.skillsRegistered + e.claimsCreated,
      score: Math.round(
        e.agentsRegistered * 15 +
        e.skillsRegistered * 15 +
        e.claimsCreated * 10 +
        e.totalPositions * 5 +
        e.tTrustStaked * 20 +
        e.totalSignals * 1
      ),
    }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-[#C8963C]" />
  if (rank === 2) return <Medal className="w-5 h-5 text-[#B0BEC5]" />
  if (rank === 3) return <Medal className="w-5 h-5 text-[#CD7F32]" />
  return <span className="text-[#7A838D] font-mono text-sm w-5 text-center">{rank}</span>
}

export default function LeaderboardPage() {
  const { address } = useAccount()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SortKey>('score')

  useEffect(() => {
    fetchLeaderboardData()
      .then(setEntries)
      .catch(e => console.error('Leaderboard fetch error:', e))
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...entries].sort((a, b) => {
    if (tab === 'entities') return b.totalEntities - a.totalEntities
    if (tab === 'staked')   return b.tTrustStaked - a.tTrustStaked
    if (tab === 'signals')  return b.totalSignals - a.totalSignals
    return b.score - a.score
  }).slice(0, 50)

  const myRank = address
    ? sorted.findIndex(e => e.address.toLowerCase() === address.toLowerCase()) + 1
    : 0

  const activeTab = TABS.find(t => t.id === tab)!

  return (
    <PageBackground image="wave" opacity={0.2}>
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.3)', color: '#C8963C' }}>
              <Trophy className="w-3.5 h-3.5" />
              LIVE ON INTUITION TESTNET
            </div>
            <h1 className="text-4xl font-bold mb-3">
              <span style={{ background: 'linear-gradient(135deg,#C8963C,#E8B84B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Leaderboard
              </span>
            </h1>
            <p className="text-[#7A838D] max-w-lg mx-auto">
              Rankings derived entirely from on-chain activity — no off-chain data, no manual scoring.
            </p>
          </div>

          {/* My rank banner */}
          {address && myRank > 0 && (
            <div className="mb-6 px-5 py-3 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.25)' }}>
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-[#C8963C]" />
                <span className="text-sm text-[#B5BDC6]">Your position</span>
              </div>
              <span className="font-bold text-[#C8963C]">#{myRank} of {sorted.length}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                  tab === t.id
                    ? 'text-white'
                    : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
                style={tab === t.id
                  ? { background: `${t.color}18`, border: `1px solid ${t.color}40`, color: t.color }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                <span className="text-[10px] opacity-60">{t.desc}</span>
              </button>
            ))}

            {loading && (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-[#7A838D]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}>

            {/* Header row */}
            <div className="grid grid-cols-[40px_1fr_80px_80px_80px_90px] gap-3 px-5 py-3 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider border-b border-white/5">
              <span>#</span>
              <span>Address</span>
              <span className="text-right flex items-center justify-end gap-1"><Bot className="w-3 h-3 text-[#C8963C]" />Agents</span>
              <span className="text-right flex items-center justify-end gap-1"><Zap className="w-3 h-3 text-[#2EE6D6]" />Skills</span>
              <span className="text-right flex items-center justify-end gap-1"><MessageSquare className="w-3 h-3 text-[#38B6FF]" />Claims</span>
              <span className="text-right flex items-center justify-end gap-1" style={{ color: activeTab.color }}>
                <activeTab.icon className="w-3 h-3" />{activeTab.label}
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-[#7A838D]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 opacity-40" />
                Fetching on-chain data…
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-20 text-center text-[#7A838D]">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                No activity found on testnet yet
              </div>
            ) : (
              sorted.map((e, i) => {
                const rank = i + 1
                const isMe = address && e.address.toLowerCase() === address.toLowerCase()
                const value = tab === 'entities' ? e.totalEntities
                  : tab === 'staked' ? e.tTrustStaked.toFixed(4)
                  : tab === 'signals' ? e.totalSignals
                  : e.score

                return (
                  <div
                    key={e.address}
                    className={cn(
                      'grid grid-cols-[40px_1fr_80px_80px_80px_90px] gap-3 px-5 py-3.5 border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]',
                      isMe && 'bg-[#C8963C]/[0.06]',
                      rank <= 3 && 'bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-center justify-center">
                      <RankBadge rank={rank} />
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-mono"
                        style={{ background: isMe ? 'rgba(200,150,60,0.2)' : 'rgba(255,255,255,0.06)', color: isMe ? '#C8963C' : '#7A838D' }}>
                        {e.address.slice(2, 4).toUpperCase()}
                      </div>
                      <Link
                        href={`/profile/${e.address}`}
                        className={cn(
                          'font-mono text-sm truncate hover:underline',
                          isMe ? 'text-[#C8963C] font-semibold' : 'text-[#B5BDC6] hover:text-white'
                        )}
                      >
                        {shortAddr(e.address)}
                        {isMe && <span className="ml-2 text-[10px] font-sans font-normal opacity-60">you</span>}
                      </Link>
                    </div>

                    <span className="text-right text-sm text-[#B5BDC6] self-center">{e.agentsRegistered}</span>
                    <span className="text-right text-sm text-[#B5BDC6] self-center">{e.skillsRegistered}</span>
                    <span className="text-right text-sm text-[#B5BDC6] self-center">{e.claimsCreated}</span>
                    <span className="text-right text-sm font-semibold self-center" style={{ color: activeTab.color }}>{value}</span>
                  </div>
                )
              })
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs text-[#7A838D]">
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#B5BDC6] mb-1">Overall Score</p>
              <p>Agent×15 + Skill×15 + Claim×10 + Position×5 + Staked×20 + Signal×1</p>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#2EE6D6] mb-1">Builders</p>
              <p>Ranked by total entities registered (agents + skills + claims)</p>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#A78BFA] mb-1">Stakers</p>
              <p>Ranked by total tTRUST currently staked in active positions</p>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#38B6FF] mb-1">Explorers</p>
              <p>Ranked by total on-chain signals sent across all vaults</p>
            </div>
          </div>

        </div>
      </div>
    </PageBackground>
  )
}
