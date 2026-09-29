/**
 * An agent's signals (deposit / redeem events on its atom vault and trust counter-vault) and its
 * trust triple — the /agents modal's chart, Activity and Timeline read these. One module for the
 * server (cached, lib/agents-page-data.ts) and the browser (right after the user's own trade).
 * A failed read throws: never an empty history standing in for "couldn't read" (REPO_MAP §7 rule 5).
 */

import { gqlRequest, type GqlRequest } from './gql-pager'
import { TRUST_PREDICATE_TERM_ID } from './gql-filters'

/** The newest signals the modal lists; the total count comes with them. */
export const AGENT_SIGNALS_LIMIT = 50

export interface AgentSignal {
  id: string
  delta: string
  account_id: string
  account?: { label: string | null } | null
  atom_id?: string | null
  triple_id?: string | null
  term_id: string
  created_at: string
  transaction_hash?: string | null
  deposit_id: string | null
  redemption_id: string | null
}

export interface AgentSignals {
  /** Newest first, at most AGENT_SIGNALS_LIMIT. */
  signals: AgentSignal[]
  /** Every signal on the vaults (the list above may be a prefix of it). */
  totalCount: number
}

export async function readAgentSignals(
  agentTermId: string,
  counterTermId: string | null | undefined,
  request: GqlRequest = gqlRequest,
): Promise<AgentSignals> {
  const termIds = counterTermId ? [agentTermId, counterTermId] : [agentTermId]
  const data = await request<{
    signals: AgentSignal[]
    signals_aggregate: { aggregate: { count: number } | null } | null
  }>(`
    query GetSignals($termIds: [String!]!) {
      signals(
        where: { term_id: { _in: $termIds } }
        order_by: { created_at: desc }
        limit: ${AGENT_SIGNALS_LIMIT}
      ) {
        id
        delta
        account_id
        account { label }
        atom_id
        triple_id
        term_id
        created_at
        transaction_hash
        deposit_id
        redemption_id
      }
      signals_aggregate(where: { term_id: { _in: $termIds } }) {
        aggregate { count }
      }
    }
  `, { termIds })
  const totalCount = data.signals_aggregate?.aggregate?.count
  if (!Array.isArray(data.signals) || typeof totalCount !== 'number') throw new Error('signals read incomplete')
  return { signals: data.signals, totalCount }
}

/**
 * The agent's trust triple ([agent] [is trustworthy] [AI Agent]): its own vault and its
 * counter-vault. null = the agent has none. A failed read throws — unlike intuition.ts
 * findTrustTriple (a write-flow helper), which answers null for a GraphQL error.
 */
export async function readTrustTriple(
  agentTermId: string,
  request: GqlRequest = gqlRequest,
): Promise<{ termId: string; counterTermId: string | null } | null> {
  const data = await request<{ triples: Array<{ term_id: string; counter_term_id: string | null }> }>(`
    query FindTrustTriple($subjectId: String!, $predicateId: String!) {
      triples(
        where: {
          subject_id: { _eq: $subjectId }
          predicate_id: { _eq: $predicateId }
        }
        limit: 1
      ) {
        term_id
        counter_term_id
      }
    }
  `, { subjectId: agentTermId, predicateId: TRUST_PREDICATE_TERM_ID })
  const t = data.triples?.[0]
  return t ? { termId: t.term_id, counterTermId: t.counter_term_id ?? null } : null
}
