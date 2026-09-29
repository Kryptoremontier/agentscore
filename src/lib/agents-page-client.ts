/**
 * The /agents page's two reads of our own API (browser side): the list and one agent's modal
 * extras (app/api/v1/agents/page). null = our API couldn't be reached or answered an error —
 * the caller shows that as "failed", never as an empty list.
 */

import { decodeFromCache } from './json-codec'
import type { AgentModalPayload, AgentsPagePayload } from './agents-page-types'

async function readApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path)
    const json = await res.json()
    return json?.success ? decodeFromCache<T>(json.data) : null
  } catch {
    return null
  }
}

export function fetchAgentsPage(): Promise<AgentsPagePayload | null> {
  return readApi<AgentsPagePayload>('/api/v1/agents/page')
}

export function fetchAgentModalData(termId: string): Promise<AgentModalPayload | null> {
  return readApi<AgentModalPayload>(`/api/v1/agents/page/${termId}`)
}
