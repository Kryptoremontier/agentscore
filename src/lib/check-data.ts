/**
 * Server reads for "Check an agent" (Etap 7 Run B; the lookups are lib/check-agent.ts). Everything
 * comes from what the /agents page already reads through the shared complete-reads cache: its one
 * answer (getAgentsPageData — both corpora, attestations, each part's age) and, for an ERC-8004
 * id only, the cached cohort's identity links. A failed read is `unread`, never "not found".
 */

import { getAgentsPageData } from './agents-page-data'
import { agentsPageView, type AgentsPagePayload, type AgentsPageView } from './agents-page-types'
import { loadErc8004Cohort } from './api-data'
import { checkCardOf, parseCheckQuery, resolveCheckQuery, type CheckCard, type CheckResolution } from './check-agent'

async function snapshot(): Promise<{ payload: AgentsPagePayload; view: AgentsPageView } | null> {
  const payload = await getAgentsPageData().catch(() => null)
  if (!payload) return null
  const view = agentsPageView(payload)
  return view.unreachable ? null : { payload, view }
}

/** What the box resolves to, and the card when it names exactly one agent. */
export async function checkLookup(raw: string | null | undefined): Promise<{ resolution: CheckResolution; card: CheckCard | null }> {
  const q = parseCheckQuery(raw)
  if (q.kind === 'empty') return { resolution: { status: 'empty' }, card: null }
  const snap = await snapshot()
  if (!snap) return { resolution: { status: 'unread' }, card: null }
  const identities = q.kind === 'erc8004'
    ? await loadErc8004Cohort().then((c) => c.agents.map((a) => ({ termId: a.termId, caipIdentity: a.caipIdentity })), () => null)
    : null
  const resolution = resolveCheckQuery(q, snap.view, identities)
  return { resolution, card: resolution.status === 'found' ? checkCardOf(resolution.id, snap.payload, snap.view) : null }
}

/** The card for one agent id; `unread` when the list couldn't be read, `not-found` when it holds no such agent. */
export async function checkCard(id: string): Promise<CheckCard | 'unread' | 'not-found'> {
  const { resolution, card } = await checkLookup(id)
  if (card) return card
  return resolution.status === 'unread' ? 'unread' : 'not-found'
}
