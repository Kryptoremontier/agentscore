/**
 * The scored /agents/[id] profile's `Agent` from the REST detail (GET /api/v1/agents/:id).
 *
 * Only what the read has: the detail carries no owner or wallet — the atom's `creator` is the
 * FeeProxy, not whoever registered the agent (CLAUDE.md "GraphQL quirks") — so `walletAddress`
 * is null and there is no `owner`. The header then omits its Wallet row. It used to print
 * `0x0000…0000` (with a basescan link) as if it were the agent's wallet (Etap 4b-cache).
 */

import { parseAgentCard } from './agent-card'
import type { AgentDetailApiItem } from './api-data'
import type { Agent } from '@/types/agent'

// attestationCount/reportCount are overwritten from the canonical profile vector once it resolves.
export function apiToAgent(apiAgent: AgentDetailApiItem): Agent {
  const card = parseAgentCard(apiAgent.rawLabel)
  return {
    id: apiAgent.id,
    atomId: BigInt(apiAgent.id),
    name: apiAgent.name,
    description: card.description || '',
    platform: 'intuition',
    walletAddress: null,
    createdAt: new Date(apiAgent.createdAt),
    verificationLevel: 'wallet',
    trustScore: Math.round(apiAgent.score.objectScore ?? apiAgent.score.trustScore),
    positiveStake: BigInt(Math.round(apiAgent.supportStake * 1e18)),
    negativeStake: BigInt(Math.round(apiAgent.opposeStake * 1e18)),
    // Filled from the profile vector once it loads; "—" until then (never an unread 0).
    attestationCount: null,
    reportCount: null,
    stakerCount: apiAgent.stakerCount,
    scoreParts: {
      trustScore: apiAgent.score.trustScore,
      qualityScore: apiAgent.score.qualityScore,
      objectScore: apiAgent.score.objectScore,
      measured: apiAgent.scoreBasis === 'measured',
    },
  }
}
