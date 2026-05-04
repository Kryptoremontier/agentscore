'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Users, TrendingUp, ExternalLink, Plus,
  LayoutGrid, List, ArrowUpDown, Shield, Clock,
} from 'lucide-react'
import Link from 'next/link'
import type { RegisteredAgent } from '@/types/user'
import { cn } from '@/lib/cn'
import { NodeAvatar } from './NodeAvatar'
import { calculateTier, getAgentAgeDays } from '@/lib/trust-tiers'
import { TrustTierBadge } from '@/components/agents/TrustTierBadge'

interface MyAgentsProps {
  agents: RegisteredAgent[]
}

type SortKey = 'newest' | 'stakers' | 'staked'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'stakers', label: 'Stakers' },
  { id: 'staked',  label: 'tTRUST' },
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
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function agentDisplayName(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') return 'Unnamed'
  return label.replace(/^Agent:(?:\w+:)?\s*/i, '').split(' - ')[0].trim()
}

function agentTier(agent: RegisteredAgent) {
  const totalStake = Number(BigInt(agent.totalStaked || '0')) / 1e18
  const ageDays = getAgentAgeDays(agent.createdAt)
  // trustRatio: with only stakers count we assume 100% for owned agents
  return calculateTier(agent.stakers, totalStake, 100, ageDays)
}

export function MyAgents({ agents }: MyAgentsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [sortBy, setSortBy] = useState<SortKey>('newest')

  const sorted = useMemo(() => {
    const list = [...agents]
    switch (sortBy) {
      case 'stakers': list.sort((a, b) => b.stakers - a.stakers); break
      case 'staked':  list.sort((a, b) => {
        const aV = Number(BigInt(a.totalStaked || '0'))
        const bV = Number(BigInt(b.totalStaked || '0'))
        return bV - aV
      }); break
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list
  }, [agents, sortBy])

  const totals = useMemo(() => {
    const totalStakers = agents.reduce((s, a) => s + a.stakers, 0)
    const totalStaked = agents.reduce((s, a) => s + Number(BigInt(a.totalStaked || '0')) / 1e18, 0)
    return { totalStakers, totalStaked }
  }, [agents])

  if (!agents || agents.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 flex flex-col items-center justify-center text-center"
        style={{ background: 'rgba(15,17,19,0.7)', border: '1px solid rgba(200,150,60,0.15)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.20)' }}
        >
          <Shield className="w-8 h-8 text-[#C8963C]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Agents Yet</h3>
        <p className="text-[#7A838D] text-sm max-w-sm mb-5">
          Register your first AI agent to start building trust on the knowledge graph.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(200,150,60,0.15)', border: '1px solid rgba(200,150,60,0.35)', color: '#C8963C' }}
        >
          <Plus className="w-4 h-4" /> Register Agent
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overview panel */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#C8963C]" />
            <span className="text-sm font-semibold text-white">Your Agents</span>
            <span className="text-xs text-[#7A838D]">Registered on the knowledge graph</span>
          </div>
          <Link
            href="/register"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.25)', color: '#C8963C' }}
          >
            <Plus className="w-3.5 h-3.5" /> Register New
          </Link>
        </div>

        <div className="flex divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            { value: agents.length,                                                                            label: 'Agents' },
            { value: totals.totalStakers,                                                                      label: 'Total Stakers' },
            { value: totals.totalStaked >= 1 ? totals.totalStaked.toFixed(2) : totals.totalStaked.toFixed(4), label: 'tTRUST Staked' },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center py-3 px-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-lg font-bold font-mono tabular-nums text-white leading-none">{s.value}</div>
              <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Sort */}
        <div
          className="flex items-center gap-1 rounded-lg px-1 py-0.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ArrowUpDown className="w-3 h-3 text-[#7A838D] ml-1" />
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={cn(
                'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                sortBy === opt.id ? 'text-[#C8963C] bg-[rgba(200,150,60,0.12)]' : 'text-[#7A838D] hover:text-[#B5BDC6]'
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
              viewMode === 'list' ? 'text-[#C8963C]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
            style={viewMode === 'list' ? { background: 'rgba(200,150,60,0.12)' } : {}}
          >
            <List className="w-3 h-3" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
              viewMode === 'grid' ? 'text-[#C8963C]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
            style={viewMode === 'grid' ? { background: 'rgba(200,150,60,0.12)' } : {}}
          >
            <LayoutGrid className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* GRID view */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((agent, i) => {
            const name = agentDisplayName(agent.label)
            const tier = agentTier(agent)
            return (
              <motion.div
                key={agent.termId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/agents/${agent.termId}`}>
                  <div
                    className="group rounded-2xl p-5 transition-all cursor-pointer hover:scale-[1.01]"
                    style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(200,150,60,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                  >
                    {/* Header: node avatar + name + tier */}
                    <div className="flex items-start gap-3 mb-4">
                      <NodeAvatar label={agent.label} size="md" connections={Math.min(agent.stakers, 6)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-sm text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {name}
                          </h4>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <TrustTierBadge tier={tier} size="sm" />
                          <span className="text-[10px] text-[#4A5260] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(agent.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <div>
                          <div className="text-sm font-bold text-white">{agent.stakers}</div>
                          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>stakers</div>
                        </div>
                      </div>
                      <div
                        className="rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <div>
                          <div className="text-sm font-bold text-white">{formatShares(agent.totalStaked)}</div>
                          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>tTRUST</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* LIST view */
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header row */}
          <div
            className="grid grid-cols-[1fr_80px_80px_90px] gap-3 px-5 py-2.5 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#C8963C]" /> Agent
            </span>
            <span className="text-center">Tier</span>
            <span className="text-right flex items-center justify-end gap-1">
              <Users className="w-3 h-3" /> Stakers
            </span>
            <span className="text-right flex items-center justify-end gap-1">
              <TrendingUp className="w-3 h-3" /> tTRUST
            </span>
          </div>

          {sorted.map((agent, i) => {
            const name = agentDisplayName(agent.label)
            const tier = agentTier(agent)
            return (
              <motion.div
                key={agent.termId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/agents/${agent.termId}`}>
                  <div
                    className="group grid grid-cols-[1fr_80px_80px_90px] gap-3 px-5 py-3 transition-colors cursor-pointer hover:bg-white/[0.03]"
                    style={{ borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    {/* Agent cell */}
                    <div className="flex items-center gap-3 min-w-0">
                      <NodeAvatar label={agent.label} size="sm" connections={Math.min(agent.stakers, 4)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {name}
                          </span>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                        <span className="text-[10px] text-[#4A5260] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(agent.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Tier */}
                    <div className="flex items-center justify-center">
                      <TrustTierBadge tier={tier} size="sm" />
                    </div>

                    {/* Stakers */}
                    <div className="text-right self-center">
                      <span className="text-sm font-medium text-white font-mono">{agent.stakers}</span>
                    </div>

                    {/* tTRUST */}
                    <div className="text-right self-center">
                      <span className="text-sm font-semibold text-white font-mono">
                        {formatShares(agent.totalStaked)}
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
