/**
 * One agent's trust over time, read on the server (Etap 8b Run B) — for /check/[id]'s compact card.
 * The landing's reads (lib/trust-events.ts through the shared cache), ENS names resolved here so
 * the card needs no client request, and the read's age. A failed or slow read is `failed`.
 */

import { fetchAgentTrustEvents, fetchFirstTrust, type FirstTrust, type TrustEvent } from './trust-events'
import { readWithFreshness } from './server-cache'
import { resolvePersonNames } from './person-names-server'

export const TRUST_STORY_TIMEOUT_MS = 10_000

export type TrustStory =
  | { status: 'ok'; events: TrustEvent[]; first: FirstTrust | null; names: Record<string, string | null>; readAt: string }
  | { status: 'failed' }

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export async function getTrustStory(agentId: string, timeoutMs = TRUST_STORY_TIMEOUT_MS): Promise<TrustStory> {
  try {
    const { value: events, freshness } = await within(readWithFreshness(() => fetchAgentTrustEvents(agentId)), timeoutMs)
    // The first-trust mark and the names are extras: their failure marks nothing and keeps the hex.
    const [first, names] = await Promise.all([
      within(fetchFirstTrust(), timeoutMs).catch(() => null),
      within(resolvePersonNames(events.filter((e) => !e.ens).map((e) => e.wallet)), timeoutMs).catch(() => ({})),
    ])
    return { status: 'ok', events, first, names, readAt: freshness.dataReadAt }
  } catch (err) {
    console.warn('[trust-story] unread:', err instanceof Error ? err.message : err)
    return { status: 'failed' }
  }
}
