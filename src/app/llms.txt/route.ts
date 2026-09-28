import { NextResponse } from 'next/server'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'
import {
  AGENT_SURFACE_VERSION,
  TRUST_DISCLAIMER,
  TRUST_ROUTE_CACHE,
  EXAMPLE_TRUST_BREAKDOWN,
  renderTrustText,
} from '@/lib/agent-surface'
import { CANONICAL_DOMAINS_REGISTRY } from '@/lib/canonical-domains'
import { SERVER_CACHE_TTL, TTL_JITTER } from '@/lib/server-cache'

function exampleJson(): string {
  return JSON.stringify({
    success: true,
    data: EXAMPLE_TRUST_BREAKDOWN,
    meta: {
      timestamp: '2026-08-31T17:53:59.564Z',
      network: 'testnet',
      version: AGENT_SURFACE_VERSION,
      disclaimer: TRUST_DISCLAIMER,
      dataAgeSeconds: 0,
      dataReadAt: '2026-08-31T17:53:59.563Z',
    },
  })
}

export async function GET() {
  const exampleId = EXAMPLE_TRUST_BREAKDOWN.agentId
  const trustPath = API_V1_ENDPOINTS.agent_trust
  const exampleDomainLabel = CANONICAL_DOMAINS_REGISTRY[0].label

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

GET ${API_V1_ENDPOINTS.agent_timeline}
Real dated on-chain events for one agent (stakes, skill/domain attestation
claims) plus the current score. Agents emit no staker-count "tier upgrade"
events: an agent's tier comes only from attestations. Historical score snapshots are
not persisted: scoreHistory carries only the current score and
meta.history is "not_recorded" — there is no historical score curve.

GET ${API_V1_ENDPOINTS.leaderboard}
Ranked agents across the platform, sorted by score.

GET ${API_V1_ENDPOINTS.domains}
Canonical domain buckets (e.g. "${exampleDomainLabel}") with per-domain aggregate stats.

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

Note: the response carries two distinct tier concepts — score.tier (the band
derived from the score, e.g. "good") and tier.current (the agent's attestation
tier: "unverified" | "trusted" | "verified", tier.basis "attestations"). The
attestation tier comes only from distinct live attesters and tTRUST attested on
"is skilled in" claims — Verified >= 3 attesters and >= 0.1 tTRUST, Trusted >= 2
and >= 0.05, otherwise Unverified; backing never changes it. null = the
attestation read failed (unknown). Consumers ranking agents should use the
score fields; tier.requirements shows what the next rung needs, not a ranking
signal.

## Limits & caching

Every REST answer's meta (and every MCP tool's JSON answer) says how old its data is:
  meta.dataAgeSeconds  whole seconds since the oldest indexer read behind the answer,
                       when the answer was built. 0 = read live.
  meta.dataReadAt      ISO-8601 time of that read (absolute: a CDN hop can't hide it —
                       a CDN adds its own "Age" header on top of dataAgeSeconds).
Reads are shared through a server cache: the agent list/corpus (also behind the agent
detail and trust breakdown) ${SERVER_CACHE_TTL.agentCorpus} s, domains and skills ${SERVER_CACHE_TTL.domains} s, per-agent skill triples,
timeline and a subject's attestations ${SERVER_CACHE_TTL.agentDetail} s, the ERC-8004 cohort behind the ERC-8004 agent detail
${SERVER_CACHE_TTL.erc8004Cohort} s, platform-stats counts ${SERVER_CACHE_TTL.platformStats} s, the evaluator
leaderboard ${SERVER_CACHE_TTL.evaluatorLeaderboard} s — each cached entry ±${TTL_JITTER * 100}% (spread so
entries don't all refill at once); meta.dataAgeSeconds always gives the actual age.
Only complete reads are cached. An answer built on an incomplete read (a failed
sub-read reported as null, a row cap) is sent "Cache-Control: no-store" and is
never stored; the next request reads again. A connected wallet's own positions are
never cached.

${trustPath} is cached at the CDN with:
  Cache-Control: public, s-maxage=${TRUST_ROUTE_CACHE.sMaxAgeSeconds}, stale-while-revalidate=${TRUST_ROUTE_CACHE.staleWhileRevalidateSeconds}
(no-store when incomplete). Other GET routes: public, s-maxage=15, stale-while-revalidate=30.

Unknown agent id -> HTTP 404.
Upstream (Hasura indexer) failure -> HTTP 502 with a JSON body:
  { "error": "upstream", "retry_after_seconds": 10 }
Wait at least retry_after_seconds before retrying.

## Disclaimer

${TRUST_DISCLAIMER}

Identity proves WHO an agent is. AgentScore estimates behavioral reputation.
Neither proves the trustworthiness of an agent's future actions.

## Install as a skill

GET /skill.md — this manual's task-focused counterpart: a Claude/agent-framework
skill file (frontmatter + curl one-liner) for checking an agent's reputation
before trusting or transacting with it. Byte-identical to this repo's SKILL.md.

GET /.well-known/agent.json — service manifest (A2A-style auto-discovery):
name, endpoints, docs, and disclaimer as machine-readable JSON.

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
