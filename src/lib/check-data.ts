/**
 * Server reads for "Check an agent" (Etap 7 Run B; the lookups are lib/check-agent.ts). Everything
 * comes from what the /agents page already reads through the shared complete-reads cache: its one
 * answer (getAgentsPageData — both corpora, attestations, each part's age) and, for an ERC-8004
 * id only, the cached cohort's identity links. A failed read is `unread`, never "not found".
 */

import { getAgentsPageData } from './agents-page-data'
import { agentsPageView, type AgentsPagePayload, type AgentsPageView } from './agents-page-types'
import { loadErc8004Cohort } from './api-data'
import { bestContextFor, checkCardOf, parseCheckQuery, resolveCheckQuery, type CheckCard, type CheckResolution } from './check-agent'
import type { TrustContext } from './trust-contexts'

async function snapshot(): Promise<{ payload: AgentsPagePayload; view: AgentsPageView } | null> {
  const payload = await getAgentsPageData().catch(() => null)
  if (!payload) return null
  const view = agentsPageView(payload)
  return view.unreachable ? null : { payload, view }
}

type Snapshot = NonNullable<Awaited<ReturnType<typeof snapshot>>>

/** One resolver for /check, the badge and the trust gate: the snapshot, the ERC-8004 identity links when asked for, the lookup. */
async function resolve(raw: string | null | undefined, opts: { exactName?: boolean } = {}): Promise<{ resolution: CheckResolution; snap: Snapshot | null }> {
  const q = parseCheckQuery(raw)
  if (q.kind === 'empty') return { resolution: { status: 'empty' }, snap: null }
  const snap = await snapshot()
  if (!snap) return { resolution: { status: 'unread' }, snap: null }
  const identities = q.kind === 'erc8004'
    ? await loadErc8004Cohort().then((c) => c.agents.map((a) => ({ termId: a.termId, caipIdentity: a.caipIdentity })), () => null)
    : null
  return { resolution: resolveCheckQuery(q, snap.view, identities, opts), snap }
}

/** What the box resolves to, and the card when it names exactly one agent. */
export async function checkLookup(raw: string | null | undefined): Promise<{ resolution: CheckResolution; card: CheckCard | null }> {
  const { resolution, snap } = await resolve(raw)
  return { resolution, card: snap && resolution.status === 'found' ? checkCardOf(resolution.id, snap.payload, snap.view) : null }
}

/**
 * The trust gate's id (Etap 9): the same resolver, with names matched whole — an ERC-8004
 * `chain:id` or its CAIP form, the wallet that registered the agent, or an exact name. (A term id
 * never comes here: the gate reads it directly, as before.) A failed read is `unread`.
 */
export async function resolveGateId(raw: string): Promise<CheckResolution> {
  return (await resolve(raw, { exactName: true }).catch(() => ({ resolution: { status: 'unread' as const } }))).resolution
}

/** The card for one agent id; `unread` when the list couldn't be read, `not-found` when it holds no such agent. */
export async function checkCard(id: string): Promise<CheckCard | 'unread' | 'not-found'> {
  const { resolution, card } = await checkLookup(id)
  if (card) return card
  return resolution.status === 'unread' ? 'unread' : 'not-found'
}

/**
 * The trust context a builder's link starts with (Etap 9, check-agent.ts bestContextFor). An
 * ERC-8004 agent nobody trusts yet → its declared domains, from the cached cohort; that read
 * failing only means no suggestion (null — the person picks), never a guessed context.
 */
export async function builderContext(card: Pick<CheckCard, 'id' | 'origin' | 'attesters'>): Promise<TrustContext | null> {
  const fromPeople = bestContextFor(card.attesters, null)
  if (fromPeople || card.origin !== 'erc8004') return fromPeople
  const declared = await loadErc8004Cohort().then((c) => c.agents.find((a) => a.termId === card.id)?.declaredDomains ?? null, () => null)
  return bestContextFor(null, declared)
}
