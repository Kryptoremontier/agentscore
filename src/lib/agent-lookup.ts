/**
 * Found, not found, or couldn't read (Etap 9d, REPO_MAP §7 rule 5). "Not found" is said only when
 * the read succeeded and was complete, and holds no such agent; a read that failed, timed out or
 * stopped at a cap is "couldn't read". Used by the agent modal (`/agents?open=<id>`); /agents/[id]
 * and /check/[id] reach the same three states from their own reads.
 */

import type { AgentsPageView } from './agents-page-types'

export type AgentLookup = 'found' | 'not-found' | 'unread'

/** One id against the /agents list as read: both corpora, each read to the end, or we can't say. */
export function lookupInList(view: Pick<AgentsPageView, 'agentScore' | 'cohort'> | null, id: string): AgentLookup {
  if (!view) return 'unread'
  const a = view.agentScore
  const c = view.cohort
  if (a.status === 'ok' && a.rows.some((r) => r.term_id === id)) return 'found'
  if (c.status === 'ok' && c.agents.some((x) => x.termId === id)) return 'found'
  const complete = a.status === 'ok' && a.truncated === false && c.status === 'ok' && c.truncated === false
  return complete ? 'not-found' : 'unread'
}

/** An HTTP status from our own API, as one of the three: 404 is "not found", any other failure "couldn't read". */
export function lookupFromStatus(status: number): AgentLookup {
  if (status >= 200 && status < 300) return 'found'
  return status === 404 ? 'not-found' : 'unread'
}
