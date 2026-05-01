'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import {
  Trophy, Medal, Users, TrendingUp, Zap, Blocks,
  Crown, Bot, MessageSquare, Star, Layers,
} from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { cn } from '@/lib/cn'
import type { LeaderboardEntry } from '@/lib/leaderboard-data'

type SortKey = 'score' | 'entities' | 'staked' | 'signals'

const TABS: { id: SortKey; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'score',    label: 'Overall',   icon: Trophy,     color: '#C8963C', desc: 'Activity score' },
  { id: 'entities', label: 'Builders',  icon: Blocks,     color: '#2EE6D6', desc: 'Entities registered' },
  { id: 'staked',   label: 'Stakers',   icon: TrendingUp, color: '#A78BFA', desc: 'tTRUST staked' },
  { id: 'signals',  label: 'Explorers', icon: Zap,        color: '#38B6FF', desc: 'On-chain events' },
]

type ColumnConfig = {
  header: React.ReactNode
  value: (e: LeaderboardEntry) => React.ReactNode
  highlight?: boolean
}

const COLUMN_CONFIGS: Record<SortKey, ColumnConfig[]> = {
  score: [
    { header: <><Bot className="w-3 h-3 text-[#C8963C]" />Agents</>,          value: e => e.agentsRegistered },
    { header: <><Zap className="w-3 h-3 text-[#2EE6D6]" />Skills</>,          value: e => e.skillsRegistered },
    { header: <><MessageSquare className="w-3 h-3 text-[#38B6FF]" />Claims</>, value: e => e.claimsCreated },
    { header: <><Trophy className="w-3 h-3" />Score</>,                        value: e => e.score, highlight: true },
  ],
  entities: [
    { header: <><Bot className="w-3 h-3 text-[#C8963C]" />Agents</>,          value: e => e.agentsRegistered },
    { header: <><Zap className="w-3 h-3 text-[#2EE6D6]" />Skills</>,          value: e => e.skillsRegistered },
    { header: <><MessageSquare className="w-3 h-3 text-[#38B6FF]" />Claims</>, value: e => e.claimsCreated },
    { header: <><Blocks className="w-3 h-3" />Entities</>,                     value: e => e.totalEntities, highlight: true },
  ],
  staked: [
    { header: <><TrendingUp className="w-3 h-3" />Positions</>, value: e => e.totalPositions },
    { header: <><Star className="w-3 h-3" />tTRUST</>,          value: e => e.tTrustStaked.toFixed(4), highlight: true },
  ],
  signals: [
    { header: <><Layers className="w-3 h-3" />Vaults</>, value: e => e.totalPositions },
    { header: <><Zap className="w-3 h-3" />Events</>,    value: e => e.totalSignals, highlight: true },
  ],
}

const GRID_TEMPLATES: Record<SortKey, string> = {
  score:    'grid-cols-[40px_1fr_80px_80px_80px_90px]',
  entities: 'grid-cols-[40px_1fr_80px_80px_80px_90px]',
  staked:   'grid-cols-[40px_1fr_120px_120px]',
  signals:  'grid-cols-[40px_1fr_120px_120px]',
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

export function LeaderboardClient({ initialData }: { initialData: LeaderboardEntry[] }) {
  const { address } = useAccount()
  const [tab, setTab] = useState<SortKey>('score')

  const allParticipants = [...initialData].sort((a, b) => {
    if (tab === 'entities') return (b.totalEntities - a.totalEntities) || (b.score - a.score)
    if (tab === 'staked')   return (b.tTrustStaked - a.tTrustStaked) || (b.totalPositions - a.totalPositions)
    if (tab === 'signals')  return (b.totalSignals - a.totalSignals) || (b.totalPositions - a.totalPositions)
    return b.score - a.score
  })
  const sorted = allParticipants.slice(0, 50)

  const myRank = address
    ? allParticipants.findIndex(e => e.address.toLowerCase() === address.toLowerCase()) + 1
    : 0

  const activeTab = TABS.find(t => t.id === tab)!
  const columns = COLUMN_CONFIGS[tab]
  const gridTemplate = GRID_TEMPLATES[tab]

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
              <span className="font-bold text-[#C8963C]">#{myRank} of {allParticipants.length}</span>
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
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}>

            {/* Header row */}
            <div className={cn('grid gap-3 px-5 py-3 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider border-b border-white/5', gridTemplate)}>
              <span>#</span>
              <span>Address</span>
              {columns.map((col, i) => (
                <span
                  key={i}
                  className="text-right flex items-center justify-end gap-1"
                  style={col.highlight ? { color: activeTab.color } : undefined}
                >
                  {col.header}
                </span>
              ))}
            </div>

            {sorted.length === 0 ? (
              <div className="py-20 text-center text-[#7A838D]">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                No activity found on testnet yet
              </div>
            ) : (
              sorted.map((e, i) => {
                const rank = i + 1
                const isMe = address && e.address.toLowerCase() === address.toLowerCase()

                return (
                  <div
                    key={e.address}
                    className={cn(
                      'grid gap-3 px-5 py-3.5 border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]',
                      gridTemplate,
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

                    {columns.map((col, ci) => (
                      <span
                        key={ci}
                        className="text-right text-sm self-center"
                        style={col.highlight
                          ? { color: activeTab.color, fontWeight: 600 }
                          : { color: '#B5BDC6' }}
                      >
                        {col.value(e)}
                      </span>
                    ))}
                  </div>
                )
              })
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs text-[#7A838D]">
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#B5BDC6] mb-1">Overall Score</p>
              <p className="leading-relaxed">
                Participation score across all activity types.<br />
                Agent +15 · Skill +15 · Claim +10<br />
                Active position +5 · tTRUST staked ×20<br />
                On-chain event +1
              </p>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#2EE6D6] mb-1">Builders</p>
              <p className="leading-relaxed">Ranked by total entities registered on-chain. Agents + Skills + Claims. Tiebreaker: Overall Score.</p>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#A78BFA] mb-1">Stakers</p>
              <p className="leading-relaxed">Ranked by tTRUST staked across AgentScore vaults. Positions = distinct vaults with active stake. Tiebreaker: Positions desc.</p>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-medium text-[#38B6FF] mb-1">Explorers</p>
              <p className="leading-relaxed">Ranked by on-chain events (deposits + redeems) on AgentScore vaults. Vaults = distinct vaults with active stake. Tiebreaker: Vaults desc.</p>
            </div>
          </div>

        </div>
      </div>
    </PageBackground>
  )
}
