/**
 * The /agents page's two reads of our own API (browser side): the list and one agent's modal
 * extras (app/api/v1/agents/page). null = our API couldn't be reached or answered an error —
 * the caller shows that as "failed", never as an empty list.
 */

import { decodeFromCache } from './json-codec'
import type { AgentModalPayload, AgentsPagePayload, ModalPart } from './agents-page-types'

async function readApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path)
    const json = await res.json()
    return json?.success ? decodeFromCache<T>(json.data) : null
  } catch {
    return null
  }
}

// Readers mounting together (the landing's example card and its carousel) share one request.
let pageInflight: Promise<AgentsPagePayload | null> | null = null

export function fetchAgentsPage(): Promise<AgentsPagePayload | null> {
  if (!pageInflight) {
    pageInflight = readApi<AgentsPagePayload>('/api/v1/agents/page').finally(() => { pageInflight = null })
  }
  return pageInflight
}

/** Every part, or only `parts` (e.g. MODAL_HEADER_PARTS — the header never waits on the slow ones). */
export function fetchAgentModalData(termId: string, parts?: readonly ModalPart[]): Promise<Partial<AgentModalPayload> | null> {
  return readApi<Partial<AgentModalPayload>>(`/api/v1/agents/page/${termId}${parts ? `?parts=${parts.join(',')}` : ''}`)
}
