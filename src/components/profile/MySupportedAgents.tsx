'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, ThumbsUp, ShieldAlert, ExternalLink, Search, LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'
import type { AgentSupport } from '@/types/user'
import { cn } from '@/lib/cn'

interface MySupportedAgentsProps {
  supports: AgentSupport[]
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
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function entityDisplayName(label: string): string {
  return label.replace(/^(Agent:|Skill:)\s*/i, '').split(' - ')[0].trim()
}

export function MySupportedAgents({ supports }: MySupportedAgentsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  if (!supports || supports.length === 0) {
    return (
      <div className="rounded-2xl p-12 flex flex-col items-center justify-center text-center"
        style={{ background: 'rgba(15,17,19,0.7)', border: '1px solid rgba(74,222,128,0.15)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.20)' }}>
          <TrendingUp className="w-8 h-8 text-[#4ADE80]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Positions Yet</h3>
        <p className="text-[#7A838D] text-sm max-w-sm mb-5">
          Browse agents or skills and stake tTRUST to support or oppose them. Your positions will appear here.
        </p>
        <Link href="/agents"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }}>
          <Search className="w-4 h-4" /> Explore Agents
        </Link>
      </div>
    )
  }

  const forPositions = supports.filter(s => s.side === 'for')
  const againstPositions = supports.filter(s => s.side === 'against')
  const totalStaked = supports.reduce((sum, s) => sum + Number(BigInt(s.shares || '0')) / 1e18, 0)

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Positions', value: supports.length, color: '#B5BDC6', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
          { label: 'Supporting', value: forPositions.length, color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.20)' },
          { label: 'Opposing', value: againstPositions.length, color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.20)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-[#7A838D] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#7A838D]">
          Total staked: <span className="font-semibold" style={{ color: '#4ADE80' }}>
            {totalStaked >= 1 ? totalStaked.toFixed(2) : totalStaked.toFixed(4)} tTRUST
          </span>
        </p>
        <div className="flex items-center rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
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
      </div>

      {/* GRID view */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {supports.map((pos, i) => {
            const isFor = pos.side === 'for'
            const accent = isFor ? '#4ADE80' : '#F87171'
            const accentBg = isFor ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)'
            const accentBorder = isFor ? 'rgba(74,222,128,0.20)' : 'rgba(248,113,113,0.20)'
            return (
              <motion.div key={`${pos.agentTermId}-${pos.side}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/agents?open=${encodeURIComponent(pos.agentTermId)}`}>
                  <div className="group rounded-2xl p-5 transition-all cursor-pointer hover:scale-[1.01]"
                    style={{ background: 'rgba(15,17,19,0.8)', border: `1px solid ${accentBorder}` }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = accent + '60')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = accentBorder)}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
                        {isFor
                          ? <ThumbsUp className="w-4.5 h-4.5" style={{ color: accent }} />
                          : <ShieldAlert className="w-4.5 h-4.5" style={{ color: accent }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {pos.agentEmoji && <span className="text-base">{pos.agentEmoji}</span>}
                          <span className="font-semibold text-sm text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                            {entityDisplayName(pos.agentLabel)}
                          </span>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: accentBg, color: accent }}>
                            {isFor ? 'SUPPORT' : 'OPPOSE'}
                          </span>
                          <span className="text-[11px] text-[#7A838D]">{timeAgo(pos.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
        /* LIST view */
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(15,17,19,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-[1fr_80px_100px] gap-3 px-5 py-2.5 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span>Entity</span>
            <span className="text-center">Side</span>
            <span className="text-right">tTRUST</span>
          </div>
          {supports.map((pos, i) => {
            const isFor = pos.side === 'for'
            const accent = isFor ? '#4ADE80' : '#F87171'
            const accentBg = isFor ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)'
            return (
              <motion.div key={`${pos.agentTermId}-${pos.side}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/agents?open=${encodeURIComponent(pos.agentTermId)}`}>
                  <div className="group grid grid-cols-[1fr_80px_100px] gap-3 px-5 py-3 transition-colors hover:bg-white/[0.03]"
                    style={{ borderBottom: i < supports.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      {pos.agentEmoji
                        ? <span className="text-base shrink-0">{pos.agentEmoji}</span>
                        : <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: accentBg }}>
                            {isFor ? <ThumbsUp className="w-3.5 h-3.5" style={{ color: accent }} />
                              : <ShieldAlert className="w-3.5 h-3.5" style={{ color: accent }} />}
                          </div>
                      }
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-[#E8E8E8] font-medium truncate group-hover:text-white transition-colors">
                            {entityDisplayName(pos.agentLabel)}
                          </span>
                          <ExternalLink className="w-3 h-3 text-[#7A838D] opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                        <span className="text-[11px] text-[#4A5260]">{timeAgo(pos.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: accentBg, color: accent }}>
                        {isFor ? 'FOR' : 'AGAINST'}
                      </span>
                    </div>
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
