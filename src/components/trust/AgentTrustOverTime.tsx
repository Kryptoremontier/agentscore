'use client'

/**
 * Trust over time for one agent, on the agent page and in the /agents modal (Etap 8b Run B): the
 * landing's card (components/trust/TrustOverTimeCard), with the agent's own trust events from our
 * API (`/api/v1/agents/page/:id?parts=trustEvents` — lib/trust-events.ts, shared cache). The same
 * <3-events rule: no curve below 3. Loading keeps a fixed-height box; a failed read is the card's
 * honest error; nobody trusting it yet says so.
 */

import { useEffect, useState } from 'react'
import { fetchAgentModalData } from '@/lib/agents-page-client'
import type { AgentTierResult } from '@/lib/agent-tier'
import type { FirstTrust, TrustEvent } from '@/lib/trust-events-view'
import { OVER_TIME_NOBODY, STORY_SECTIONS } from '@/lib/people-copy'
import { TrustOverTimeCard, TrustOverTimeUnread } from './TrustOverTimeCard'

type Read =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ok'; events: TrustEvent[]; first: FirstTrust | null; readAt: string; now: string }

export function AgentTrustOverTime({ agentId, agentName, people, tier, compact = false, openHref = null }: {
  agentId: string
  agentName: string
  /**
   * Distinct live wallets that trust it (the profile's own count). null while that read is in flight
   * or failed: then the events' own distinct wallets — the same live-position rule.
   */
  people: number | null
  tier: AgentTierResult | null
  compact?: boolean
  openHref?: string | null
}) {
  const [read, setRead] = useState<Read>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    setRead({ status: 'loading' })
    fetchAgentModalData(agentId, ['trustEvents']).then((d) => {
      if (cancelled) return
      const part = d?.trustEvents
      if (!part || part.status !== 'ok') { setRead({ status: 'failed' }); return }
      setRead({ status: 'ok', events: part.value.events, first: part.value.first, readAt: part.dataReadAt, now: new Date().toISOString() })
    })
    return () => { cancelled = true }
  }, [agentId])

  if (read.status === 'loading') {
    return (
      <div className={`rounded-2xl border border-white/10 bg-[#111318]/85 ${compact ? 'p-4' : 'p-6'}`} data-testid="trust-over-time" data-state="loading">
        <p className="eyebrow text-[#7A838D]">{STORY_SECTIONS.overTime.label}</p>
        <div aria-hidden className="mt-4 h-24 rounded-lg bg-white/[0.05] animate-pulse" />
      </div>
    )
  }
  if (read.status === 'failed') return <TrustOverTimeUnread compact={compact} />
  if (read.events.length === 0) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-[#111318]/85 ${compact ? 'p-4' : 'p-6'}`} data-testid="trust-over-time" data-state="none">
        <p className="eyebrow text-[#7A838D]">{STORY_SECTIONS.overTime.label}</p>
        <p className="mt-3 text-sm text-[#B5BDC6]">{OVER_TIME_NOBODY}</p>
      </div>
    )
  }
  return (
    <TrustOverTimeCard
      agentId={agentId}
      agentName={agentName}
      events={read.events}
      first={read.first}
      people={people ?? tier?.attesters ?? new Set(read.events.map((e) => e.wallet.toLowerCase())).size}
      tier={tier ? { display: tier.display, attesters: tier.attesters } : null}
      readAt={read.readAt}
      now={read.now}
      openHref={openHref}
      compact={compact}
    />
  )
}
