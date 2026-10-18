import Link from 'next/link'
import type { Metadata } from 'next'
import { PageBackground } from '@/components/shared/PageBackground'
import { checkLookup } from '@/lib/check-data'
import type { CheckResolution } from '@/lib/check-agent'
import { redirect } from 'next/navigation'
import { CheckBox } from '@/components/check/CheckBox'
import { checkPermalink } from '@/components/check/CheckShare'
import {
  CHECK_TITLE, CHECK_SUB, CHECK_TRY,
  CHECK_PICK, checkPickMore, CHECK_NOT_FOUND, CHECK_WALLET_NOT_FOUND, CHECK_WALLET_PROFILE, CHECK_BROWSE,
  CHECK_UNREAD, ORIGIN_LABEL, NOBODY_VOUCHES, peopleVouch,
} from '@/lib/people-copy'

/**
 * /check — "Check an agent" (Etap 7 Run B): one box that takes an agent's name, its AgentScore id,
 * its ERC-8004 id (`8453:1380` or the CAIP form) or the wallet that registered it, and answers with
 * one card at its permalink, /check/[id] (lib/check-agent.ts, from the /agents answer in the shared
 * cache). A name that fits more than one agent is a short pick list, never a guess; nothing that
 * fits says so with a way on. A plain GET form: it works before any JS has loaded.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${CHECK_TITLE} · AgentScore`,
  description: CHECK_SUB,
}

const EXAMPLES = ['Luda', 'Captain Dackie', '8453:1380'] as const

export default async function CheckPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  // Looked up before the page renders (the /agents answer is a warm cached read — milliseconds), so
  // one agent is a real redirect to its card's permalink, the address a person shares.
  const lookup = q.trim() ? await checkLookup(q) : null
  if (lookup?.resolution.status === 'found') redirect(checkPermalink(lookup.resolution.id))
  return (
    <PageBackground image="wave" opacity={0.2}>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-28 lg:pb-16">
        <CheckBox q={q} />

        <div className="mt-8">
          {lookup ? (
            <CheckAnswer resolution={lookup.resolution} />
          ) : (
            <p className="text-sm text-[#7A838D]" data-testid="check-empty">
              {CHECK_TRY}:{' '}
              {EXAMPLES.map((e, i) => (
                <span key={e}>
                  {i > 0 && ' · '}
                  <Link href={`/check?q=${encodeURIComponent(e)}`} className="text-[#C8963C] hover:underline">{e}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
      </main>
    </PageBackground>
  )
}

function CheckAnswer({ resolution }: { resolution: CheckResolution }) {

  if (resolution.status === 'choose') {
    return (
      <div data-testid="check-picklist">
        <p className="text-white font-medium mb-3">{CHECK_PICK}</p>
        <ul className="space-y-2">
          {resolution.candidates.map((c) => (
            <li key={c.id}>
              <Link
                href={checkPermalink(c.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-accent/50"
              >
                <span className="min-w-0">
                  <span className="block text-white font-medium truncate">{c.name}</span>
                  {/* The short id tells two agents with one name apart. */}
                  <span className="block text-xs text-[#7A838D]">{ORIGIN_LABEL[c.origin]} · <span className="font-mono">{c.id.slice(0, 8)}…{c.id.slice(-4)}</span></span>
                </span>
                <span className="text-xs text-[#B5BDC6] flex-shrink-0">
                  {c.people === null ? '—' : c.people === 0 ? NOBODY_VOUCHES : peopleVouch(c.people)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {resolution.more > 0 && <p className="mt-3 text-xs text-[#7A838D]">{checkPickMore(resolution.more)}</p>}
      </div>
    )
  }

  if (resolution.status === 'not-found') {
    const wallet = resolution.query.kind === 'wallet' ? resolution.query.wallet : null
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" data-testid="check-notfound">
        <p className="text-white">{wallet ? CHECK_WALLET_NOT_FOUND : CHECK_NOT_FOUND}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {wallet && <Link href={`/profile/${wallet}`} className="text-[#C8963C] hover:underline">{CHECK_WALLET_PROFILE}</Link>}
          <Link href="/agents" className="text-[#C8963C] hover:underline">{CHECK_BROWSE}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" data-testid="check-unread">
      <p className="text-[#B5BDC6]">{CHECK_UNREAD}</p>
    </div>
  )
}
