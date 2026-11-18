'use client'

/**
 * The builder's door (Etap 9) — under a /check card: "Built this agent? Get its trust link". One
 * link, `/check/<id>?for=<context-slug>`: it opens this card and the trust dialog starts on that
 * trust context (the person can still change it). The context starts as the agent's best match
 * (lib/check-agent.ts bestContextFor — null = none known, the person picks; never a guess).
 *
 * Anyone can copy the link: nothing here says who built or owns the agent.
 */

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { SITE_URL } from '@/lib/site'
import { TRUST_CONTEXTS, contextBySlug } from '@/lib/trust-contexts'
import {
  BUILDER_HEADING, BUILDER_CONTEXT_LABEL, BUILDER_PICK_CONTEXT, BUILDER_COPY, BUILDER_COPIED, BUILDER_SEND, BUILDER_SEND_NOTE,
  BUILDER_COPY_MESSAGE, builderShareText, CHECK_SHARE,
} from '@/lib/people-copy'
import { shareOnXUrl, trustLink } from './CheckShare'

export function BuilderDoor({ id, name, people, initialSlug }: {
  id: string
  name: string
  /** Distinct people who trust it now; null = that read failed (then no post text — only the link). */
  people: number | null
  /** The best-matching trust context's slug; null = none known. */
  initialSlug: string | null
}) {
  const [slug, setSlug] = useState(initialSlug ?? '')
  const [copied, setCopied] = useState<'link' | 'message' | null>(null)
  const context = contextBySlug(slug)
  const link = context ? `${SITE_URL}${trustLink(id, context)}` : null

  useEffect(() => {
    if (!copied) return
    let cancelled = false
    const t = setTimeout(() => { if (!cancelled) setCopied(null) }, 2000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [copied])

  async function copy(what: 'link' | 'message', text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      // No clipboard (an insecure context, a denied permission): the link stays selectable in the field.
    }
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-[#111318]/85 p-4 sm:p-5"
      data-testid="builder-door"
      data-context={context?.slug ?? ''}
      aria-labelledby="builder-door-heading"
    >
      <h2 id="builder-door-heading" className="text-base sm:text-lg font-semibold text-white">{BUILDER_HEADING}</h2>

      <label className="mt-4 block text-xs text-[#7A838D]" htmlFor="builder-context">{BUILDER_CONTEXT_LABEL}</label>
      <select
        id="builder-context"
        value={slug}
        onChange={(e) => { setSlug(e.target.value); setCopied(null) }}
        className="mt-1.5 w-full h-11 rounded-lg border border-white/10 bg-[#12151A] px-3 text-sm text-white outline-none focus:border-accent/60"
        data-testid="builder-context"
      >
        {!context && <option value="">{BUILDER_PICK_CONTEXT}</option>}
        {TRUST_CONTEXTS.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>

      {link && (
        <>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={BUILDER_COPY}
              className="min-w-0 flex-1 h-11 rounded-lg border border-white/10 bg-[#12151A] px-3 font-mono text-xs text-[#B5BDC6] outline-none"
              data-testid="builder-link"
            />
            <button type="button" onClick={() => copy('link', link)} className="btn-primary h-11 px-4 text-sm whitespace-nowrap" data-testid="builder-copy">
              {copied === 'link' ? <Check aria-hidden className="w-4 h-4" /> : <Copy aria-hidden className="w-4 h-4" />}
              {copied === 'link' ? BUILDER_COPIED : BUILDER_COPY}
            </button>
          </div>
          {people === 0 && context && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy('message', builderShareText(name, context.label, link))}
                className="btn-secondary h-10 px-4 text-sm"
                data-testid="builder-copy-message"
              >
                {copied === 'message' ? BUILDER_COPIED : BUILDER_COPY_MESSAGE}
              </button>
              <a
                href={shareOnXUrl(name, 0, id, context)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary h-10 px-4 text-sm"
                data-testid="builder-share-x"
              >
                {CHECK_SHARE}
              </a>
            </div>
          )}
        </>
      )}

      <p className="mt-4 text-sm text-white" data-testid="builder-send">{BUILDER_SEND}</p>
      <p className="mt-1 text-xs text-[#7A838D]">{BUILDER_SEND_NOTE}</p>
    </section>
  )
}
