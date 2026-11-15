/**
 * One trust context's ranked list (Etap 8b Run B) — /domains?context=<slug>. A header with the
 * eyebrow, the big headline and "N agents · M people" with its age; then every agent people trust
 * for this context, distinct people first, then the existing chain (lib/landing-story.ts
 * compareRanked). Nobody yet → says so and invites, never an empty list without words. A failed read
 * → says so (the caller passes `failed`).
 */

import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  CONTEXT_EYEBROW, contextHeadline, contextStats, CONTEXT_ALL, CONTEXT_RANK_NOTE, CONTEXT_EMPTY, CONTEXTS_UNREAD, peopleVouch,
} from '@/lib/people-copy'
import type { ContextSummary } from '@/lib/landing-story'
import type { TrustContext } from '@/lib/trust-contexts'
import { formatTTrust } from '@/lib/format'
import { AccentBlock, DISPLAY, GLASS, StoryEyebrow } from '@/components/landing/story-parts'
import { DataAge } from '@/components/shared/DataAge'
import { ContextIcon } from './ContextIcon'
import { InitialsTile } from './InitialsTile'

export function ContextRanking({ context, summary, readAt }: {
  context: TrustContext
  /** null = the read failed. */
  summary: ContextSummary | null
  readAt: string | null
}) {
  return (
    <section data-section="context-ranking" data-context={context.slug} className="max-w-4xl">
      <Link href="/domains" className="inline-flex items-center gap-1.5 text-sm text-[#B5BDC6] hover:text-white">
        <ArrowLeft aria-hidden className="w-4 h-4" />
        {CONTEXT_ALL}
      </Link>
      <div className="mt-8">
        <StoryEyebrow>
          <ContextIcon label={context.label} className="w-3.5 h-3.5 text-accent" /> {CONTEXT_EYEBROW}
        </StoryEyebrow>
        <h1 className={`mt-4 text-4xl sm:text-6xl ${DISPLAY}`} data-testid="context-headline">
          {contextHeadline.before} <AccentBlock>{context.label}</AccentBlock>{contextHeadline.after}
        </h1>
        {summary && (
          <p className="mt-5 text-lg text-[#B5BDC6]" data-testid="context-stats">
            <span className="text-white font-semibold">{contextStats(summary.agents.length, summary.people)}</span>
            {readAt && <> · <DataAge readAt={readAt} className="text-sm text-[#7A838D]" /></>}
          </p>
        )}
      </div>

      <div className="mt-10" data-testid="context-ranking" data-state={summary ? (summary.agents.length ? 'ok' : 'empty') : 'failed'}>
        {!summary ? (
          <p className="text-[#B5BDC6]">{CONTEXTS_UNREAD}</p>
        ) : summary.agents.length === 0 ? (
          <div className={`${GLASS} p-6`}>
            <p className="text-[#B5BDC6]">
              {CONTEXT_EMPTY.line}{' '}
              <Link href="/agents" className="text-accent font-semibold hover:text-[#ffc35a]">{CONTEXT_EMPTY.cta}</Link>
            </p>
          </div>
        ) : (
          <>
            <ol className={`${GLASS} divide-y divide-white/[0.07]`}>
              {summary.agents.map((a, i) => (
                <li key={a.id}>
                  <Link href={`/agents?open=${a.id}`} className="group flex items-center gap-4 p-4 sm:p-5 hover:bg-white/[0.03] transition-colors" data-testid="context-agent">
                    <span className="font-mono text-sm text-accent tabular-nums w-6">{String(i + 1).padStart(2, '0')}</span>
                    <InitialsTile name={a.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white truncate">{a.name}</span>
                      <span className="block text-sm text-accent">{peopleVouch(a.people)}</span>
                    </span>
                    <span className="hidden sm:block text-sm text-[#7A838D] tabular-nums">{formatTTrust(a.stakeWei)}</span>
                    <ArrowRight aria-hidden className="w-4 h-4 text-[#7A838D] group-hover:text-white transition-colors" />
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-[#7A838D]">{CONTEXT_RANK_NOTE}</p>
          </>
        )}
      </div>
    </section>
  )
}
