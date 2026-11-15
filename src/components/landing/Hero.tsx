/**
 * The landing's first screen (Etap 8b): the headline with its one accent block, one line on what
 * this is for, and two ways in — check an agent (primary), or read how it works. On a phone the
 * headline and the Check an agent button are on the first screen (the harness checks it).
 *
 * The page background (app/layout.tsx: a fixed image with its horizon glow) shows through the
 * section's two overlays, as before. A server component: no JavaScript, no data — the live story
 * starts in section 02.
 */

import Link from 'next/link'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { STORY_HEADLINE, STORY_SUB, STORY_HOW_LINK, LANDING_CTA_CHECK, LIVE_ON_TESTNET } from '@/lib/people-copy'
import { AccentBlock, DISPLAY, StoryEyebrow } from './story-parts'

export function Hero() {
  return (
    <section data-section="hero" className="relative overflow-hidden lg:min-h-[680px] lg:flex lg:flex-col lg:justify-center">
      {/* Overlays on the fixed page background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/70 via-transparent to-[rgb(10,10,15)]/80" />
      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.7)]" />

      {/* pt clears the fixed header (64px) */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-14 lg:pt-28 lg:pb-16">
        <StoryEyebrow>{LIVE_ON_TESTNET}</StoryEyebrow>
        <h1 className={`mt-5 text-[2.6rem] sm:text-7xl lg:text-[6.25rem] max-w-5xl ${DISPLAY}`} data-testid="story-headline">
          {STORY_HEADLINE.before} <AccentBlock>{STORY_HEADLINE.accent}</AccentBlock>{STORY_HEADLINE.after}
        </h1>
        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl leading-relaxed">{STORY_SUB}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/check" className="btn-primary group w-full sm:w-auto" data-testid="story-check">
            {LANDING_CTA_CHECK}
            <ArrowRight aria-hidden className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a href="#how-it-works" className="btn-secondary w-full sm:w-auto">
            {STORY_HOW_LINK}
            <ArrowDown aria-hidden className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
