'use client'

import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { cleanAtomName } from '@/types/claim'
import {
  buildAgentTimeline,
  type TimelineEvent,
  type StakingEvent,
  type SkillEvent,
  type TimelineEventType,
} from '@/lib/trust-timeline'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentSignal {
  id: string
  delta: string
  account_id: string
  term_id: string
  created_at: string
  deposit_id: string | null
  redemption_id: string | null
}

interface SkillTriple {
  id: string
  predicate: { label: string }
  object: { id: string; label: string }
}

interface TrustTimelineProps {
  agentId: string
  agentName: string
  createdAt: string
  currentScore: number
  currentTier: string
  agentSignals: AgentSignal[]
  counterTermId?: string | null
  skillTriples: SkillTriple[]
  evaluatorWeights?: Map<string, number>
  isA2AReady?: boolean
}

// ─── Filter options ───────────────────────────────────────────────────────────

const FILTER_OPTIONS: { id: string; label: string; types?: TimelineEventType[] }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'staking', label: 'Staking Only', types: ['staker_joined', 'staker_opposed', 'staker_left', 'evaluator_staked'] },
  { id: 'skills', label: 'Skills Only', types: ['skill_added'] },
  { id: 'milestones', label: 'Milestones', types: ['registered', 'tier_upgrade', 'a2a_ready'] },
  { id: 'negative', label: 'Negative Events', types: ['staker_opposed', 'staker_left'] },
]

// ─── Severity colors ──────────────────────────────────────────────────────────

const SEVERITY_STYLES = {
  positive:  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10b981' },
  negative:  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#ef4444' },
  neutral:   { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.5)' },
  milestone: { bg: 'rgba(200,150,60,0.12)', border: 'rgba(200,150,60,0.35)', text: '#C8963C' },
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const style = SEVERITY_STYLES[event.severity]

  return (
    <div className="flex gap-3">
      {/* Dot + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: style.bg, border: `1.5px solid ${style.border}` }}
        >
          {event.icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        )}
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold text-white leading-tight">{event.title}</p>
          {event.scoreAtEvent !== null && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums"
              style={{ color: style.text, background: style.bg }}
            >
              {event.scoreAtEvent > 0 ? event.scoreAtEvent : '—'}
            </span>
          )}
        </div>
        <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {formatDate(event.timestamp)}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {event.description}
        </p>
      </div>
    </div>
  )
}

// ─── Score Chart ──────────────────────────────────────────────────────────────

function ScoreChart({
  scoreHistory,
  currentScore,
}: {
  scoreHistory: { date: string; score: number }[]
  currentScore: number
}) {
  const chartData = scoreHistory.map(p => ({
    date: formatDateShort(p.date),
    score: p.score,
  }))

  const scoreColor = currentScore >= 80 ? '#10b981'
    : currentScore >= 60 ? '#34d399'
    : currentScore >= 40 ? '#f59e0b'
    : currentScore >= 20 ? '#f97316'
    : '#ef4444'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Score Trajectory
        </p>
        <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor }}>
          {currentScore}
        </span>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="tlScoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={scoreColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={scoreColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1d24',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#fff',
              }}
              formatter={(value: number | undefined) => [value ?? 0, 'Score']}
              labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}
            />
            {/* Tier threshold lines */}
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 3" />
            <ReferenceLine y={75} stroke="rgba(200,150,60,0.15)" strokeDasharray="4 3" />
            <Area
              type="monotone"
              dataKey="score"
              stroke={scoreColor}
              strokeWidth={2}
              fill="url(#tlScoreGrad)"
              dot={false}
              activeDot={{ r: 4, fill: scoreColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
          Sandbox threshold (50)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 border-t border-dashed" style={{ borderColor: 'rgba(200,150,60,0.3)' }} />
          Verified threshold (75)
        </span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrustTimeline({
  agentId,
  agentName,
  createdAt,
  currentScore,
  currentTier,
  agentSignals,
  counterTermId,
  skillTriples,
  evaluatorWeights,
  isA2AReady,
}: TrustTimelineProps) {
  const [filter, setFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)

  // Convert raw page data → timeline engine inputs
  const stakingEvents = useMemo<StakingEvent[]>(() => {
    return agentSignals.map(s => {
      const deltaNum = Number(s.delta || 0)
      return {
        id: s.id,
        accountId: s.account_id,
        type: deltaNum >= 0 ? 'deposit' : 'redeem',
        side: (counterTermId && s.term_id === counterTermId) ? 'oppose' : 'support',
        deltaWei: Math.abs(deltaNum).toString(),
        timestamp: s.created_at,
      } as StakingEvent
    })
  }, [agentSignals, counterTermId])

  const skillEventsInput = useMemo<SkillEvent[]>(() => {
    const SKILL_PREDICATES = ['hasagentskill', 'has-agent-skill']
    return skillTriples
      .filter(t => SKILL_PREDICATES.includes(t.predicate.label.toLowerCase()))
      .map(t => ({
        tripleId: t.id,
        skillId: t.object.id,
        skillName: cleanAtomName(t.object.label),
        timestamp: undefined, // not available in UI data — uses createdAt fallback
      }))
  }, [skillTriples])

  const timeline = useMemo(() => {
    return buildAgentTimeline({
      agentId,
      agentName,
      createdAt,
      currentScore,
      currentTier,
      stakingEvents,
      skillEvents: skillEventsInput,
      evaluatorWeights,
      profileCompleteness: isA2AReady !== undefined ? { isA2AReady } : undefined,
    })
  }, [agentId, agentName, createdAt, currentScore, currentTier, stakingEvents, skillEventsInput, evaluatorWeights, isA2AReady])

  const activeFilter = FILTER_OPTIONS.find(f => f.id === filter)!
  const visibleEvents = activeFilter.types
    ? timeline.events.filter(e => activeFilter.types!.includes(e.type))
    : timeline.events

  const { summary } = timeline

  return (
    <div className="p-5">
      {/* Summary row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <span>
            <span className="text-white font-semibold">{summary.totalEvents}</span> events
          </span>
          {summary.daysActive > 0 && (
            <span>
              Active <span className="text-white font-semibold">{summary.daysActive}</span> days
            </span>
          )}
          <span style={{ color: summary.currentStreak.includes('positive') || summary.currentStreak.includes('momentum') ? '#10b981' : summary.currentStreak.includes('pressure') || summary.currentStreak.includes('opposition') ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
            {summary.currentStreak}
          </span>
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            {activeFilter.label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-10 py-1 min-w-[160px]"
              style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setFilter(opt.id); setFilterOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    color: filter === opt.id ? '#C8963C' : 'rgba(255,255,255,0.6)',
                    background: filter === opt.id ? 'rgba(200,150,60,0.08)' : 'transparent',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 min-h-[340px]">
        {/* Left: Event list */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[480px] pr-1">
          {visibleEvents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {timeline.events.length === 0
                  ? 'No timeline events yet. Stake on this agent or add skills to start building history.'
                  : 'No events match this filter.'}
              </p>
            </div>
          ) : (
            <div>
              {visibleEvents.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isLast={i === visibleEvents.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Score chart — only on md+ */}
        <div
          className="hidden md:flex flex-col flex-shrink-0 rounded-xl p-4"
          style={{ width: 220, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <ScoreChart
            scoreHistory={timeline.scoreHistory}
            currentScore={currentScore}
          />
        </div>
      </div>
    </div>
  )
}
