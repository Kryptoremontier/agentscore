'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import {
  Trophy, Medal, Users, TrendingUp, Zap, Blocks,
  RefreshCw, Crown, Bot, MessageSquare, Star,
} from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { cn } from '@/lib/cn'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

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

async function fetchLeaderboardData(): Promise<LeaderboardEntry[]> {
  const data = await gql<{
    agents: Array<{ creator_id: string }>
    skills: Array<{ creator_id: string }>
    claims: Array<{ creator_id: string }>
    positions: Array<{ account_id: string; shares: string }>
    signals: Array<{ account_id: string }>
  }>(`
    query LeaderboardData {
      agents: atoms(
        where: { label: { _ilike: "Agent:%" } }
        limit: 500
      ) { creator_id }

      skills: atoms(
        where: { label: { _ilike: "Skill:%" } }
        limit: 500
      ) { creator_id }

      claims: triples(
        where: {
          _or: [
            { subject: { label: { _ilike: "Agent:%" } } }
            { subject: { label: { _ilike: "Skill:%" } } }
          ]
        }
        limit: 500
      ) { creator_id }

      positions(
        where: { shares: { _gt: "0" } }
        limit: 2000
      ) { account_id shares }

      signals(
        limit: 5000
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

  for (const a of data.agents || []) { if (a.creator_id) ensure(a.creator_id).agentsRegistered++ }
  for (const s of data.skills || []) { if (s.creator_id) ensure(s.creator_id).skillsRegistered++ }
  for (const c of data.claims || []) { if (c.creator_id) ensure(c.creator_id).claimsCreated++ }

  for (const p of data.positions || []) {
    if (p.account_id) {
      const e = ensure(p.account_id)
      e.totalPositions++
      e.tTrustStaked += Number(p.shares) / 1e18
    }
  }
  for (const sig of data.signals || []) {
    if (sig.account_id) ensure(sig.account_id).totalSignals++
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchLeaderboardData()
      setEntries(data)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Leaderboard fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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

            {/* Refresh */}
            <button
              onClick={load}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#7A838D] hover:text-[#B5BDC6] transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Loading'}
            </button>
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
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 opacity-40" />
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
