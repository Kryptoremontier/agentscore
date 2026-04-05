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

export async function fetchTimelineData(agentTermId: string): Promise<TimelineRawData | null> {
  if (!GRAPHQL_URL) return null

  try {
    // ── Step 1: Agent atom + find trust triple (counterTermId) ──────────────
    const atomRes = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
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
        variables: { termId: agentTermId },
      }),
    })
    const atomData = await atomRes.json()
    const atom = atomData?.data?.atom?.[0]
    if (!atom) return null

    const agentName = cleanAtomName(atom.label || '')
    const createdAt: string | undefined = atom.created_at ?? undefined
    const counterTermId: string | null = atom.as_subject_triples?.[0]?.counter_term_id ?? null

    // ── Step 2: Signals for support + oppose vaults ─────────────────────────
    const vaultIds = [agentTermId]
    if (counterTermId) vaultIds.push(counterTermId)

    const sigRes = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetAgentSignals($vaultIds: [String!]!) {
            signals(
              where: { term_id: { _in: $vaultIds } }
              order_by: { created_at: asc }
              limit: 200
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
        variables: { vaultIds },
      }),
    })
    const sigData = await sigRes.json()
    const rawSignals: Array<{
      id: string
      delta: string
      account_id: string
      term_id: string
      created_at: string
      deposit_id: string | null
      redemption_id: string | null
    }> = sigData?.data?.signals ?? []

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

    // ── Step 3: Skill triples with created_at ───────────────────────────────
    const tripleRes = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetAgentSkillTriples($agentId: String!) {
            triples(
              where: {
                subject_id: { _eq: $agentId }
                predicate: { label: { _in: ["hasAgentSkill", "has-agent-skill"] } }
              }
              limit: 50
            ) {
              term_id
              created_at
              object { term_id label }
            }
          }
        `,
        variables: { agentId: agentTermId },
      }),
    })
    const tripleData = await tripleRes.json()
    const rawTriples: Array<{
      term_id: string
      created_at: string
      object: { term_id: string; label: string }
    }> = tripleData?.data?.triples ?? []

    const skillEvents: SkillEvent[] = rawTriples.map(t => ({
      tripleId: t.term_id,
      skillId: t.object?.term_id ?? '',
      skillName: cleanAtomName(t.object?.label ?? 'Unknown'),
      timestamp: t.created_at ?? undefined,
    }))

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
    return null
  }
}
