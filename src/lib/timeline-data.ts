/**
 * Timeline Data — server-side GraphQL fetcher for trust timeline reconstruction.
 *
 * Used by:
 *   - GET /api/v1/agents/:id/timeline
 *   - MCP tool: get_agent_timeline
 *
 * For the browser (agents/page.tsx), timeline data comes from agentSignals
 * and skillTriples already in state — no separate fetch needed.
 */

import { APP_CONFIG } from './app-config'
import { cleanAtomName } from '@/types/claim'
import { type StakingEvent, type SkillEvent } from './trust-timeline'
import { IS_SKILLED_IN } from './canonical-domains'
import { fetchAllRows, gqlRequest, SERVER_ROW_CAP } from './gql-pager'

// Our ceilings (reported by the pager, never a silent first N). The signals read kept only the
// OLDEST 200 events; the skill-triple reads the first 50 of each kind.
const TIMELINE_SIGNALS_MAX = 5_000
const TIMELINE_TRIPLES_MAX = 1_000

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineRawData {
  agentId: string
  agentName: string
  createdAt?: string
  counterTermId?: string | null
  stakingEvents: StakingEvent[]
  skillEvents: SkillEvent[]
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * null = no such atom (a 404). A failed read THROWS — the routes answer it as an
 * error, never as "Agent not found" or as an empty history (REPO_MAP §7 rule 5).
 */
export async function fetchTimelineData(agentTermId: string): Promise<TimelineRawData | null> {
  if (!GRAPHQL_URL) throw new Error('GraphQL endpoint not configured')

  try {
    // ── Step 1: Agent atom + find trust triple (counterTermId) ──────────────
    const atomData = await gqlRequest<{ atom: Array<{ term_id: string; label: string | null; created_at?: string; as_subject_triples?: Array<{ counter_term_id: string | null }> }> }>(
      `
        query GetAgentAtom($termId: String!) {
          atom: atoms(where: { term_id: { _eq: $termId } }, limit: 1) {
            term_id
            label
            created_at
            as_subject_triples(
              where: {
                predicate: { label: { _in: ["isTrustedFor", "is", "trustsAs"] } }
              }
              limit: 1
            ) {
              counter_term_id
            }
          }
        }
      `,
      { termId: agentTermId },
    )
    const atom = atomData.atom?.[0]
    if (!atom) return null

    const agentName = cleanAtomName(atom.label || '')
    const createdAt: string | undefined = atom.created_at ?? undefined
    const counterTermId: string | null = atom.as_subject_triples?.[0]?.counter_term_id ?? null

    // ── Step 2: Signals for support + oppose vaults ─────────────────────────
    const vaultIds = [agentTermId]
    if (counterTermId) vaultIds.push(counterTermId)

    const sigPage = await fetchAllRows<{
      id: string
      delta: string
      account_id: string
      term_id: string
      created_at: string
      deposit_id: string | null
      redemption_id: string | null
    }>({
      query: `
        query GetAgentSignals($vaultIds: [String!]!, $limit: Int!, $offset: Int!) {
          signals(
            where: { term_id: { _in: $vaultIds } }
            order_by: [{ created_at: asc }, { id: asc }]
            limit: $limit
            offset: $offset
          ) {
            id
            delta
            account_id
            term_id
            created_at
            deposit_id
            redemption_id
          }
        }
      `,
      field: 'signals',
      countQuery: `
        query GetAgentSignalsCount($vaultIds: [String!]!) {
          signals_aggregate(where: { term_id: { _in: $vaultIds } }) { aggregate { count } }
        }
      `,
      countField: 'signals_aggregate',
      variables: { vaultIds },
      pageSize: SERVER_ROW_CAP.signals,
      maxRows: TIMELINE_SIGNALS_MAX,
    })
    if (sigPage.truncated !== false) throw new Error('signals not read to the end')
    const rawSignals = sigPage.rows

    const stakingEvents: StakingEvent[] = rawSignals.map(s => {
      const deltaNum = Number(s.delta || 0)
      return {
        id: s.id,
        accountId: s.account_id,
        type: deltaNum >= 0 ? 'deposit' : 'redeem',
        side: (counterTermId && s.term_id === counterTermId) ? 'oppose' : 'support',
        deltaWei: Math.abs(deltaNum).toString(),
        timestamp: s.created_at,
      }
    })

    // ── Step 3: Skill/attestation triples with created_at ───────────────────
    // Legacy predicate (pre-canonical) and the canonical `is skilled in` +
    // stake unit (thesis §4) are queried separately and tagged, so the
    // timeline can label them as different claims — never conflated.
    type RawTriple = { term_id: string; created_at: string; object: { term_id: string; label: string } }
    const readTriples = async (name: string, where: string, variables: Record<string, unknown>, vars: string) => {
      const page = await fetchAllRows<RawTriple>({
        query: `
          query ${name}(${vars}, $limit: Int!, $offset: Int!) {
            triples(where: ${where}, order_by: { term_id: asc }, limit: $limit, offset: $offset) {
              term_id
              created_at
              object { term_id label }
            }
          }
        `,
        field: 'triples',
        countQuery: `query ${name}Count(${vars}) { triples_aggregate(where: ${where}) { aggregate { count } } }`,
        countField: 'triples_aggregate',
        variables,
        pageSize: SERVER_ROW_CAP.triples,
        maxRows: TIMELINE_TRIPLES_MAX,
      })
      if (page.truncated !== false) throw new Error(`${name} not read to the end`)
      return page.rows
    }
    const [rawLegacy, rawCanonical] = await Promise.all([
      readTriples(
        'GetAgentLegacySkillTriples',
        '{ subject_id: { _eq: $agentId }, predicate: { label: { _in: ["hasAgentSkill", "has-agent-skill"] } } }',
        { agentId: agentTermId },
        '$agentId: String!',
      ),
      readTriples(
        'GetAgentCanonicalSkillTriples',
        '{ subject_id: { _eq: $agentId }, predicate_id: { _eq: $canonicalPred } }',
        { agentId: agentTermId, canonicalPred: IS_SKILLED_IN.termId },
        '$agentId: String!, $canonicalPred: String!',
      ),
    ])

    const skillEvents: SkillEvent[] = [
      ...rawLegacy.map((t): SkillEvent => ({
        tripleId: t.term_id,
        skillId: t.object?.term_id ?? '',
        skillName: cleanAtomName(t.object?.label ?? 'Unknown'),
        timestamp: t.created_at ?? undefined,
      })),
      ...rawCanonical.map((t): SkillEvent => ({
        tripleId: t.term_id,
        skillId: t.object?.term_id ?? '',
        skillName: cleanAtomName(t.object?.label ?? 'Unknown'),
        timestamp: t.created_at ?? undefined,
        canonical: true,
      })),
    ]

    return {
      agentId: agentTermId,
      agentName,
      createdAt,
      counterTermId,
      stakingEvents,
      skillEvents,
    }
  } catch (err) {
    console.warn('[fetchTimelineData] Failed:', err)
    throw err
  }
}
