'use client'

/**
 * The landing's first screen (Etap 6b: the hero in the new type) — left-aligned over the page's
 * background, the whole story on one phone screen, in order:
 *   1. The eyebrow ("// TRUST LAYER · LIVE ON INTUITION TESTNET", mono, amber), the headline
 *      ("Trust layer for" / the accent word "AI agents." with its swash) and the subtitle
 *      (LANDING_SUB: real people vouch, one wallet never can alone).
 *   2. In the sentence after it, the one number — "1 person" in the accent, live from
 *      /api/v1/stats (distinct live attesters) — and the invitation: "Be the second." / "Add yours."
 *   3. Two ways in: vouch for an agent (/agents, the primary), developers & agents (/docs).
 *   4. The check row (mono): testnet tTRUST is free · every vouch is on-chain · one wallet can't.
 *   5. A live example: the first agent of the /agents list in its default order (Most vouched),
 *      with its seals — beside the hero on desktop, below it on a phone.
 * The three steps are told in full right below, in How it works. Each part carries data-story="n"
 * so the harness can check it is inside a 390×844 first screen.
 *
 * The page background (app/layout.tsx: a fixed image, its horizon glow about halfway down) shows
 * through this section's two overlays. On desktop the section keeps the height it had before 6b —
 * 759px at every width from 1024 to 1920 (153dcb7) — so the glow lands inside it, under the same
 * overlays, exactly as it did; the 6b content, shorter, sits centred in it. The card's top meets
 * the headline's.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Code2 } from 'lucide-react'
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
  HERO_EYEBROW, LANDING_TITLE, LANDING_SUB, LANDING_CHECKS, LANDING_CTA_VOUCH, DEV_HEADING,
  peopleHereLead, invitationLine,
} from '@/lib/people-copy'
import { ExampleAgentCard, type ExampleAgent } from './ExampleAgentCard'
import { Explainer } from '@/components/shared/Explainer'
import { setHeroAgent } from './hero-agent'
import { AccentWord } from '@/components/shared/AccentWord'

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
      if (!top || !first) { setExample({ status: 'error' }); setHeroAgent(null); return }
      const id = first.agent.term_id
      const name = cleanAtomName(effectiveLabel(first.agent))
      // The "For developers" block asks the API about this same agent (components/landing/ForDevelopers).
      setHeroAgent({ termId: id, name })
      const attesters = summarizeAttesters(top.attestations?.get(id) ?? [])
      setExample({
        status: 'ok',
        termId: id,
        name,
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
  const here = peopleHereLead(people.value)
  const invitation = invitationLine(people.value)

  return (
    <section className="relative overflow-hidden lg:min-h-[759px] lg:flex lg:flex-col lg:justify-center">
      {/* Gradient overlays on top of the fixed page background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/70 via-transparent to-[rgb(10,10,15)]/80" />
      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.7)]" />

      {/* pt clears the fixed header (64px): lg:pt-24 = lg:pb-8 + 64, so the content centres in what shows */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 lg:pt-24 lg:pb-8 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-x-12 gap-y-5 lg:items-start text-left">
        <div>
          {/* 1 — what this is */}
          <div data-story="1">
            <p className="eyebrow eyebrow-slash text-accent">{HERO_EYEBROW}</p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 text-[2.75rem] sm:text-6xl lg:text-7xl font-extrabold tracking-display leading-display text-white"
            >
              <span className="block">{LANDING_TITLE[0]}</span>
              {/* The headline's one accent word: the italic accent face and its swash */}
              <AccentWord>{LANDING_TITLE[1]}</AccentWord>
            </motion.h1>
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              {LANDING_SUB} <Explainer term="vouch" className="-mt-0.5" />{' '}
              {/* 2 — the one number, in the sentence that follows (never hard-coded: /api/v1/stats) */}
              <span data-story="2">
                <span data-testid="people-vouching" data-state={statsState.status}>
                  <span className="text-accent font-semibold tabular-nums" title={people.unavailable ?? undefined}>{here.lead}</span>{' '}
                  {here.rest}
                </span>
                {invitation && <>{' '}<span className="text-accent font-medium" data-testid="invitation">{invitation}</span></>}
              </span>
            </p>
          </div>

          {/* 3 — two ways in */}
          <div data-story="3" className="mt-6 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <Link href="/agents" className="btn-primary group w-full sm:w-auto">
              {LANDING_CTA_VOUCH}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/docs" className="btn-secondary w-full sm:w-auto">
              <Code2 className="w-4 h-4" />
              {DEV_HEADING}
            </Link>
          </div>

          {/* 4 — the check row */}
          <ul data-story="4" className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] leading-4 tracking-wide text-[#B5BDC6]" data-testid="hero-checks">
            {LANDING_CHECKS.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5">
                <Check aria-hidden className="w-3.5 h-3.5 text-accent" strokeWidth={3} />
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* 5 — a live example: the most vouched agent right now, with its seals. On desktop its top
            meets the headline's: lg:pt-7 = the eyebrow's line (1rem) + the headline's mt-3. */}
        <div data-story="5" className="lg:pt-7">
          <ExampleAgentCard agent={example} />
        </div>
      </div>
    </section>
  )
}
