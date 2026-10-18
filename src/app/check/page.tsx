import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PageBackground } from '@/components/shared/PageBackground'
import { CheckResultCard } from '@/components/check/CheckResultCard'
import { checkLookup } from '@/lib/check-data'
import { encodeForCache } from '@/lib/json-codec'
import {
  CHECK_TITLE, CHECK_EYEBROW, CHECK_SUB, CHECK_LABEL, CHECK_PLACEHOLDER, CHECK_BUTTON, CHECK_TRY,
  CHECK_PICK, checkPickMore, CHECK_NOT_FOUND, CHECK_WALLET_NOT_FOUND, CHECK_WALLET_PROFILE, CHECK_BROWSE,
  CHECK_UNREAD, ORIGIN_LABEL, NOBODY_VOUCHES, peopleVouch,
} from '@/lib/people-copy'

/**
 * /check — "Check an agent" (Etap 7 Run B): one box that takes an agent's name, its AgentScore id,
 * its ERC-8004 id (`8453:1380` or the CAIP form) or the wallet that registered it, and answers with
 * one card (lib/check-agent.ts, from the /agents answer in the shared cache). A name that fits more
 * than one agent is a short pick list, never a guess; nothing that fits says so with a way on. A
 * plain GET form: it works before any JS has loaded.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${CHECK_TITLE} · AgentScore`,
  description: CHECK_SUB,
}

const EXAMPLES = ['Luda', 'Captain Dackie', '8453:1380'] as const

export default function CheckPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  return (
    <PageBackground image="wave" opacity={0.2}>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-28 lg:pb-16">
        <p className="eyebrow eyebrow-slash text-accent">{CHECK_EYEBROW}</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-display leading-display text-white mt-2">{CHECK_TITLE}</h1>
        <p className="text-[#B5BDC6] mt-2">{CHECK_SUB}</p>

        <form action="/check" method="get" className="mt-6 flex flex-col sm:flex-row gap-2" role="search" data-testid="check-form">
          <label htmlFor="check-q" className="sr-only">{CHECK_LABEL}</label>
          <input
            id="check-q"
            name="q"
            defaultValue={q}
            placeholder={CHECK_PLACEHOLDER}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 h-12 rounded-sm border border-white/15 bg-[#0D0F13] px-4 text-white placeholder:text-[#5C6570] focus:outline-none focus:border-accent/70"
          />
          <button type="submit" className="btn-primary h-12 px-6">{CHECK_BUTTON}</button>
        </form>
        <p className="mt-2 text-xs text-[#7A838D]">{CHECK_LABEL}</p>

        <div className="mt-8">
          {q.trim() ? (
            <Suspense key={q} fallback={<AnswerSkeleton />}>
              <CheckAnswer q={q} />
            </Suspense>
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

/** The card's height while the answer is read (a warm cache answers in milliseconds). */
function AnswerSkeleton() {
  return <div aria-hidden className="h-[360px] rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
}

async function CheckAnswer({ q }: { q: string }) {
  const { resolution, card } = await checkLookup(q)

  if (resolution.status === 'found' && card) return <CheckResultCard encoded={encodeForCache(card)} />

  if (resolution.status === 'choose') {
    return (
      <div data-testid="check-picklist">
        <p className="text-white font-medium mb-3">{CHECK_PICK}</p>
        <ul className="space-y-2">
          {resolution.candidates.map((c) => (
            <li key={c.id}>
              <Link
                href={`/check?q=${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-accent/50"
              >
                <span className="min-w-0">
                  <span className="block text-white font-medium truncate">{c.name}</span>
                  <span className="block text-xs text-[#7A838D]">{ORIGIN_LABEL[c.origin]}</span>
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
