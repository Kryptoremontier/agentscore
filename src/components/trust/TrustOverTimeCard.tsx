/**
 * Trust over time (Etap 8b): one real agent's trust, event by event, from on-chain positions
 * (lib/trust-events.ts). Left, the running count as a step curve — only from MIN_CHART_EVENTS events
 * up, never a line through 2 points. Right, the numbered events: who trusted it, for which trust
 * context, and when (names by <PersonName>, ENS when there is one). Bottom right, the one number —
 * the people who trust it now — with the tier chip and how old the data is.
 *
 * No hooks and no server imports: the landing renders it on the server, the agent page and modal
 * (Run B) can render it on the client. A failed read never reaches this card — the caller shows the
 * error instead (TrustOverTimeUnread).
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  OVER_TIME_EVENT, OVER_TIME_FEW, OVER_TIME_CHART_LABEL, OVER_TIME_OPEN, OVER_TIME_UNREAD, FIRST_TRUST_NOTE,
  overTimeShowing, peopleTrustItRest, trustEventsCount, tierProgress, STORY_SECTIONS, TIER_UNREAD,
} from '@/lib/people-copy'
import { curveGeometry, eventDate, isFirstTrust, shouldDrawCurve, sortEvents, type FirstTrust, type TrustEvent } from '@/lib/trust-events-view'
import { AGENT_TIER_LADDER, type AgentTierDisplay } from '@/lib/agent-tier'
import { PersonName } from '@/components/shared/PersonName'
import { DataAge } from '@/components/shared/DataAge'
import { TrustTierBadge } from '@/components/agents/TrustTierBadge'
import { Explainer } from '@/components/shared/Explainer'

export interface TrustOverTimeCardProps {
  agentId: string
  agentName: string
  /** Every trust event (any order); the card sorts them oldest first. */
  events: readonly TrustEvent[]
  /** ENS names by lowercase wallet, when the server already resolved them. */
  names?: Readonly<Record<string, string | null>>
  first: FirstTrust | null
  /** Distinct live wallets that trust it now — the big number. */
  people: number
  /** null = the tier couldn't be read: says so, never a default. */
  tier: { display: AgentTierDisplay; attesters: number } | null
  /** The oldest read behind the card. */
  readAt: string
  /** Where the curve ends: the time the card was built. */
  now: string
  /** Where "Open this agent" goes; null = no link (already on the agent). */
  openHref?: string | null
  /** The latest N events are listed (numbered by their place in the whole history). */
  maxEvents?: number
  compact?: boolean
}

const W = 520
const H = 200

function Curve({ events, now, label }: { events: readonly TrustEvent[]; now: string; label: string }) {
  const g = curveGeometry(events, now, W, H, { top: 16, right: 10, bottom: 10, left: 10 })
  const first = sortEvents(events)[0]
  return (
    <figure className="min-w-0" data-testid="trust-curve" data-points={g.dots.length}>
      <p className="mb-2 text-xs text-[#7A838D] tabular-nums">{trustEventsCount(g.top)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full h-auto block">
        <line x1={g.startX} x2={g.endX} y1={g.topY} y2={g.topY} stroke="rgba(255,255,255,0.10)" strokeDasharray="3 4" />
        <line x1={g.startX} x2={g.endX} y1={H - 10} y2={H - 10} stroke="rgba(255,255,255,0.14)" />
        <path d={g.area} fill="rgb(var(--accent) / 0.10)" />
        <path d={g.line} fill="none" stroke="rgb(var(--accent))" strokeWidth={2.5} strokeLinejoin="round" />
        {g.dots.map((d) => (
          <circle key={d.count} cx={d.x} cy={d.y} r={4.5} fill="#111318" stroke="rgb(var(--accent))" strokeWidth={2.5} />
        ))}
      </svg>
      <figcaption className="mt-2 flex justify-between text-[11px] text-[#7A838D] tabular-nums">
        <span>{eventDate(first.at)}</span>
        <span>{eventDate(now)}</span>
      </figcaption>
    </figure>
  )
}

export function TrustOverTimeCard({
  agentId, agentName, events, names = {}, first, people, tier, readAt, now, openHref = `/agents?open=${agentId}`, maxEvents = 5, compact = false,
}: TrustOverTimeCardProps) {
  const sorted = sortEvents(events)
  const shownFrom = Math.max(0, sorted.length - maxEvents)
  const shown = sorted.slice(shownFrom)
  const curve = shouldDrawCurve(sorted)
  return (
    <article
      className={`rounded-2xl border border-white/10 bg-[#111318]/85 backdrop-blur-md ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-8'}`}
      data-testid="trust-over-time"
      data-agent-id={agentId}
      data-events={sorted.length}
      data-curve={curve ? 'yes' : 'no'}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-[#7A838D]">{STORY_SECTIONS.overTime.label}</p>
          <h3 className={`mt-1.5 font-display font-black uppercase tracking-[-0.02em] text-white break-words ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>{agentName}</h3>
        </div>
        {openHref && (
          <Link href={openHref} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-[#ffc35a] flex-shrink-0 pt-1">
            {OVER_TIME_OPEN}
            <ArrowRight aria-hidden className="w-4 h-4" />
          </Link>
        )}
      </header>

      <div className={`mt-6 grid gap-6 ${compact ? '' : 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10'}`}>
        {curve ? (
          <Curve events={sorted} now={now} label={OVER_TIME_CHART_LABEL(agentName, sorted.length)} />
        ) : (
          <p className="text-sm text-[#7A838D] self-start" data-testid="trust-curve-none">{OVER_TIME_FEW}</p>
        )}

        <div className="min-w-0">
          <ol className="divide-y divide-white/[0.07]" data-testid="trust-events">
            {shown.map((e, i) => {
              const n = shownFrom + i + 1
              const firstEver = isFirstTrust(e, first)
              return (
                <li key={`${e.tripleId}:${e.wallet}`} className="flex gap-3 py-3 first:pt-0" data-testid="trust-event" data-first={firstEver ? 'yes' : undefined}>
                  <span className="font-mono text-sm text-accent tabular-nums pt-0.5">{String(n).padStart(2, '0')}</span>
                  <div className="min-w-0 text-sm leading-relaxed">
                    <p className="text-[#B5BDC6] break-words">
                      <PersonName wallet={e.wallet} label={e.ens ?? names[e.wallet.toLowerCase()] ?? null} className="text-white font-medium" />{' '}
                      {OVER_TIME_EVENT.trusted} <span className="text-white">{agentName}</span> {OVER_TIME_EVENT.for}{' '}
                      <span className="text-accent">{e.context}</span>
                    </p>
                    <p className="text-xs text-[#7A838D] tabular-nums">
                      {eventDate(e.at)}
                      {firstEver && <span className="ml-2 inline-block rounded px-1.5 py-px border border-accent/40 text-accent" data-testid="first-trust">{FIRST_TRUST_NOTE}</span>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
          {shownFrom > 0 && <p className="mt-2 text-xs text-[#7A838D]">{overTimeShowing(shown.length, sorted.length)}</p>}
        </div>
      </div>

      <footer className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1" data-testid="trust-card-tier">
          {tier ? (
            <>
              <TrustTierBadge tier={tier.display} size="md" />
              {tier.display.tier !== 'verified' && (
                <span className="text-xs text-[#7A838D]">{tierProgress(tier.attesters, AGENT_TIER_LADDER.verified.minAttesters)}</span>
              )}
            </>
          ) : (
            <span className="text-xs text-[#7A838D]">{TIER_UNREAD}</span>
          )}
          <Explainer term="tiers" />
        </div>
        <div className="text-right">
          <p className="leading-none" data-testid="people-number">
            <span className={`font-display font-black text-white tabular-nums ${compact ? 'text-4xl' : 'text-5xl sm:text-6xl'}`}>{people}</span>{' '}
            <span className="text-base sm:text-lg text-[#B5BDC6]">{peopleTrustItRest(people)}</span>
          </p>
          <DataAge readAt={readAt} className="mt-2 block text-xs text-[#7A838D]" />
        </div>
      </footer>
    </article>
  )
}

/** The card's failed state: the read failed — said plainly, never an empty card. */
export function TrustOverTimeUnread({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#111318]/85 ${compact ? 'p-4' : 'p-6 sm:p-8'}`} data-testid="trust-over-time" data-state="failed">
      <p className="eyebrow text-[#7A838D]">{STORY_SECTIONS.overTime.label}</p>
      <p className="mt-3 text-sm text-[#B5BDC6]">{OVER_TIME_UNREAD}</p>
    </div>
  )
}
