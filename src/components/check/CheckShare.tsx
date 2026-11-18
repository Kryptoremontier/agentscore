/**
 * Under a /check card (Etap 7 Run B): the card's permalink and "Share on X" with the post prefilled —
 * "{name}: {N} people vouch on AgentScore. Who vouches for your agent?" + the link, whose Open Graph
 * image is the same card (app/check/[id]/og). No number to share when who vouches
 * couldn't be read: then only the link. Etap 9: while nobody trusts the agent, the post is the
 * builder's ("I listed {name} on AgentScore. Used it? Trust it for {context}: {link}") and its
 * button sits in the builder's door under the card (BuilderDoor), next to the context picker.
 */

import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import { CHECK_PERMALINK, CHECK_SHARE, checkShareText, builderShareLead } from '@/lib/people-copy'
import type { TrustContext } from '@/lib/trust-contexts'

export function checkPermalink(id: string): string {
  return `/check/${id}`
}

/** /check in builder mode (Etap 9): the landing's second door; a found agent opens on its builder block. */
export const BUILDER_DOOR_HREF = '/check?builder=1'
export const BUILDER_ANCHOR = 'builder'

/** The builder's trust link (Etap 9): the card, with the trust dialog's context preselected. */
export function trustLink(id: string, context: Pick<TrustContext, 'slug'> | null): string {
  return context ? `${checkPermalink(id)}?for=${context.slug}` : checkPermalink(id)
}

/**
 * Nobody trusts it yet and a trust context is chosen → the builder's post ("I listed {name} …
 * Trust it for {context}:" + the trust link). Otherwise Etap 7's post + the card's permalink.
 */
export function shareOnXUrl(name: string, people: number, id: string, context: Pick<TrustContext, 'slug' | 'label'> | null = null): string {
  const q = people === 0 && context
    ? new URLSearchParams({ text: builderShareLead(name, context.label), url: `${SITE_URL}${trustLink(id, context)}` })
    : new URLSearchParams({ text: checkShareText(name, people), url: `${SITE_URL}${checkPermalink(id)}` })
  return `https://x.com/intent/post?${q}`
}

export function CheckShare({ id, name, people }: { id: string; name: string; people: number | null }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3" data-testid="check-share">
      <Link href={checkPermalink(id)} className="text-xs text-[#7A838D] hover:text-white underline underline-offset-2">
        {CHECK_PERMALINK}
      </Link>
      {people !== null && people > 0 && (
        <a
          href={shareOnXUrl(name, people, id)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary h-10 px-4 text-sm"
          data-testid="share-x"
        >
          {CHECK_SHARE}
        </a>
      )}
    </div>
  )
}
