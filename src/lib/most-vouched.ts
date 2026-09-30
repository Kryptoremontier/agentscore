/**
 * The /agents list's first rows in its default order ("Most vouched"), from one answer of our own
 * page API (/api/v1/agents/page) — for the landing: its example card (the first row) and the
 * registry carousel (the first 8). One derivation: the list's rows (both corpora), its row entries
 * (lib/agent-list.ts listEntryOf) and its order (orderAgents, DEFAULT_SORT).
 */

import { cardAttestationView, corpusTotals, listEntryOf, orderAgents, type AgentListAtom, type CardAttestationView } from './agent-list'
import { DEFAULT_SORT } from './agent-list-sort'
import type { AgentsPageView } from './agents-page-types'
import type { AttestedEntry } from './attestation-reader'

export type MostVouchedRow = Pick<AgentListAtom, 'term_id' | 'label' | 'created_at' | 'positions_aggregate' | '__opposeWei'> & {
  data?: string | null
  liveStakerCount?: number | null
  origin: 'agentscore' | 'erc8004'
}

export interface MostVouched {
  /** The list's first `n` rows, most vouched first, each with its stake reading and vouch count. */
  entries: Array<ReturnType<typeof listEntryOf<MostVouchedRow>> & { vouch: { people: number; stakeWei: bigint } | null }>
  /** Who vouches, per agent (null = the attestation read failed: no claim either way). */
  views: ReadonlyMap<string, CardAttestationView> | null
  /** The raw attestation rows, per agent — who vouches (wallets), for the example card. */
  attestations: ReadonlyMap<string, AttestedEntry[]> | null
  /** The list's "All" total (both corpora), as the /agents header prints it; null = unknown. */
  total: number | null
}

export function mostVouched(view: AgentsPageView, n: number): MostVouched {
  const rows: MostVouchedRow[] = [
    ...(view.agentScore.status === 'ok' ? view.agentScore.rows.map((r) => ({ ...r, origin: 'agentscore' as const })) : []),
    ...(view.cohort.status === 'ok'
      ? view.cohort.agents.map((c): MostVouchedRow => ({ term_id: c.termId, label: c.label, created_at: c.createdAt, origin: 'erc8004' }))
      : []),
  ]
  const views = view.attestations
    ? new Map([...view.attestations].map(([id, e]) => [id, cardAttestationView(e)] as const))
    : null
  const total = corpusTotals({
    agentScore: view.agentScore.status === 'ok'
      ? { status: 'ok', kept: view.agentScore.rows.length, junk: view.agentScore.junk, fetched: view.agentScore.fetched, total: view.agentScore.total, truncated: view.agentScore.truncated }
      : { status: 'error', kept: 0, junk: 0, fetched: 0, total: null, truncated: null },
    cohort: view.cohort.status === 'ok'
      ? { status: 'ok', count: view.cohort.agents.length, total: view.cohort.total, truncated: view.cohort.truncated }
      : { status: 'error', count: 0, total: null, truncated: null },
  }).all
  return {
    entries: orderAgents(rows.map(listEntryOf), views, DEFAULT_SORT).slice(0, n),
    views,
    attestations: view.attestations,
    total,
  }
}
