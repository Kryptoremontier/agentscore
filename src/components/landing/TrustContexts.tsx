/**
 * 04 / Trust contexts (Etap 8b). Left: the agents people trust for the context with the most
 * distinct people (lib/landing-story.ts featuredContext), each with an initials tile and "N people
 * trust it". Right: the trust contexts, each linking to its ranked list (/domains?context=<slug>).
 * Etap 9, honest emptiness: the landing shows only the contexts someone trusts an agent for, and one
 * line for the rest — "N more trust contexts are open. Be the first." — linking to the full grid on
 * /domains, where all 8 are drawn and an empty one says so. A failed read says so instead of drawing
 * empty contexts.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  STORY_SECTIONS, CONTEXTS_HEADING, CONTEXTS_UNREAD, CONTEXTS_GRID_LABEL, CONTEXT_EMPTY, contextsFeatured, contextsOpenLine, peopleVouch, people as peopleCount, agentsCount,
} from '@/lib/people-copy'
import type { LandingData } from '@/lib/landing-data'
import { contextHref } from '@/lib/trust-contexts'
import { DataAge } from '@/components/shared/DataAge'
import { ContextIcon } from '@/components/trust/ContextIcon'
import { InitialsTile } from '@/components/trust/InitialsTile'
import { StorySection, GLASS } from './story-parts'

/** How many agents the featured list shows. */
export const FEATURED_MAX = 5

export function TrustContexts({ contexts }: { contexts: LandingData['contexts'] }) {
  return (
    <StorySection id="trust-contexts" section={STORY_SECTIONS.contexts} heading={CONTEXTS_HEADING}>
      <TrustContextsBody contexts={contexts} trustedOnly />
    </StorySection>
  )
}

/**
 * The featured ranked list and the context grid — the landing's §04 and the /domains overview (Run B).
 * `trustedOnly` (the landing, Etap 9): only the contexts someone trusts an agent for, then one line
 * for the rest, linking to the full grid on /domains. Without it: all 8, the empty ones saying so.
 */
export function TrustContextsBody({ contexts, trustedOnly = false }: { contexts: LandingData['contexts']; trustedOnly?: boolean }) {
  const all = contexts.status === 'ok' ? contexts.value.summaries : []
  const shown = trustedOnly ? all.filter((s) => s.people > 0) : all
  const open = all.length - shown.length
  return (
    <>
      {contexts.status !== 'ok' ? (
        <p className="text-[#B5BDC6]" data-testid="trust-contexts" data-state="failed">{CONTEXTS_UNREAD}</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12" data-testid="trust-contexts" data-state="ok">
          {/* The featured ranked list */}
          <div className={`${GLASS} p-5 sm:p-6 self-start`} data-testid="featured-context">
            {contexts.value.featured ? (
              <>
                <h3 className="font-display font-black uppercase tracking-[-0.02em] text-xl sm:text-2xl text-white">
                  {contextsFeatured(contexts.value.featured.context.label)}
                </h3>
                <ol className="mt-5 space-y-3">
                  {contexts.value.featured.agents.slice(0, FEATURED_MAX).map((a, i) => (
                    <li key={a.id}>
                      <Link href={`/agents?open=${a.id}`} className="group flex items-center gap-3 rounded-xl p-2 -m-2 hover:bg-white/[0.04] transition-colors" data-testid="featured-agent">
                        <span className="font-mono text-xs text-[#7A838D] tabular-nums w-5">{String(i + 1).padStart(2, '0')}</span>
                        <InitialsTile name={a.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-white truncate">{a.name}</span>
                          <span className="block text-sm text-accent">{peopleVouch(a.people)}</span>
                        </span>
                        <ArrowRight aria-hidden className="w-4 h-4 text-[#7A838D] group-hover:text-white transition-colors" />
                      </Link>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#7A838D]">
                  <Link href={contextHref(contexts.value.featured.context)} className="inline-flex items-center gap-1 text-accent hover:text-[#ffc35a]">
                    {contexts.value.featured.context.label}
                    <ArrowRight aria-hidden className="w-3.5 h-3.5" />
                  </Link>
                  <DataAge readAt={contexts.value.dataReadAt} />
                </div>
              </>
            ) : (
              <p className="text-[#B5BDC6]">
                {CONTEXT_EMPTY.line}{' '}
                <Link href="/agents" className="text-accent font-semibold hover:text-[#ffc35a]">{CONTEXT_EMPTY.cta}</Link>
              </p>
            )}
          </div>

          {/* The trust contexts: all 8, or (the landing) the ones someone trusts an agent for */}
          <nav aria-label={CONTEXTS_GRID_LABEL}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="context-grid" data-shown={shown.length} data-open={open}>
              {shown.map((s) => (
                <li key={s.context.slug}>
                  <Link
                    href={contextHref(s.context)}
                    className={`${GLASS} group flex items-center gap-3 p-4 h-full hover:border-accent/40 transition-colors`}
                    data-testid="context-tile"
                    data-context={s.context.slug}
                    data-people={s.people}
                  >
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] text-accent flex-shrink-0">
                      <ContextIcon label={s.context.label} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{s.context.label}</span>
                      {s.people > 0 ? (
                        <span className="block text-xs text-[#B5BDC6]">{peopleCount(s.people)} · {agentsCount(s.agents.length)}</span>
                      ) : (
                        <span className="block text-xs text-[#7A838D]">
                          {CONTEXT_EMPTY.line} <span className="text-accent font-semibold">{CONTEXT_EMPTY.cta}</span>
                        </span>
                      )}
                    </span>
                    <ArrowRight aria-hidden className="w-4 h-4 text-[#7A838D] group-hover:text-accent transition-colors flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
            {trustedOnly && open > 0 && (
              <p className={`${shown.length > 0 ? 'mt-4' : ''} text-sm text-[#B5BDC6]`} data-testid="contexts-open">
                <Link href="/domains" className="group inline-flex flex-wrap items-center gap-x-1.5 min-h-[44px] hover:text-white">
                  {contextsOpenLine(open, shown.length)} <span className="text-accent font-semibold">{CONTEXT_EMPTY.cta}</span>
                  <ArrowRight aria-hidden className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </p>
            )}
          </nav>
        </div>
      )}
    </>
  )
}
