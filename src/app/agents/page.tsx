import { Suspense } from 'react'
import { getAgentsPageData } from '@/lib/agents-page-data'
import { encodeForCache } from '@/lib/json-codec'
import { AgentsPageSkeleton } from '@/components/agents/AgentsPageSkeleton'
import { AgentsPageClient } from './agents-client'

/**
 * /agents (Etap 7a): the list arrives with the HTML. The server reads the same cached answer as
 * /api/v1/agents/page (lib/agents-page-data.ts — every part with its age, the last complete read
 * when the indexer is down, "failed" only when nothing can be shown) and hands it to the page,
 * which renders it at once and keeps everything interactive (tabs, sort, search, the modal, the
 * wallet). Before, the list was fetched only after ~500 kB of JS had loaded and run (mobile: the
 * first card at ~4 s with a warm cache).
 *
 * The read streams inside a Suspense boundary: with a warm cache it answers in milliseconds and the
 * first HTML holds the list; with no cached entry at all (a cold start) the page frame and its
 * skeleton go first and the list follows when the live read answers.
 */
export const dynamic = 'force-dynamic'

export default function AgentsPage() {
  return (
    <Suspense fallback={<AgentsPageSkeleton />}>
      <AgentsWithList />
    </Suspense>
  )
}

async function AgentsWithList() {
  // A failure here is the page's own "couldn't load" state (the client reads the API itself).
  const payload = await getAgentsPageData().catch(() => null)
  return (
    <AgentsPageClient
      initial={payload ? { payload: encodeForCache(payload), renderedAt: Date.now() } : null}
    />
  )
}
