'use client'

/**
 * ForgeTrustTimeline — standalone timeline for forge projects.
 * Wraps buildForgeTimeline() (which calls buildAgentTimeline() + maps events).
 * Renders same UI patterns as TrustTimeline without modifying it.
 */

import { useMemo } from 'react'
import { Hammer, TrendingUp, TrendingDown, LogOut, Star, Wifi, Crown, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buildForgeTimeline } from '@/lib/forge/timeline'
import type { TimelineEvent } from '@/lib/trust-timeline'
import { ScoreTrajectoryChart } from '@/components/agents/TrustTimeline'

// ─── Severity styles (matches TrustTimeline) ──────────────────────────────────

const SEVERITY_STYLES = {
  positive:  { bg: 'rgba(46,204,113,0.12)',  border: 'rgba(46,204,113,0.35)',  text: '#2ECC71' },
  negative:  { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#EF4444' },
  neutral:   { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.45)' },
  milestone: { bg: 'rgba(200,150,60,0.12)',  border: 'rgba(200,150,60,0.35)',  text: '#C8963C' },
}

function getEventIcon(event: TimelineEvent): { Icon: LucideIcon; color: string } {
  switch (event.type) {
    case 'registered':      return { Icon: Hammer,      color: '#C8963C' }
    case 'staker_joined':   return { Icon: TrendingUp,  color: '#2ECC71' }
    case 'staker_opposed':  return { Icon: TrendingDown, color: '#EF4444' }
    case 'staker_left':     return { Icon: LogOut,       color: '#7A838D' }
    case 'evaluator_staked':
      return event.metadata?.evaluatorTier === 'sage'
        ? { Icon: Crown,    color: '#2ECC71' }
        : { Icon: Sparkles, color: '#C8963C' }
    case 'tier_upgrade':    return { Icon: Star, color: '#C8963C' }
    case 'a2a_ready':       return { Icon: Wifi, color: '#2EE6D6' }
    default:                return { Icon: Hammer, color: '#7A838D' }
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function EventCard({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const style = SEVERITY_STYLES[event.severity]
  const { Icon, color } = getEventIcon(event)

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: style.bg, border: `1.5px solid ${style.border}` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
        )}
      </div>

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ForgeTrustTimelineProps {
  projectId: string
  projectName: string
  createdAt: string
  currentScore: number
  currentTier: string
  // counterTermId: needed to distinguish oppose signals from support signals
  counterTermId?: string
  agentSignals?: Array<{
    id: string
    delta: string
    account_id: string
    term_id: string
    created_at: string
    deposit_id: string | null
    redemption_id: string | null
  }>
  skillTriples?: Array<{
    id: string
    predicate: { label: string }
    object: { id: string; label: string }
  }>
  // Serializable form of Map<address, weight> for server→client boundary
  evaluatorWeightsEntries?: [string, number][]
  isA2AReady?: boolean
}

export function ForgeTrustTimeline({
  projectId,
  projectName,
  createdAt,
  currentScore,
  currentTier,
  counterTermId,
  agentSignals = [],
  skillTriples = [],
  evaluatorWeightsEntries,
  isA2AReady = false,
}: ForgeTrustTimelineProps) {
  const timeline = useMemo(() => {
    // Reconstruct evaluator weights Map from serializable entries
    const evaluatorWeights = evaluatorWeightsEntries?.length
      ? new Map<string, number>(evaluatorWeightsEntries)
      : undefined

    // Fix 6: correctly detect oppose signals using counterTermId
    const stakingEvents = agentSignals.map(sig => ({
      id: sig.id,
      accountId: sig.account_id,
      type: sig.deposit_id ? ('deposit' as const) : ('redeem' as const),
      side: (counterTermId && sig.term_id === counterTermId) ? ('oppose' as const) : ('support' as const),
      deltaWei: sig.delta.replace('-', ''),
      timestamp: sig.created_at,
    }))

    // Map skill triples to SkillEvent shape
    const skillEvents = skillTriples.map(t => ({
      tripleId: t.id,
      skillId: t.object.id,
      skillName: t.object.label,
    }))

    return buildForgeTimeline({
      agentId: projectId,
      agentName: projectName,
      createdAt,
      currentScore,
      currentTier,
      stakingEvents,
      skillEvents,
      evaluatorWeights,
      profileCompleteness: { isA2AReady },
    })
  }, [projectId, projectName, createdAt, currentScore, currentTier, counterTermId, agentSignals, skillTriples, evaluatorWeightsEntries, isA2AReady]) // eslint-disable-line react-hooks/exhaustive-deps

  if (timeline.events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-white/20">No timeline events yet — be the first to stake!</p>
      </div>
    )
  }

  const hasChart = timeline.scoreHistory.length >= 2

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Trust History</h3>
        <span className="text-xs text-white/25">{timeline.events.length} events</span>
      </div>

      <div className={`grid gap-6 ${hasChart ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ minHeight: hasChart ? 320 : undefined }}>
        {hasChart && (
          <div
            className="flex flex-col rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 280 }}
          >
            <ScoreTrajectoryChart
              scoreHistory={timeline.scoreHistory}
              currentScore={currentScore}
            />
          </div>
        )}

        <div className={hasChart ? 'overflow-y-auto pr-1' : ''} style={hasChart ? { maxHeight: 480 } : undefined}>
          {timeline.events.map((event, i) => (
            <EventCard key={event.id} event={event} isLast={i === timeline.events.length - 1} />
          ))}
        </div>
      </div>
    </div>
  )
}
