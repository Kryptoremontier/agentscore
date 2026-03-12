'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, BarChart2,
  ArrowUpDown, LayoutGrid, List, Wallet, Search,
  Bot, Zap, MessageSquare, Flame, HeartHandshake, Link as LinkIcon,
  Sparkles, ArrowLeftRight, Swords, ShieldCheck, BadgeCheck,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { usePublicClient } from 'wagmi'
import type { PnLPosition } from '@/types/user'
import { getAtomName, getAtomType, getPredicateConfig } from '@/types/claim'
import { getBuyCost, getSellProceeds, getCurrentPrice } from '@/lib/bonding-curve'
import { cn } from '@/lib/cn'

// Same as Claims Registry — for Subject → Predicate → Object pills
const PRED_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Flame, HeartHandshake, TrendingUp, Link: LinkIcon,
  Sparkles, ArrowLeftRight, Swords, ShieldCheck, BadgeCheck, MessageSquare,
}
const SUBJECT_COLOR  = { bg: 'rgba(200,150,60,0.13)',  border: 'rgba(200,150,60,0.32)',  text: '#C8963C' }
const PRED_COLOR     = { bg: 'rgba(46,230,214,0.10)',  border: 'rgba(46,230,214,0.28)',  text: '#2EE6D6' }
const OBJECT_COLOR   = { bg: 'rgba(56,182,255,0.10)',  border: 'rgba(56,182,255,0.28)',  text: '#38B6FF' }

function PredicateIcon({ name, color, size = 10 }: { name?: string; color?: string; size?: number }) {
  const Icon = PRED_ICON_MAP[name ?? ''] ?? MessageSquare
  return <Icon className="inline-block mr-1 align-middle" style={{ width: size, height: size, color: color ?? '#9ca3af' }} />
}

function AtomTypeIcon({ type, color }: { type: 'agent' | 'skill' | 'unknown'; color?: string }) {
  if (type === 'agent') return <Bot className="w-3 h-3 inline-block mr-1 align-middle shrink-0" style={{ color: color ?? '#C8963C' }} />
  if (type === 'skill') return <Zap className="w-3 h-3 inline-block mr-1 align-middle shrink-0" style={{ color: color ?? '#2EE6D6' }} />
  return <MessageSquare className="w-3 h-3 inline-block mr-1 align-middle shrink-0" style={{ color: color ?? '#7A838D' }} />
}

/** Claims icon in three colors (Subject/Predicate/Object) — matches ClaimTriplePills */
function ClaimsThreeColorIcon({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const barClass = size === 'md' ? 'w-1.5 h-4' : 'w-1 h-3'
  return (
    <span className={cn('inline-flex items-center gap-0.5 shrink-0', className)} title="Claims" aria-hidden>
      <span className={cn(barClass, 'rounded-sm')} style={{ background: '#C8963C' }} />
      <span className={cn(barClass, 'rounded-sm')} style={{ background: '#2EE6D6' }} />
      <span className={cn(barClass, 'rounded-sm')} style={{ background: '#38B6FF' }} />
    </span>
  )
}

/** Explore-style single pill for Agent or Skill — same colors as Explore menu */
const EXPLORE_COLORS = { agent: '#C8963C', skill: '#2EE6D6', claim: '#38B6FF' } as const
function EntityPill({ type, name, compact = false }: { type: 'agent' | 'skill'; name: string; compact?: boolean }) {
  const isAgent = type === 'agent'
  const color = isAgent ? SUBJECT_COLOR : { bg: 'rgba(46,230,214,0.10)', border: 'rgba(46,230,214,0.28)', text: EXPLORE_COLORS.skill }
  const Icon = isAgent ? Bot : Zap
  const pillClass = compact ? 'px-2 py-0.5 rounded-md text-[11px]' : 'px-2 py-1 rounded-lg text-xs'
  const pillCls = `${pillClass} font-semibold whitespace-nowrap flex items-center gap-1`

  return (
    <span className={pillCls} style={{ backgroundColor: color.bg, border: `1px solid ${color.border}`, color: color.text }}>
      <Icon className="w-3 h-3 shrink-0" style={{ color: color.text }} />
      {name}
    </span>
  )
}

/** Claims Registry style: Subject → Predicate → Object pills */
function ClaimTriplePills({ subject, predicate, object, compact = false }: { subject?: string; predicate?: string; object?: string; compact?: boolean }) {
  const subjType = getAtomType(subject || '')
  const objType = getAtomType(object || '')
  const predCfg = getPredicateConfig(predicate || '')
  const pillClass = compact ? 'px-2 py-0.5 rounded-md text-[11px]' : 'px-2 py-1 rounded-lg text-xs'
  const pillCls = `${pillClass} font-semibold whitespace-nowrap flex items-center`

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'gap-1' : 'gap-1.5')}>
      <span className={cn(pillCls)} style={{ backgroundColor: SUBJECT_COLOR.bg, border: `1px solid ${SUBJECT_COLOR.border}`, color: SUBJECT_COLOR.text }}>
        <AtomTypeIcon type={subjType} color={SUBJECT_COLOR.text} />
        {getAtomName(subject || '')}
      </span>
      <span className="text-[#4A5260] text-xs">→</span>
      <span className={cn(pillCls)} style={{ backgroundColor: PRED_COLOR.bg, border: `1px solid ${PRED_COLOR.border}`, color: PRED_COLOR.text }}>
        <PredicateIcon name={predCfg?.icon} color={PRED_COLOR.text} size={10} />
        {predicate || '—'}
      </span>
      <span className="text-[#4A5260] text-xs">→</span>
      <span className={cn(pillCls)} style={{ backgroundColor: OBJECT_COLOR.bg, border: `1px solid ${OBJECT_COLOR.border}`, color: OBJECT_COLOR.text }}>
        <AtomTypeIcon type={objType} color={OBJECT_COLOR.text} />
        {getAtomName(object || '')}
      </span>
    </div>
  )
}

const COST_THRESHOLD_FOR_PCT = 0.001  // Don't show P&L % when est. cost below this (avoids 90k%+ nonsense)
const MAX_PNL_PCT = 999                 // Cap displayed percentage

interface Props {
  positions: PnLPosition[]
}

interface EnrichedPosition extends PnLPosition {
  sharesNum: number
  supplyNum: number
  currentValue: number
  estimatedCost: number
  pnl: number
  pnlPct: number           // raw % (for sorting)
  pnlPctDisplay: number | null  // sanitized for display (null = hide)
  sharePrice: number
  displayName: string
  href: string
}

type FilterType = 'all' | 'agent' | 'skill' | 'claim'
type SortKey = 'value' | 'pnl' | 'pnlPct' | 'shares'

const FILTER_PILLS: { id: FilterType; label: string; color: string; icon?: React.ReactNode }[] = [
  { id: 'all',   label: 'All',    color: '#B5BDC6' },
  { id: 'agent', label: 'Agents', color: EXPLORE_COLORS.agent, icon: <Bot className="w-3 h-3 shrink-0" style={{ color: '#C8963C' }} /> },
  { id: 'skill', label: 'Skills', color: EXPLORE_COLORS.skill, icon: <Zap className="w-3 h-3 shrink-0" style={{ color: '#2EE6D6' }} /> },
  { id: 'claim', label: 'Claims', color: EXPLORE_COLORS.claim, icon: <ClaimsThreeColorIcon /> },
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
  if (type === 'skill') return '#2EE6D6'
  return '#38B6FF'
}

function typeBg(type: PnLPosition['type']): string {
  if (type === 'agent') return 'rgba(200,150,60,0.10)'
  if (type === 'skill') return 'rgba(46,230,214,0.08)'
  return 'rgba(56,182,255,0.08)'
}

function typeBorder(type: PnLPosition['type']): string {
  if (type === 'agent') return 'rgba(200,150,60,0.25)'
  if (type === 'skill') return 'rgba(46,230,214,0.22)'
  return 'rgba(56,182,255,0.22)'
}

/** Sanitize P&L % — hide or cap when cost is too low to avoid 90k%+ nonsense */
function sanitizePnlPct(pct: number, estimatedCost: number): number | null {
  if (estimatedCost < COST_THRESHOLD_FOR_PCT) return null
  const capped = Math.max(-MAX_PNL_PCT, Math.min(MAX_PNL_PCT, pct))
  return Math.abs(capped) < 0.1 ? null : capped
}

function PnLBadge({ value, pct, size = 'sm', showPct = true }: { value: number; pct: number | null; size?: 'sm' | 'lg'; showPct?: boolean }) {
  const positive = value >= 0
  const Icon = value > 0.0001 ? TrendingUp : value < -0.0001 ? TrendingDown : Minus
  const color = positive ? '#2ECC71' : '#EF4444'
  const bg = positive ? 'rgba(46,204,113,0.10)' : 'rgba(239,68,68,0.08)'
  const border = positive ? 'rgba(46,204,113,0.25)' : 'rgba(239,68,68,0.22)'
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <div
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium', textSize)}
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      <Icon className={size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      <span>{value >= 0 ? '+' : ''}{formatTrust(value)}</span>
      {showPct && pct != null && (
        <span className="opacity-70">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
      )}
    </div>
  )
}

export function PnLTab({ positions }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortKey>('value')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const pub = usePublicClient()

  // Fetch on-chain share prices for all unique vaults
  const [onChainPrices, setOnChainPrices] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!pub || positions.length === 0) return
    const vaultIds = [...new Set(positions.map(p => p.vaultTermId))]
    let cancelled = false
    ;(async () => {
      try {
        const { getSharePriceFloat } = await import('@/lib/on-chain-pricing')
        const prices: Record<string, number> = {}
        // Batch fetch in parallel (max 10 concurrent)
        for (let i = 0; i < vaultIds.length; i += 10) {
          const batch = vaultIds.slice(i, i + 10)
          const results = await Promise.allSettled(
            batch.map(async id => {
              const hex = id.startsWith('0x') ? id as `0x${string}` : `0x${id}` as `0x${string}`
              const price = await getSharePriceFloat(pub, hex)
              return { id, price }
            })
          )
          for (const r of results) {
            if (r.status === 'fulfilled') prices[r.value.id] = r.value.price
          }
        }
        if (!cancelled) setOnChainPrices(prices)
      } catch { /* silent — fallback to local model */ }
    })()
    return () => { cancelled = true }
  }, [pub, positions])

  const enriched = useMemo<EnrichedPosition[]>(() => {
    return positions.map(pos => {
      let sharesNum = 0
      let supplyNum = 0
      try { sharesNum = Number(BigInt(pos.shares)) / 1e18 } catch { /* noop */ }
      try { supplyNum = Number(BigInt(pos.totalShares)) / 1e18 } catch { /* noop */ }

      const onChainPrice = onChainPrices[pos.vaultTermId]
      const currentValue = onChainPrice != null
        ? sharesNum * onChainPrice
        : getSellProceeds(sharesNum, supplyNum)
      const supplyBefore = Math.max(0, supplyNum - sharesNum)
      const estimatedCost = getBuyCost(sharesNum, supplyBefore)
      const pnl = currentValue - estimatedCost
      const rawPct = estimatedCost > 0 ? (pnl / estimatedCost) * 100 : 0
      const pnlPctDisplay = sanitizePnlPct(rawPct, estimatedCost)
      const sharePrice = onChainPrice ?? getCurrentPrice(supplyNum)

      return {
        ...pos,
        sharesNum,
        supplyNum,
        currentValue,
        estimatedCost,
        pnl,
        pnlPct: rawPct,
        pnlPctDisplay,
        sharePrice,
        displayName: getDisplayName(pos),
        href: getHref(pos),
      }
    })
  }, [positions, onChainPrices])

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
    const rawPct = t.cost > 0 ? (t.pnl / t.cost) * 100 : 0
    return { ...t, pnlPct: rawPct, pnlPctDisplay: sanitizePnlPct(rawPct, t.cost) }
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
        style={{ background: 'linear-gradient(135deg,#13161A,#1A1E24)', border: '1px solid rgba(200,150,60,0.2)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.25)', boxShadow: '0 0 20px rgba(200,150,60,0.12)' }}
        >
          <BarChart2 className="w-8 h-8 text-[#C8963C]" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Positions Yet</h3>
        <p className="text-[#7A838D] text-sm max-w-sm mb-5">
          Buy shares in Agents, Skills, or Claims to track your portfolio performance here.
        </p>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.3)', color: '#C8963C' }}
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
        style={{ background: 'linear-gradient(135deg,#13161A,#1A1E24)', border: '1px solid rgba(255,255,255,0.1)' }}
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
            <PnLBadge value={totals.pnl} pct={totals.pnlPctDisplay} size="lg" />
          </div>
        </div>

        {/* Breakdown cards — icons from Explore menu */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Agents', count: typeCounts.agent, color: EXPLORE_COLORS.agent, bg: 'rgba(200,150,60,0.08)', border: 'rgba(200,150,60,0.2)', icon: <Bot className="w-4 h-4 shrink-0" style={{ color: '#C8963C' }} /> },
            { label: 'Skills', count: typeCounts.skill, color: EXPLORE_COLORS.skill, bg: 'rgba(46,230,214,0.08)', border: 'rgba(46,230,214,0.2)', icon: <Zap className="w-4 h-4 shrink-0" style={{ color: '#2EE6D6' }} /> },
            { label: 'Claims', count: typeCounts.claim, color: EXPLORE_COLORS.claim, bg: 'rgba(56,182,255,0.08)', border: 'rgba(56,182,255,0.2)', icon: <ClaimsThreeColorIcon size="md" /> },
          ].map(c => (
            <div
              key={c.label}
              className="rounded-xl p-3 text-center flex flex-col items-center gap-1"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <div className="flex items-center justify-center gap-1.5">
                {c.icon}
                <span className="text-lg font-bold font-mono" style={{ color: c.color }}>{c.count}</span>
              </div>
              <div className="text-[10px] text-[#7A838D]">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="text-[#6B7480] text-[11px] mt-3 leading-relaxed">
          Values from on-chain share price. Cost basis estimated (no purchase history on-chain).
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2.5">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
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
                {pill.icon}
                {pill.label}
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Sort + View */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg px-1 py-0.5"
            style={{ background: 'rgba(200,150,60,0.06)', border: '1px solid rgba(200,150,60,0.18)' }}>
            <ArrowUpDown className="w-3 h-3 text-[#C8963C] ml-1" />
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                  sortBy === opt.id ? 'text-[#C8963C] font-semibold' : 'text-[#7A838D] hover:text-[#B5BDC6]'
                )}
                style={sortBy === opt.id ? { background: 'rgba(200,150,60,0.12)' } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(200,150,60,0.2)', background: 'rgba(200,150,60,0.05)' }}>
            <button
              onClick={() => setViewMode('list')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
                viewMode === 'list' ? 'text-[#C8963C]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'list' ? { background: 'rgba(200,150,60,0.15)' } : {}}
            >
              <List className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all',
                viewMode === 'grid' ? 'text-[#C8963C]' : 'text-[#7A838D] hover:text-[#B5BDC6]')}
              style={viewMode === 'grid' ? { background: 'rgba(200,150,60,0.15)' } : {}}
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Positions */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center"
          style={{ background: 'linear-gradient(135deg,#13161A,#151A20)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                  style={{ background: 'linear-gradient(135deg,#13161A,#151A20)', border: `1px solid ${typeBorder(pos.type)}` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = typeColor(pos.type) + '60')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = typeBorder(pos.type))}
                >
                  {/* Header — type icon (Explore) + Claims Registry style pills */}
                  <div className="flex flex-col gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {pos.type === 'agent' && <Bot className="w-4 h-4 shrink-0" style={{ color: EXPLORE_COLORS.agent }} />}
                      {pos.type === 'skill' && <Zap className="w-4 h-4 shrink-0" style={{ color: EXPLORE_COLORS.skill }} />}
                      {pos.type === 'claim' && <ClaimsThreeColorIcon size="md" />}
                      {pos.type === 'claim' ? (
                        <ClaimTriplePills subject={pos.claimSubject} predicate={pos.claimPredicate} object={pos.claimObject} />
                      ) : (
                        <EntityPill type={pos.type} name={pos.displayName} />
                      )}
                      {pos.side === 'against' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium w-fit"
                          style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171' }}>
                          AGAINST
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-lg px-2.5 py-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-[10px] text-[#6B7480] mb-0.5 uppercase">Value</div>
                      <div className="text-sm font-bold text-white font-mono truncate">{formatTrust(pos.currentValue)}</div>
                    </div>
                    <div className="rounded-lg px-2.5 py-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-[10px] text-[#6B7480] mb-0.5 uppercase">Shares</div>
                      <div className="text-sm font-bold text-[#B5BDC6] font-mono truncate">{formatShares(pos.sharesNum)}</div>
                    </div>
                    <div className="rounded-lg px-2.5 py-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-[10px] text-[#6B7480] mb-0.5 uppercase">Est. Cost</div>
                      <div className="text-sm font-bold text-[#7A838D] font-mono truncate">{formatTrust(pos.estimatedCost)}</div>
                    </div>
                  </div>

                  {/* P&L footer */}
                  <div className="flex items-center justify-end">
                    <PnLBadge value={pos.pnl} pct={pos.pnlPctDisplay} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        /* LIST view — expandable rows, SHARES/VALUE/EST. COST shown on click */
        <div className="space-y-2">
          {filtered.map((pos, i) => {
            const rowKey = `${pos.vaultTermId}-${pos.side}`
            const isExpanded = expandedId === rowKey
            return (
              <motion.div
                key={rowKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpandedId(isExpanded ? null : rowKey))}
                  className="group rounded-xl px-4 py-3.5 transition-all cursor-pointer hover:border-white/20"
                  style={{ background: 'linear-gradient(135deg,#13161A,#151A20)', border: `1px solid ${typeBorder(pos.type)}` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = typeColor(pos.type) + '50')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = typeBorder(pos.type))}
                >
                  {/* Top: chevron + type icon (Explore) + title + P&L badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0 text-[#6B7480]" aria-hidden>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className="shrink-0" aria-hidden>
                        {pos.type === 'agent' && <Bot className="w-4 h-4" style={{ color: EXPLORE_COLORS.agent }} />}
                        {pos.type === 'skill' && <Zap className="w-4 h-4" style={{ color: EXPLORE_COLORS.skill }} />}
                        {pos.type === 'claim' && <ClaimsThreeColorIcon />}
                      </span>
                      <div className="min-w-0 flex-1">
                        {pos.type === 'claim' ? (
                          <div className="flex flex-col gap-1.5">
                            <ClaimTriplePills subject={pos.claimSubject} predicate={pos.claimPredicate} object={pos.claimObject} compact />
                            {pos.side === 'against' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium w-fit"
                                style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171' }}>
                                AGAINST
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <EntityPill type={pos.type} name={pos.displayName} compact />
                            {pos.side === 'against' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium w-fit"
                                style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171' }}>
                                AGAINST
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <PnLBadge value={pos.pnl} pct={pos.pnlPctDisplay} />
                    </div>
                  </div>

                  {/* Bottom: SHARES, VALUE, EST. COST — visible only after click */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-[10px] text-[#6B7480] mb-0.5 uppercase tracking-wider">Shares</div>
                          <div className="text-sm font-semibold text-[#B5BDC6] font-mono">{formatShares(pos.sharesNum)}</div>
                          <div className="text-[10px] text-[#4A5260] font-mono mt-0.5">@{pos.sharePrice.toFixed(4)}</div>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-[10px] text-[#6B7480] mb-0.5 uppercase tracking-wider">Value</div>
                          <div className="text-sm font-semibold text-white font-mono">{formatTrust(pos.currentValue)}</div>
                          <div className="text-[10px] text-[#4A5260] mt-0.5">tTRUST</div>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-[10px] text-[#6B7480] mb-0.5 uppercase tracking-wider">Est. Cost</div>
                          <div className="text-sm font-semibold text-[#7A838D] font-mono">{formatTrust(pos.estimatedCost)}</div>
                          <div className="text-[10px] text-[#4A5260] mt-0.5">tTRUST</div>
                        </div>
                      </div>
                      <Link
                        href={pos.href}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C8963C] hover:text-[#E8B84B] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View details
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
