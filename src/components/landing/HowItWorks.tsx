/**
 * 01 / How it works (Etap 8b): three numbered steps in columns with thin dividers, one line each —
 * find an agent, trust it for a trust context, and agents ask the gate before they pay. A server
 * component; the anchor the hero's "How it works ↓" scrolls to.
 */

import { STORY_SECTIONS, STORY_STEPS } from '@/lib/people-copy'
import { Explainer } from '@/components/shared/Explainer'
import { StorySection } from './story-parts'

export function HowItWorks() {
  return (
    <StorySection id="how-it-works" section={STORY_SECTIONS.how} className="bg-[#0D0F11]/80">
      <ol className="grid md:grid-cols-3 border-y border-white/10 md:divide-x divide-y md:divide-y-0 divide-white/10" data-testid="story-steps">
        {STORY_STEPS.map((step) => (
          <li key={step.num} className="py-7 md:py-10 md:px-8 first:md:pl-0 last:md:pr-0">
            <p className="font-mono text-sm text-accent tabular-nums">{step.num}</p>
            <h3 className="mt-3 font-display font-black uppercase tracking-[-0.02em] text-2xl sm:text-3xl text-white">
              {step.title}
              {/* "Trust" is the landing's one new word: its "?" sits right after it (Etap 6 explainers). */}
              {step.num === '02' && <Explainer term="vouch" className="ml-2 align-middle" />}
            </h3>
            <p className="mt-3 text-[#B5BDC6] leading-relaxed">
              {step.line}
              {'code' in step && (
                <>
                  {' '}<code className="font-mono text-[0.9em] text-accent bg-white/[0.06] px-1.5 py-0.5 rounded">{step.code}</code>{' '}{step.after}
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
    </StorySection>
  )
}
