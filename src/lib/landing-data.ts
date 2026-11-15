/**
 * The landing's server reads (Etap 8b). The page is rendered on the server and regenerated every
 * LANDING_REVALIDATE_SECONDS (app/page.tsx), so the story costs a visitor no JavaScript and no
 * request of its own. Every read goes through what /agents, /check and the REST/MCP gate already use
 * (shared complete-reads cache); each part says how old it is, and a part whose read failed is
 * `failed` — the section says so, never a placeholder.
 *
 * Parts:
 * - contexts: per trust context, the agents people trust for it (lib/landing-story.ts).
 * - story: one agent's trust over time — the most distinct people, ties to the oldest trust event —
 *   from the timeline reader's triples and their positions (lib/trust-events.ts).
 * - gate: a real should_i_trust answer for that agent (lib/api-data.ts trustGate — the REST and MCP
 *   gate's own function), JSON as the gate returns it, its meta.dataAgeSeconds included.
 */

import { getAgentsPageData } from './agents-page-data'
import { agentsPageView, type AgentsPagePayload, type AgentsPageView } from './agents-page-types'
import { checkCardOf, type CheckCard } from './check-agent'
import { agentsByPeople, contextSummaries, featuredContext, pickStoryAgent, topByPeople, type ContextSummary } from './landing-story'
import { fetchAgentTrustEvents, fetchFirstTrust, type FirstTrust, type TrustEvent } from './trust-events'
import { trustGate } from './api-data'
import { runWithReadLedger, readWithFreshness } from './server-cache'
import { resolvePersonNames } from './person-names-server'
import type { GateDecision, GatePolicy } from './trust-gate'

/** How often the landing is regenerated (ISR). Every part prints its own age on top of this. */
export const LANDING_REVALIDATE_SECONDS = 120

/** No part holds the page longer than this: a slow read becomes that section's honest error. */
export const LANDING_READ_TIMEOUT_MS = 20_000

export type Part<T> = { status: 'ok'; value: T } | { status: 'failed' }

export interface StoryCard {
  card: CheckCard
  /** Oldest first. */
  events: TrustEvent[]
  /** ENS names by lowercase wallet (null = none). */
  names: Record<string, string | null>
  /** The first trust in AgentScore's history, when the data shows one (null = none, or unread). */
  first: FirstTrust | null
  /** When the trust events were read (the timeline reader's age). */
  eventsReadAt: string
}

export interface GateExample {
  agentId: string
  agentName: string
  policy: GatePolicy
  answer: GateDecision
}

export interface LandingData {
  contexts: Part<{ summaries: ContextSummary[]; featured: ContextSummary | null; dataReadAt: string }>
  story: Part<StoryCard> | { status: 'none' }
  gate: Part<GateExample> | { status: 'none' }
}

function withTimeout<T>(p: Promise<T>, ms = LANDING_READ_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

async function attempt<T>(key: string, read: () => Promise<T>): Promise<Part<T>> {
  try {
    return { status: 'ok', value: await withTimeout(read()) }
  } catch (err) {
    console.warn(`[landing] ${key} unread:`, err instanceof Error ? err.message : err)
    return { status: 'failed' }
  }
}

/** The oldest part of the list behind the contexts (its age, as the list itself prints it). */
function listReadAt(payload: AgentsPagePayload): string | null {
  const parts = [payload.agentScore, payload.cohort, payload.cohortAttestations]
  const at = parts.filter((p) => p.status === 'ok').map((p) => (p as { dataReadAt: string }).dataReadAt).sort()[0]
  return at ?? null
}

/** The trust context a gate example names: the story agent's context with the most people, then the most tTRUST. */
export function gateContextFor(view: AgentsPageView, agentId: string): string | null {
  const entries = view.attestations?.get(agentId) ?? []
  const ranked = entries
    .map((e) => ({ label: e.domain.label, people: e.distinctAttesters, stake: e.totalStake }))
    .filter((e) => e.people > 0)
    .sort((a, b) => b.people - a.people || (a.stake === b.stake ? 0 : a.stake > b.stake ? -1 : 1))
  return ranked[0]?.label ?? null
}

function readList() {
  return attempt('agents-page', async () => {
    const payload = await getAgentsPageData()
    const view = agentsPageView(payload)
    if (view.unreachable) throw new Error('list unreachable')
    return { payload, view }
  })
}

/** The contexts part from one list read: null attestations → failed (unknown, never 8 empty contexts). */
function contextsPart(payload: AgentsPagePayload, view: AgentsPageView): LandingData['contexts'] {
  const summaries = contextSummaries(view)
  return summaries
    ? { status: 'ok', value: { summaries, featured: featuredContext(summaries), dataReadAt: listReadAt(payload) ?? new Date().toISOString() } }
    : { status: 'failed' }
}

/** The trust contexts alone — /domains and /domains?context=<slug> (Etap 8b Run B). */
export async function getTrustContexts(): Promise<LandingData['contexts']> {
  const list = await readList()
  return list.status === 'ok' ? contextsPart(list.value.payload, list.value.view) : { status: 'failed' }
}

export async function getLandingData(): Promise<LandingData> {
  const list = await readList()
  if (list.status !== 'ok') return { contexts: { status: 'failed' }, story: { status: 'failed' }, gate: { status: 'failed' } }
  const { payload, view } = list.value
  const contexts = contextsPart(payload, view)

  // The story agent: most people; a tie goes to the oldest first trust event.
  if (!view.attestations) return { contexts, story: { status: 'failed' }, gate: { status: 'failed' } }
  const candidates = topByPeople(agentsByPeople(view))
  if (candidates.length === 0) return { contexts, story: { status: 'none' }, gate: { status: 'none' } }
  const eventsById = new Map<string, Part<{ events: TrustEvent[]; readAt: string }>>()
  await Promise.all(candidates.map(async (c) => {
    eventsById.set(c.id, await attempt(`trust-events ${c.id}`, async () => {
      const { value, freshness } = await readWithFreshness(() => fetchAgentTrustEvents(c.id))
      return { events: value, readAt: freshness.dataReadAt }
    }))
  }))
  const firstAt = new Map(candidates.map((c) => {
    const p = eventsById.get(c.id)
    return [c.id, p?.status === 'ok' ? p.value.events[0]?.at ?? null : null] as const
  }))
  const chosen = pickStoryAgent(candidates, firstAt)!
  const card = checkCardOf(chosen.id, payload, view)
  const events = eventsById.get(chosen.id)

  const [first, names, gate] = await Promise.all([
    attempt('first-trust', () => fetchFirstTrust()),
    events?.status === 'ok'
      ? attempt('person-names', () => resolvePersonNames(events.value.events.filter((e) => !e.ens).map((e) => e.wallet)))
      : Promise.resolve({ status: 'failed' } as const),
    (async (): Promise<LandingData['gate']> => {
      const area = gateContextFor(view, chosen.id)
      const policy: GatePolicy = area ? { minPeople: 1, area } : { minPeople: 1 }
      const answer = await attempt('gate', () => runWithReadLedger(() => trustGate(chosen.id, policy)))
      if (answer.status !== 'ok') return { status: 'failed' }
      // An `unknown` answer is a failed read on the gate's side: shown as the error it is, never as an example.
      if (answer.value.decision === 'unknown') return { status: 'failed' }
      return { status: 'ok', value: { agentId: chosen.id, agentName: card?.name ?? chosen.name, policy, answer: answer.value } }
    })(),
  ])

  const story: LandingData['story'] = card && events?.status === 'ok'
    ? {
        status: 'ok',
        value: {
          card,
          events: events.value.events,
          names: names.status === 'ok' ? names.value : {},
          first: first.status === 'ok' ? first.value : null,
          eventsReadAt: events.value.readAt,
        },
      }
    : { status: 'failed' }
  return { contexts, story, gate }
}
