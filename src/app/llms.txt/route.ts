import { NextResponse } from 'next/server'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'
import {
  AGENT_SURFACE_VERSION,
  TRUST_DISCLAIMER,
  TRUST_ROUTE_CACHE,
  renderTrustText,
} from '@/lib/agent-surface'
import type { AgentTrustBreakdown } from '@/lib/api-data'

/**
 * A real trust breakdown captured from testnet (agent "INTU:Talaria",
 * term_id below) — kept as a fixed snapshot so the documented shape stays
 * stable. It is rendered through the same renderTrustText() the live
 * endpoint uses, so the text example below can never drift from what that
 * endpoint actually emits.
 */
const EXAMPLE_TRUST_BREAKDOWN: AgentTrustBreakdown = {
  agentId: '0xac7682d94109547c0c03e8f9f76d67f785fab307b6096910235cb75ddb424c6a',
  agentName: 'INTU:Talaria',
  score: {
    objectType: 'agent',
    trustScore: 70,
    qualityScore: 50,
    objectScore: 62,
    tier: 'good',
    softGateActive: false,
    computedAt: '2026-08-31T17:53:59.563Z',
  },
  agentScore: 62,
  trustScore: { raw: 100, confidence: 0.39, anchored: 69.7, momentum: 0 },
  compositeScore: { total: 50, signalRatio: 100, stakerDiversity: 0, stability: 0, priceRetention: 100 },
  softGate: { supportRatio: 100, scaleFactor: 1, applied: false },
  antiManipulation: { diversityWeightedRatio: 100, whaleDetected: true, largestStakerShare: 1, evaluatorWeightsApplied: false },
  tier: { current: 'unverified', nextTier: 'sandbox', requirements: { stakers: '1/3', stake: '0.0500/0.1 tTRUST', ratio: '100%/0%', age: '129/0 days' } },
}

function exampleJson(): string {
  return JSON.stringify({
    success: true,
    data: EXAMPLE_TRUST_BREAKDOWN,
    meta: {
      timestamp: '2026-08-31T17:53:59.564Z',
      network: 'testnet',
      version: AGENT_SURFACE_VERSION,
      disclaimer: TRUST_DISCLAIMER,
    },
  })
}

export async function GET() {
  const exampleId = EXAMPLE_TRUST_BREAKDOWN.agentId
  const trustPath = API_V1_ENDPOINTS.agent_trust

  const body = `# AgentScore

AgentScore is an on-chain reputation marketplace for AI agents, built on Intuition Protocol (Intuition Testnet). Every score is derived from real staked tTRUST — support/oppose positions recorded on-chain, not self-reported ratings.

## Endpoints

GET ${trustPath}
Full trust/quality/object score breakdown for one agent. JSON by default; send
"Accept: text/plain" or add "?format=text" for a compact one-line-per-field
rendering meant for agent harnesses.

JSON example (GET ${trustPath.replace(':id', exampleId)}):
${exampleJson()}

Text example (GET ${trustPath.replace(':id', exampleId)}?format=text):
${renderTrustText(EXAMPLE_TRUST_BREAKDOWN)}
GET ${API_V1_ENDPOINTS.agent_card}
A2A-compatible agent card: identity, capabilities, endpoints, and the same trust envelope.

GET ${API_V1_ENDPOINTS.leaderboard}
Ranked agents across the platform, sorted by score.

GET ${API_V1_ENDPOINTS.domains}
Canonical domain buckets (e.g. "Smart Contract Security") with per-domain aggregate stats.

GET ${API_V1_ENDPOINTS.api_index}
Index of every route in the Trust API, machine-readable.

## ScoreEnvelope fields

trustScore   number, 0-100. Economic confidence from the on-chain support/oppose
             stake ratio. Always present.
qualityScore number|null, 0-100. 4-pillar composite: signal ratio (40%),
             staker diversity (25%), stability (25%), price retention (10%).
             Null on list endpoints — signal history isn't fetched in bulk there.
objectScore  number|null, 0-100. The published AGENTSCORE:
             trustScore * 0.60 + qualityScore * 0.40. Null when qualityScore is null.
tier         string. Human-readable tier derived from objectScore, falling back
             to trustScore when objectScore is null.
computedAt   ISO-8601 string. When this envelope was computed.

Use score.objectScore ?? score.trustScore as the display/ranking value — it is
never null.

## Limits & caching

${trustPath} is cached with:
  Cache-Control: public, s-maxage=${TRUST_ROUTE_CACHE.sMaxAgeSeconds}, stale-while-revalidate=${TRUST_ROUTE_CACHE.staleWhileRevalidateSeconds}

Unknown agent id -> HTTP 404.
Upstream (Hasura indexer) failure -> HTTP 502 with a JSON body:
  { "error": "upstream", "retry_after_seconds": 10 }
Wait at least retry_after_seconds before retrying.

## Disclaimer

${TRUST_DISCLAIMER}

Identity proves WHO an agent is. AgentScore estimates behavioral reputation.
Neither proves the trustworthiness of an agent's future actions.

## Links

Web UI: https://agentscore-gilt.vercel.app
GitHub: https://github.com/Kryptoremontier/agentscore
`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
