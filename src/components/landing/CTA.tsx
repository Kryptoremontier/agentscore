/**
 * The landing's closing block (Etap 8b): the big headline on the left with its one accent block,
 * a CTA card on the right — Check an agent (primary), Trust an agent (secondary), one line of
 * reassurance, and the status pill. No numbers here: the numbers are in the sections above, with
 * their age.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CLOSING_HEADLINE, CLOSING_REASSURE, CLOSING_PILL, LANDING_CTA_CHECK, LANDING_CTA_VOUCH } from '@/lib/people-copy'
import { AccentBlock, DISPLAY, GLASS } from './story-parts'

export function CTA() {
  return (
    <section data-section="closing" className="relative py-20 sm:py-28 overflow-hidden">
      {/* Semi-transparent overlay — the fixed background shows through */}
      <div className="absolute inset-0 bg-[rgb(10,10,15)]/70" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
        <h2 className={`text-4xl sm:text-6xl ${DISPLAY}`} data-testid="closing-headline">
          {CLOSING_HEADLINE.before} <AccentBlock>{CLOSING_HEADLINE.accent}</AccentBlock> {CLOSING_HEADLINE.after}
        </h2>
        <div className={`${GLASS} p-6 sm:p-8`} data-testid="closing-card">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-accent">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-accent" />
            {CLOSING_PILL}
          </span>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/check" className="btn-primary group w-full">
              {LANDING_CTA_CHECK}
              <ArrowRight aria-hidden className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/agents" className="btn-secondary w-full">{LANDING_CTA_VOUCH}</Link>
          </div>
          <p className="mt-4 text-sm text-[#7A838D] text-center">{CLOSING_REASSURE}</p>
        </div>
      </div>
    </section>
  )
}
