'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, ExternalLink, Search, LayoutGrid, List,
  ArrowUpDown, Wallet, CircleDot, CircleSlash, Clock,
} from 'lucide-react'
import Link from 'next/link'
import type { AgentSupport } from '@/types/user'
import { cn } from '@/lib/cn'
import { NodeAvatar } from './NodeAvatar'

interface MySupportedAgentsProps {
  supports: AgentSupport[]
}

type FilterType = 'all' | 'for' | 'against'
type SortKey = 'value' | 'newest'

const FILTER_PILLS: { id: FilterType; label: string; color: string; icon: typeof CircleDot }[] = [
  { id: 'all',     label: 'All',     color: '#B5BDC6', icon: Wallet },
  { id: 'for',     label: 'FOR',     color: '#4ADE80', icon: CircleDot },
  { id: 'against', label: 'AGAINST', color: '#F87171', icon: CircleSlash },
]

function formatShares(raw: string): string {
  const val = Number(BigInt(raw || '0')) / 1e18
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  if (val >= 1) return val.toFixed(2)
  if (val > 0) return val.toFixed(4)
  return '0'
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function entityDisplayName(label: string): string {
  return label.replace(/^(?:Agent|Skill):(?:\w+:)?\s*/i, '').split(' - ')[0].trim()
}

function SideBadge({ side }: { side: 'for' | 'against' }) {
  const isFor = side === 'for'
  const color = isFor ? '#4ADE80' : '#F87171'
  const bg = isFor ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)'
  const border = isFor ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'
  const Icon = isFor ? CircleDot : CircleSlash

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      <Icon className="w-2.5 h-2.5" />
      {isFor ? 'FOR' : 'AGAINST'}
    </span>
  )
}

export function MySupportedAgents({ supports }: MySupportedAgentsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortKey>('value')

  const filtered = useMemo(() => {
    let list = [...supports]
    if (filter === 'for') list = list.filter(s => s.side === 'for')
    if (filter === 'against') list = list.filter(s => s.side === 'against')
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return Number(BigInt(b.shares || '0')) - Number(BigInt(a.shares || '0'))
    })
    return list
  }, [supports, filter, sortBy])

  const totals = useMemo(() => {
    const forCount = supports.filter(s => s.side === 'for').length
    const againstCount = supports.filter(s => s.side === 'against').length
    const totalStaked = supports.reduce((sum, s) => sum + Number(BigInt(s.shares || '0')) / 1e18, 0)
    return { forCount, againstCount, totalStaked }
  }, [supports])

  if (!supports || supports.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 flex flex-col items-center justify-center text-center"
        style={{ background: 'rgba(15,17,19,0.7)', border: '1px solid rgba(74,222,128,0.15)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.20)' }}
        >
          <TrendingUp className="w-8 h-8 text-[#4ADE80]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Positions Yet</h3>
        <p className="text-[#7A838D] text-sm max-w-sm mb-5">
          Buy shares in agents or skills to signal trust in the knowledge graph. Your positions will appear here.
        </p>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }}
        >
          <Search className="w-4 h-4" /> Explore Agents
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overview panel */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(74,222,128,0.12)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.20)' }}
          >
            <TrendingUp className="w-4 h-4 text-[#4ADE80]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Your Positions</span>
            <span className="text-xs text-[#7A838D] ml-2">Trust signals across the network</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="text-lg font-bold font-mono text-[#B5BDC6]">{supports.length}</div>
            <div className="text-[10px] text-[#7A838D] mt-0.5">Total Positions</div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}
          >
            <div className="text-lg font-bold font-mono text-[#4ADE80]">{totals.forCount}</div>
            <div className="text-[10px] text-[#7A838D] mt-0.5">FOR</div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}
          >
            <div className="text-lg font-bold font-mono text-[#F87171]">{totals.againstCount}</div>
            <div className="text-[10px] text-[#7A838D] mt-0.5">AGAINST</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-[#7A838D]">
          Total staked:{' '}
          <span className="font-semibold text-[#4ADE80]">
            {totals.totalStaked >= 1 ? totals.totalStaked.toFixed(2) : totals.totalStaked.toFixed(4)} tTRUST
          </span>
        </div>
      </div>

      {/* Controls: filter + sort + view */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {FILTER_PILLS.map(pill => {
            const isActive = filter === pill.id
            const count = pill.id === 'all'
              ? supports.length
              : pill.id === 'for' ? totals.forCount : totals.againstCount
            return (
              <button
                key={pill.id}
                onClick={() => setFilter(pill.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  isActive ? '' : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
                style={isActive
                  ? { background: `${pill.color}18`, border: `1px solid ${pill.color}40`, color: pill.color }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                <pill.icon className="w-3 h-3" />
                {pill.label}
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div
            className="flex items-center gap-1 rounded-lg px-1 py-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ArrowUpDown className="w-3 h-3 text-[#7A838D] ml-1" />
            {[{ id: 'value' as SortKey, label: 'Value' }, { id: 'newest' as SortKey, label: 'Newest' }].map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                  sortBy === opt.id ? 'text-[#4ADE80] bg-[rgba(74,222,128,0.12)]' : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
          >
            <button
              onClick={() => setViewMode('list')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
                viewMode === 'list' ? 'text-[#4ADE80]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'list' ? { background: 'rgba(74,222,128,0.12)' } : {}}
            >
              <List className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
                viewMode === 'grid' ? 'text-[#4ADE80]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'grid' ? { background: 'rgba(74,222,128,0.12)' } : {}}
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[#7A838D] text-sm">
            No {filter === 'all' ? '' : filter.toUpperCase()} positions found
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((pos, i) => {
            const isFor = pos.side === 'for'
            const accent = isFor ? '#4ADE80' : '#F87171'
            const accentBorder = isFor ? 'rgba(74,222,128,0.20)' : 'rgba(248,113,113,0.20)'
            return (
              <motion.div
                key={`${pos.agentTermId}-${pos.side}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/agents?open=${encodeURIComponent(pos.agentTermId)}`}>
                  <div
                    className="group rounded-2xl p-5 transition-all cursor-pointer hover:scale-[1.01]"
                    style={{ background: 'rgba(15,17,19,0.85)', border: `1px solid ${accentBorder}` }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = accent + '60')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = accentBorder)}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <NodeAvatar label={pos.agentLabel} size="md" connections={2} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {entityDisplayName(pos.agentLabel)}
                          </span>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <SideBadge side={pos.side} />
                          <span className="text-[10px] text-[#4A5260] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(pos.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Value footer */}
                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-[10px] text-[#4A5260]">Shares held</span>
                      <span className="text-sm font-bold font-mono" style={{ color: accent }}>
                        {formatShares(pos.shares)} tTRUST
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* LIST */
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header row */}
          <div
            className="grid grid-cols-[1fr_80px_100px] gap-3 px-5 py-2.5 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-[#4ADE80]" /> Entity
            </span>
            <span className="text-center">Side</span>
            <span className="text-right">tTRUST</span>
          </div>

          {filtered.map((pos, i) => {
            const isFor = pos.side === 'for'
            const accent = isFor ? '#4ADE80' : '#F87171'
            return (
              <motion.div
                key={`${pos.agentTermId}-${pos.side}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/agents?open=${encodeURIComponent(pos.agentTermId)}`}>
                  <div
                    className="group grid grid-cols-[1fr_80px_100px] gap-3 px-5 py-3 transition-colors cursor-pointer hover:bg-white/[0.03]"
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    {/* Entity cell */}
                    <div className="flex items-center gap-3 min-w-0">
                      <NodeAvatar label={pos.agentLabel} size="sm" connections={2} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {entityDisplayName(pos.agentLabel)}
                          </span>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                        <span className="text-[10px] text-[#4A5260] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(pos.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Side */}
                    <div className="flex items-center justify-center">
                      <SideBadge side={pos.side} />
                    </div>

                    {/* Value */}
                    <div className="text-right self-center">
                      <span className="text-sm font-semibold font-mono" style={{ color: accent }}>
                        {formatShares(pos.shares)}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
