'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Users, TrendingUp, ExternalLink, Plus, LayoutGrid, List, Zap, Star } from 'lucide-react'
import Link from 'next/link'
import type { RegisteredAgent } from '@/types/user'
import { cn } from '@/lib/cn'

interface MyAgentsProps {
  agents: RegisteredAgent[]
}

// Deterministic color palette per agent (based on name hash)
const AGENT_PALETTES = [
  { bg: 'rgba(200,150,60,0.15)',  border: 'rgba(200,150,60,0.40)',  text: '#C8963C',  glow: 'rgba(200,150,60,0.20)'  },
  { bg: 'rgba(46,230,214,0.12)',  border: 'rgba(46,230,214,0.35)',  text: '#2EE6D6',  glow: 'rgba(46,230,214,0.15)'  },
  { bg: 'rgba(56,182,255,0.12)',  border: 'rgba(56,182,255,0.35)',  text: '#38B6FF',  glow: 'rgba(56,182,255,0.15)'  },
  { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)', text: '#A78BFA',  glow: 'rgba(167,139,250,0.15)' },
  { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  text: '#4ADE80',  glow: 'rgba(74,222,128,0.15)'  },
  { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', text: '#F87171',  glow: 'rgba(248,113,113,0.15)' },
]

function agentPalette(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  return AGENT_PALETTES[hash % AGENT_PALETTES.length]
}

function agentInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

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

function agentDisplayName(label: string): string {
  const stripped = label.replace(/^Agent:\s*/i, '')
  const parts = stripped.split(' - ')
  return parts[0].trim()
}

function AgentAvatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const palette = agentPalette(label)
  const name = agentDisplayName(label)
  const initials = agentInitials(name)
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-11 h-11 text-sm'

  return (
    <div
      className={cn('rounded-xl flex items-center justify-center font-bold shrink-0', dim)}
      style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text, boxShadow: `0 0 12px ${palette.glow}` }}
    >
      {initials}
    </div>
  )
}

export function MyAgents({ agents }: MyAgentsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  if (!agents || agents.length === 0) {
    return (
      <div className="rounded-2xl p-12 flex flex-col items-center justify-center text-center"
        style={{ background: 'rgba(15,17,19,0.7)', border: '1px solid rgba(200,150,60,0.15)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.20)' }}>
          <Bot className="w-8 h-8 text-[#C8963C]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Agents Yet</h3>
        <p className="text-[#7A838D] text-sm max-w-sm mb-5">
          Register your first agent to start building trust and reputation on-chain.
        </p>
        <Link href="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(200,150,60,0.15)', border: '1px solid rgba(200,150,60,0.35)', color: '#C8963C' }}>
          <Plus className="w-4 h-4" /> Register Agent
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#C8963C]" />
          <span className="text-sm text-[#7A838D]">
            <span className="font-semibold text-[#B5BDC6]">{agents.length}</span> agent{agents.length !== 1 ? 's' : ''} registered
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)' }}>
            <button onClick={() => setViewMode('grid')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === 'grid' ? 'text-[#C8963C]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'grid' ? { background: 'rgba(200,150,60,0.15)' } : {}}>
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button onClick={() => setViewMode('list')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === 'list' ? 'text-[#C8963C]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'list' ? { background: 'rgba(200,150,60,0.15)' } : {}}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <Link href="/register"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.25)', color: '#C8963C' }}>
            <Plus className="w-3.5 h-3.5" /> Register New
          </Link>
        </div>
      </div>

      {/* GRID */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map((agent, i) => {
            const palette = agentPalette(agent.label)
            const name = agentDisplayName(agent.label)
            return (
              <motion.div key={agent.termId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/agents?open=${encodeURIComponent(agent.termId)}`}>
                  <div className="group rounded-2xl p-5 transition-all cursor-pointer"
                    style={{ background: 'rgba(15,17,19,0.85)', border: `1px solid rgba(255,255,255,0.08)` }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = palette.border)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}>

                    {/* Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <AgentAvatar label={agent.label} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-sm text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {name}
                          </h4>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.20)', color: '#C8963C' }}>
                            AGENT
                          </span>
                          <span className="text-[11px] text-[#4A5260]">{timeAgo(agent.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <Users className="w-3.5 h-3.5 text-[#7A838D] shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-[#B5BDC6]">{agent.stakers}</div>
                          <div className="text-[10px] text-[#4A5260]">stakers</div>
                        </div>
                      </div>
                      <div className="rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <TrendingUp className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-[#4ADE80]">{formatShares(agent.totalStaked)}</div>
                          <div className="text-[10px] text-[#4A5260]">tTRUST</div>
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
        /* LIST */
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Header row */}
          <div className="grid grid-cols-[1fr_90px_100px] gap-3 px-5 py-2.5 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <span className="flex items-center gap-1.5"><Bot className="w-3 h-3 text-[#C8963C]" /> Agent</span>
            <span className="text-right flex items-center justify-end gap-1"><Users className="w-3 h-3" /> Stakers</span>
            <span className="text-right flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3 text-[#4ADE80]" /> tTRUST</span>
          </div>

          {agents.map((agent, i) => {
            const name = agentDisplayName(agent.label)
            const palette = agentPalette(agent.label)
            return (
              <motion.div key={agent.termId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/agents?open=${encodeURIComponent(agent.termId)}`}>
                  <div className="group grid grid-cols-[1fr_90px_100px] gap-3 px-5 py-3 transition-colors cursor-pointer hover:bg-white/[0.03]"
                    style={{ borderBottom: i < agents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>

                    {/* Agent cell */}
                    <div className="flex items-center gap-3 min-w-0">
                      <AgentAvatar label={agent.label} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {name}
                          </span>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: palette.bg, color: palette.text }}>
                            AGENT
                          </span>
                          <span className="text-[11px] text-[#4A5260]">{timeAgo(agent.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right self-center">
                      <span className="text-sm font-medium text-[#B5BDC6]">{agent.stakers}</span>
                    </div>
                    <div className="text-right self-center">
                      <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>
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
