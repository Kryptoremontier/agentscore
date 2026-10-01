'use client'

/**
 * The landing's live example (Etap 5b Run 2): the first agent of the /agents list in its default
 * order ("Most vouched", lib/most-vouched.ts), as its card says it — who vouches, for what, and a
 * small neutral backing number — and its three seals, the people who vouch by name (Etap 6:
 * components/agents/SealRow). It opens that agent. The box keeps one height while loading, so
 * nothing below it moves when the read answers; a failed read says so (never an empty example).
 * The name is the card's link and covers the whole card; the "?" explainers (Etap 6) sit above it —
 * a button can't live inside a link.
 */

import Link from 'next/link'
import type { CardAttesterLine } from '@/lib/agent-list'
import type { AgentTierDisplay } from '@/lib/agent-tier'
import type { AttesterSummary } from '@/lib/agent-profile'
import { EXAMPLE_HEADING, EXAMPLE_UNREAD } from '@/lib/people-copy'
import { TrustTierBadge } from '@/components/agents/TrustTierBadge'
import { BackingScore } from '@/components/agents/BackingScore'
import { SealRow } from '@/components/agents/SealRow'
import { Explainer } from '@/components/shared/Explainer'

export type ExampleAgent =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ok'
      termId: string
      name: string
      origin: 'agentscore' | 'erc8004'
      line: CardAttesterLine
      tier: AgentTierDisplay | null
      backing: number | null
      backingTip: string
      /** Who vouches (lib/agent-profile.ts summarizeAttesters), most tTRUST first — the seals. */
      attesters: AttesterSummary[]
    }

const BOX = 'block w-full max-w-md mx-auto rounded-2xl border text-left px-4 py-3 h-[104px]'

export function ExampleAgentCard({ agent }: { agent: ExampleAgent }) {
  if (agent.status !== 'ok') {
    return (
      <div className={`${BOX} border-white/10 bg-white/[0.03]`} data-testid="example-agent" data-state={agent.status}>
        <p className="text-[10px] uppercase tracking-wider text-[#7A838D] mb-2">{EXAMPLE_HEADING}</p>
        {agent.status === 'loading' ? (
          <div aria-hidden className="space-y-2 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="h-3.5 w-56 rounded bg-white/[0.07]" />
          </div>
        ) : (
          <p className="text-sm text-[#7A838D]">{EXAMPLE_UNREAD}</p>
        )}
      </div>
    )
  }
  return (
    <div
      className={`relative ${BOX} border-[#C8963C]/25 bg-[#111318]/90 hover:border-[#C8963C]/50 transition-colors`}
      data-testid="example-agent"
      data-state="ok"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-wider text-[#7A838D]">{EXAMPLE_HEADING}</p>
        <span className="inline-flex items-center gap-1.5">
          <BackingScore value={agent.backing} tip={agent.backingTip} />
          <Explainer term="backing" />
        </span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <Link
          href={`/agents?open=${agent.termId}`}
          className="font-bold text-white text-base leading-tight truncate outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-accent/70"
        >
          {agent.name}
        </Link>
        {agent.tier && <TrustTierBadge tier={agent.tier} size="sm" />}
        <span className="text-[10px] text-[#7A838D] flex-shrink-0">{agent.origin === 'erc8004' ? 'ERC-8004' : 'via AgentScore'}</span>
      </div>
      <p className={`text-sm leading-5 mt-1 truncate ${agent.line.kind === 'some' ? 'text-[#C8963C] font-medium' : 'text-[#7A838D]'}`}>
        {agent.line.claim ?? '—'}
      </p>
      <div className="flex items-center gap-2 mt-0.5 min-w-0">
        <SealRow attesters={agent.attesters} size="md" className="min-w-0" />
        <Explainer term="tiers" />
      </div>
    </div>
  )
}
