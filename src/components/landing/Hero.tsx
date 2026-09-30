'use client'

/**
 * The landing's first screen — the whole story on one phone screen (Etap 5b Run 2), in order:
 *   1. "Trust Layer for AI Agents" and what it means: real people vouch, one wallet never can alone.
 *   2. A live example: the first agent of the /agents list in its default order (Most vouched).
 *   3. Three steps: find an agent · see who vouches, and for what · vouch for one you know.
 *   4. One number: how many people vouch for agents here (/api/v1/stats — distinct live attesters).
 *   5. Two ways in: vouch for an agent (/agents), or build on it (/docs: MCP / REST).
 * "Live on Intuition Testnet" stays as a small badge. Each part carries data-story="n" so the
 * harness can check it is inside a 390×844 first screen.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Code2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fetchLandingStats, landingPeopleNumber, type LandingStatsState } from '@/lib/landing-stats'
import { fetchAgentsPage } from '@/lib/agents-page-client'
import { agentsPageView } from '@/lib/agents-page-types'
import { mostVouched } from '@/lib/most-vouched'
import { attesterLineOf, tierChipOf } from '@/lib/agent-list'
import { summarizeAttesters } from '@/lib/agent-profile'
import { measuredScore, noScoreTooltip } from '@/lib/score-basis'
import { effectiveLabel } from '@/lib/api-data'
import { cleanAtomName } from '@/types/claim'
import {
  LIVE_ON_TESTNET, LANDING_TITLE, LANDING_SUB, LANDING_STEPS, peopleVouchHereParts,
  LANDING_CTA_VOUCH, LANDING_CTA_DEVELOPERS,
} from '@/lib/people-copy'
import { ExampleAgentCard, type ExampleAgent } from './ExampleAgentCard'
import { Explainer } from '@/components/shared/Explainer'

function WaveText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {char === ' ' ? ' ' : char}
        </motion.span>
      ))}
    </span>
  )
}

export function Hero() {
  // One source per number: /api/v1/stats (lib/landing-stats.ts) and the list's own read
  // (lib/most-vouched.ts). Loading and failure print "—" or say so — never a 0.
  const [statsState, setStatsState] = useState<LandingStatsState>({ status: 'loading' })
  const [example, setExample] = useState<ExampleAgent>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchLandingStats().then((stats) => {
      if (!cancelled) setStatsState(stats ? { status: 'ok', stats } : { status: 'error' })
    })
    fetchAgentsPage().then((payload) => {
      if (cancelled) return
      const view = agentsPageView(payload)
      const top = view.unreachable ? null : mostVouched(view, 1)
      const first = top?.entries[0]
      if (!top || !first) { setExample({ status: 'error' }); return }
      const id = first.agent.term_id
      const attesters = summarizeAttesters(top.attestations?.get(id) ?? [])
      setExample({
        status: 'ok',
        termId: id,
        name: cleanAtomName(effectiveLabel(first.agent)),
        origin: first.agent.origin,
        line: attesterLineOf(top.views, id),
        tier: tierChipOf(top.views, id),
        backing: measuredScore(first.trust, first.measured),
        backingTip: noScoreTooltip(first.reading),
        attesters,
      })
    })
    return () => { cancelled = true }
  }, [])

  const people = landingPeopleNumber(statsState)
  const peopleHere = peopleVouchHereParts(people.value)

  return (
    <section className="relative overflow-hidden">
      {/* Gradient overlays on top of the fixed page background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/70 via-transparent to-[rgb(10,10,15)]/80" />
      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.7)]" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-12 lg:pt-28 lg:pb-20 text-center">
        {/* The small testnet badge */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 text-xs font-medium transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          {LIVE_ON_TESTNET}
        </Link>

        {/* 1 — what this is */}
        <div data-story="1" className="mt-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.1]">
            <WaveText text={LANDING_TITLE[0]} className="block text-white drop-shadow-2xl" />
            <WaveText
              text={LANDING_TITLE[1]}
              className="block bg-gradient-to-r from-[#C9A84C] via-[#C8963C] to-[#A87820] bg-clip-text text-transparent drop-shadow-2xl"
            />
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
            {LANDING_SUB} <Explainer term="vouch" className="-mt-0.5" />
          </p>
        </div>

        {/* 2 — a live example: the most vouched agent right now */}
        <div data-story="2" className="mt-5">
          <ExampleAgentCard agent={example} />
        </div>

        {/* 3 — three steps */}
        <ol data-story="3" className="mt-5 grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto text-left">
          {LANDING_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-1.5 sm:gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#C8963C]/15 border border-[#C8963C]/40 text-[#C8963C] text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-xs sm:text-sm text-slate-200 leading-snug">{step}</span>
            </li>
          ))}
        </ol>

        {/* 4 — one number */}
        <p data-story="4" className="mt-5 text-base sm:text-lg text-white font-semibold" data-testid="people-vouching" data-state={statsState.status}>
          <span className="text-[#C8963C] tabular-nums" title={people.unavailable ?? undefined}>{peopleHere.count}</span>{' '}
          {peopleHere.rest}
        </p>

        {/* 5 — two ways in */}
        <div data-story="5" className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
          <Link
            href="/agents"
            className={cn(
              'group w-full sm:w-auto max-w-md flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
              'bg-gradient-to-r from-[#C8963C] to-[#A87820] text-[#0F1113] font-bold',
              'shadow-lg shadow-[#C8963C]/25 hover:shadow-xl hover:shadow-[#C8963C]/40 transition-all',
            )}
          >
            {LANDING_CTA_VOUCH}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/docs"
            className="w-full sm:w-auto max-w-md flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-200 transition-colors"
          >
            <Code2 className="w-4 h-4" />
            {LANDING_CTA_DEVELOPERS}
          </Link>
        </div>
      </div>
    </section>
  )
}
