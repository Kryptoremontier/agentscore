/**
 * Under a /check card (Etap 7 Run B): the card's permalink and "Share on X" with the post prefilled —
 * "{name}: {N} people vouch on AgentScore. Who vouches for your agent?" + the link, whose Open Graph
 * image is the same card (app/check/[id]/og). No number to share when who vouches
 * couldn't be read: then only the link.
 */

import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import { CHECK_PERMALINK, CHECK_SHARE, checkShareText } from '@/lib/people-copy'

export function checkPermalink(id: string): string {
  return `/check/${id}`
}

export function shareOnXUrl(name: string, people: number, id: string): string {
  const q = new URLSearchParams({ text: checkShareText(name, people), url: `${SITE_URL}${checkPermalink(id)}` })
  return `https://x.com/intent/post?${q}`
}

export function CheckShare({ id, name, people }: { id: string; name: string; people: number | null }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3" data-testid="check-share">
      <Link href={checkPermalink(id)} className="text-xs text-[#7A838D] hover:text-white underline underline-offset-2">
        {CHECK_PERMALINK}
      </Link>
      {people !== null && (
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
