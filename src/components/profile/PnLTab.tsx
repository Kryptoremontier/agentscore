'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, BarChart2,
  ArrowUpDown, LayoutGrid, List, Wallet, Search,
} from 'lucide-react'
import Link from 'next/link'
import type { PnLPosition } from '@/types/user'
import { getBuyCost, getSellProceeds, getCurrentPrice } from '@/lib/bonding-curve'
import { cn } from '@/lib/cn'
import { APP_CONFIG } from '@/lib/app-config'

interface Props {
  positions: PnLPosition[]
}

interface EnrichedPosition extends PnLPosition {
  sharesNum: number
  supplyNum: number
  currentValue: number
  estimatedCost: number
  pnl: number
  pnlPct: number
  sharePrice: number
  displayName: string
  href: string
}

type FilterType = 'all' | 'agent' | 'skill' | 'claim'
type SortKey = 'value' | 'pnl' | 'pnlPct' | 'shares'

const FILTER_PILLS: { id: FilterType; label: string; color: string }[] = [
  { id: 'all',   label: 'All',    color: '#B5BDC6' },
  { id: 'agent', label: 'Agents', color: '#C8963C' },
  { id: 'skill', label: 'Skills', color: '#4ADE80' },
  { id: 'claim', label: 'Claims', color: '#A78BFA' },
]

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'value',  label: 'Value' },
  { id: 'pnl',    label: 'P&L' },
  { id: 'pnlPct', label: 'P&L %' },
  { id: 'shares', label: 'Shares' },
]

function formatTrust(n: number): string {
  if (Math.abs(n) < 0.0001) return '0'
  if (Math.abs(n) < 0.01) return n.toFixed(4)
  if (Math.abs(n) < 10) return n.toFixed(3)
  if (Math.abs(n) < 1000) return n.toFixed(2)
  return `${(n / 1000).toFixed(1)}K`
}

function formatShares(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  if (n >= 1) return n.toFixed(2)
  if (n > 0) return n.toFixed(4)
  return '0'
}

function getDisplayName(pos: PnLPosition): string {
  if (pos.type === 'claim') {
    const subject = (pos.claimSubject || '').replace(/^(?:Agent|Skill):(?:\w+:)?\s*/i, '')
    return `${subject} ${pos.claimPredicate || ''} ${pos.claimObject || ''}`.trim()
  }
  return pos.label.replace(/^(?:Agent|Skill):(?:\w+:)?\s*/i, '').split(' - ')[0].trim()
}

function getHref(pos: PnLPosition): string {
  if (pos.type === 'agent') return `/agents?open=${encodeURIComponent(pos.vaultTermId)}`
  if (pos.type === 'skill') return `/skills?open=${encodeURIComponent(pos.vaultTermId)}`
  return `/claims?open=${encodeURIComponent(pos.vaultTermId)}`
}

function typeColor(type: PnLPosition['type']): string {
  if (type === 'agent') return '#C8963C'
  if (type === 'skill') return '#4ADE80'
  return '#A78BFA'
}

function typeBg(type: PnLPosition['type']): string {
  if (type === 'agent') return 'rgba(200,150,60,0.10)'
  if (type === 'skill') return 'rgba(74,222,128,0.08)'
  return 'rgba(167,139,250,0.08)'
}

function typeBorder(type: PnLPosition['type']): string {
  if (type === 'agent') return 'rgba(200,150,60,0.25)'
  if (type === 'skill') return 'rgba(74,222,128,0.20)'
  return 'rgba(167,139,250,0.20)'
}

function PnLBadge({ value, pct, size = 'sm' }: { value: number; pct: number; size?: 'sm' | 'lg' }) {
  const positive = value >= 0
  const Icon = value > 0.0001 ? TrendingUp : value < -0.0001 ? TrendingDown : Minus
  const color = positive ? '#4ADE80' : '#F87171'
  const bg = positive ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)'
  const border = positive ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <div
      className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium', textSize)}
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      <Icon className={size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      <span>{value >= 0 ? '+' : ''}{formatTrust(value)}</span>
      {Math.abs(pct) > 0.1 && (
        <span className="opacity-60">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
      )}
    </div>
  )
}

export function PnLTab({ positions }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortKey>('value')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const enriched = useMemo<EnrichedPosition[]>(() => {
    return positions.map(pos => {
      let sharesNum = 0
      let supplyNum = 0
      try { sharesNum = Number(BigInt(pos.shares)) / 1e18 } catch { /* noop */ }
      try { supplyNum = Number(BigInt(pos.totalShares)) / 1e18 } catch { /* noop */ }

      const currentValue = getSellProceeds(sharesNum, supplyNum)
      const supplyBefore = Math.max(0, supplyNum - sharesNum)
      const estimatedCost = getBuyCost(sharesNum, supplyBefore)
      const pnl = currentValue - estimatedCost
      const pnlPct = estimatedCost > 0 ? (pnl / estimatedCost) * 100 : 0
      const sharePrice = getCurrentPrice(supplyNum)

      return {
        ...pos,
        sharesNum,
        supplyNum,
        currentValue,
        estimatedCost,
        pnl,
        pnlPct,
        sharePrice,
        displayName: getDisplayName(pos),
        href: getHref(pos),
      }
    })
  }, [positions])

  const filtered = useMemo(() => {
    let list = enriched
    if (filter !== 'all') list = list.filter(p => p.type === filter)
    list.sort((a, b) => {
      switch (sortBy) {
        case 'value':  return b.currentValue - a.currentValue
        case 'pnl':    return b.pnl - a.pnl
        case 'pnlPct': return b.pnlPct - a.pnlPct
        case 'shares': return b.sharesNum - a.sharesNum
        default:       return 0
      }
    })
    return list
  }, [enriched, filter, sortBy])

  const totals = useMemo(() => {
    const t = enriched.reduce(
      (acc, p) => ({ value: acc.value + p.currentValue, cost: acc.cost + p.estimatedCost, pnl: acc.pnl + p.pnl }),
      { value: 0, cost: 0, pnl: 0 }
    )
    return { ...t, pnlPct: t.cost > 0 ? (t.pnl / t.cost) * 100 : 0 }
  }, [enriched])

  const typeCounts = useMemo(() => ({
    agent: enriched.filter(p => p.type === 'agent').length,
    skill: enriched.filter(p => p.type === 'skill').length,
    claim: enriched.filter(p => p.type === 'claim').length,
  }), [enriched])

  // Empty state
  if (positions.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 flex flex-col items-center justify-center text-center"
        style={{ background: 'rgba(15,17,19,0.7)', border: '1px solid rgba(56,189,248,0.15)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.20)' }}
        >
          <BarChart2 className="w-8 h-8 text-[#38BDF8]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Positions Yet</h3>
        <p className="text-[#7A838D] text-sm max-w-sm mb-5">
          Buy shares in Agents, Skills, or Claims to track your portfolio performance here.
        </p>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8' }}
        >
          <Search className="w-4 h-4" /> Explore Agents
        </Link>
      </div>
    )
  }

  const totalPnlPositive = totals.pnl >= 0

  return (
    <div className="space-y-4">
      {/* Portfolio overview */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Main P&L hero */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[#7A838D] text-xs mb-1 flex items-center gap-1.5">
              <Wallet className="w-3 h-3" />
              Portfolio Value
            </div>
            <div className="text-2xl font-bold text-white">{formatTrust(totals.value)} <span className="text-sm font-normal text-[#7A838D]">tTRUST</span></div>
          </div>
          <div className="text-right">
            <div className="text-[#7A838D] text-xs mb-1">Total P&L</div>
            <PnLBadge value={totals.pnl} pct={totals.pnlPct} size="lg" />
          </div>
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Agents', count: typeCounts.agent, color: '#C8963C', bg: 'rgba(200,150,60,0.06)', border: 'rgba(200,150,60,0.15)' },
            { label: 'Skills', count: typeCounts.skill, color: '#4ADE80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.15)' },
            { label: 'Claims', count: typeCounts.claim, color: '#A78BFA', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.15)' },
          ].map(c => (
            <div
              key={c.label}
              className="rounded-xl p-3 text-center"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <div className="text-lg font-bold font-mono" style={{ color: c.color }}>{c.count}</div>
              <div className="text-[10px] text-[#7A838D] mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="text-[#4A5260] text-[10px] mt-3 leading-relaxed">
          P&L estimated via bonding curve model. Cost basis assumes worst-case entry. Early buyers' actual profit is likely higher.
        </div>
      </div>

      {/* Controls: filter + sort + view */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {FILTER_PILLS.map(pill => {
            const isActive = filter === pill.id
            const count = pill.id === 'all' ? enriched.length : typeCounts[pill.id as keyof typeof typeCounts]
            return (
              <button
                key={pill.id}
                onClick={() => setFilter(pill.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  isActive ? 'text-white' : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
                style={isActive
                  ? { background: `${pill.color}18`, border: `1px solid ${pill.color}40`, color: pill.color }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {pill.label}
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="flex items-center gap-1 rounded-lg px-1 py-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ArrowUpDown className="w-3 h-3 text-[#7A838D] ml-1" />
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                  sortBy === opt.id ? 'text-[#38BDF8] bg-[rgba(56,189,248,0.12)]' : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
            <button
              onClick={() => setViewMode('list')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
                viewMode === 'list' ? 'text-[#38BDF8]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'list' ? { background: 'rgba(56,189,248,0.12)' } : {}}
            >
              <List className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
                viewMode === 'grid' ? 'text-[#38BDF8]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'grid' ? { background: 'rgba(56,189,248,0.12)' } : {}}
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Positions */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center"
          style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[#7A838D] text-sm">No {filter === 'all' ? '' : filter} positions found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((pos, i) => (
            <motion.div
              key={`${pos.vaultTermId}-${pos.side}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link href={pos.href}>
                <div
                  className="group rounded-2xl p-5 transition-all cursor-pointer hover:scale-[1.01]"
                  style={{ background: 'rgba(15,17,19,0.85)', border: `1px solid ${typeBorder(pos.type)}` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = typeColor(pos.type) + '60')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = typeBorder(pos.type))}
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                      style={{ background: typeBg(pos.type), border: `1px solid ${typeBorder(pos.type)}` }}
                    >
                      {pos.emoji || (pos.type === 'agent' ? 'A' : pos.type === 'skill' ? 'S' : 'C')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                          {pos.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: typeBg(pos.type), border: `1px solid ${typeBorder(pos.type)}`, color: typeColor(pos.type) }}
                        >
                          {pos.type.toUpperCase()}
                        </span>
                        {pos.side === 'against' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171' }}>
                            AGAINST
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-sm font-bold text-white">{formatTrust(pos.currentValue)}</div>
                      <div className="text-[10px] text-[#4A5260]">Value (tTRUST)</div>
                    </div>
                    <div className="rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-sm font-bold text-[#B5BDC6]">{formatShares(pos.sharesNum)}</div>
                      <div className="text-[10px] text-[#4A5260]">Shares</div>
                    </div>
                  </div>

                  {/* P&L footer */}
                  <div className="flex items-center justify-between pt-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[10px] text-[#4A5260]">
                      est. cost {formatTrust(pos.estimatedCost)}
                    </span>
                    <PnLBadge value={pos.pnl} pct={pos.pnlPct} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        /* LIST view */
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header row */}
          <div
            className="grid grid-cols-[1fr_85px_85px_110px] gap-3 px-5 py-2.5 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span className="flex items-center gap-1.5"><BarChart2 className="w-3 h-3 text-[#38BDF8]" /> Position</span>
            <span className="text-right">Shares</span>
            <span className="text-right">Value</span>
            <span className="text-right">P&L</span>
          </div>

          {filtered.map((pos, i) => (
            <motion.div
              key={`${pos.vaultTermId}-${pos.side}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link href={pos.href}>
                <div
                  className="group grid grid-cols-[1fr_85px_85px_110px] gap-3 px-5 py-3 transition-colors cursor-pointer hover:bg-white/[0.03]"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  {/* Position cell */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                      style={{ background: typeBg(pos.type), border: `1px solid ${typeBorder(pos.type)}` }}
                    >
                      {pos.emoji || (pos.type === 'agent' ? 'A' : pos.type === 'skill' ? 'S' : 'C')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[#E8E8E8] truncate group-hover:text-white transition-colors">
                          {pos.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: typeBg(pos.type), color: typeColor(pos.type) }}
                        >
                          {pos.type.toUpperCase()}
                        </span>
                        {pos.side === 'against' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171' }}>
                            AGAINST
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Shares */}
                  <div className="text-right self-center">
                    <div className="text-sm font-medium text-[#B5BDC6] font-mono">{formatShares(pos.sharesNum)}</div>
                    <div className="text-[10px] text-[#4A5260]">@{pos.sharePrice.toFixed(4)}</div>
                  </div>

                  {/* Value */}
                  <div className="text-right self-center">
                    <div className="text-sm font-semibold text-white">{formatTrust(pos.currentValue)}</div>
                    <div className="text-[10px] text-[#4A5260]">cost {formatTrust(pos.estimatedCost)}</div>
                  </div>

                  {/* P&L */}
                  <div className="flex items-center justify-end">
                    <PnLBadge value={pos.pnl} pct={pos.pnlPct} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
