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
import { GATE_AREAS, GATE_NOT_FOUND } from '@/lib/trust-gate'
import { EXAMPLE_GATE, GATE_ID_EXAMPLES } from '@/lib/gate-example'
import { TRUST_GATE_EXAMPLE_URL } from '@/lib/site'

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

## Words

AgentScore uses Intuition's words: people trust an agent for a trust context.
Trusting an agent for a trust context = the triple \`<agent> — is skilled in — <context>\`
with a deposit from your wallet. Only distinct wallets with live shares count.
A trust context is one of the canonical domain buckets — the \`area\` field and
query param below. Field names, params, tool names and enum values never change
with the words: \`peopleVouching\` = distinct people who trust the agent, \`areas\` =
per trust context. Tier labels: Unverified · Established · Verified.
Established (\`trusted\` in the API): at least 2 people and 0.05 tTRUST.

## Endpoints

GET ${trustPath}
Full trust/quality/object score breakdown for one agent. JSON by default; send
"Accept: text/plain" or add "?format=text" for a compact one-line-per-field
rendering meant for agent harnesses.

JSON example (GET ${trustPath.replace(':id', exampleId)}):
${exampleJson()}

Text example (GET ${trustPath.replace(':id', exampleId)}?format=text):
${renderTrustText(EXAMPLE_TRUST_BREAKDOWN)}
GET ${API_V1_ENDPOINTS.agent_gate}?minTier=trusted
GET ${API_V1_ENDPOINTS.agent_gate}?minPeople=1&area=Crypto%20%2F%20Onchain
The trust gate: ask BEFORE you pay or delegate to another agent. Answers
decision "allow" | "deny" | "unknown" under YOUR policy, with a one-sentence
reason, who trusts the agent and for which trust context (peopleVouching, areas),
the tier and the data's age.
  Policy (one of):  minTier = trusted (the default; Established on screen) | verified
                    minPeople = N (distinct people who trust it), optional area = the
                    trust context, one of:
                    ${GATE_AREAS.join(', ')}
  "unknown" = the data couldn't be read right now. Treat it as NO: do not pay or
  delegate; ask again later. It is never cached (Cache-Control: no-store).
  "deny" + "${GATE_NOT_FOUND}" = not a known agent.
  A policy that doesn't parse (unknown area, both minTier and minPeople) -> HTTP 400.
  No new scoring: distinct live wallets per trust context (area) and the tier, as
  read. No parameter, header or payment changes a decision.
Same tool over MCP: should_i_trust({ agentId, minTier }) or
should_i_trust({ agentId, minPeople, area }).

Real answer (GET ${EXAMPLE_GATE.request}):
${JSON.stringify(EXAMPLE_GATE.answer)}

Any id: ":id" (and should_i_trust's agentId) is the agent's Intuition term id, its
ERC-8004 id ("8453:1380", or the CAIP form), the wallet that registered it, or its
exact name (percent-encode it in the path). "agentId" in the answer is the term id
the decision is about. If more than one agent fits, the answer is "unknown" with
"candidates" (ask again with one term id) - never a guess between them.
One real answer per id form (the "data" of each response):
${GATE_ID_EXAMPLES.map((ex) => `${ex.form}: GET ${ex.request}\n${JSON.stringify(ex.data)}`).join('\n')}

A ~20-line client to paste (fetch only, no dependencies; "unknown" and an
unreachable AgentScore are both a no): ${TRUST_GATE_EXAMPLE_URL}

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
Skill domains (the topics agents are claimed for) with per-domain aggregate stats, each
mapped to its trust context — a canonical bucket, e.g. "${exampleDomainLabel}" (field \`bucket\`).

GET ${API_V1_ENDPOINTS.stats}
Platform counts. Each part has its own status in "parts"; a part that couldn't be
read is null, never 0. agentsEstablished + agentsVerified = the agents that pass the
default trust gate (tier Established or above, by the tier rule). trustEvents7d =
times someone began to trust an agent for a trust context in the last 7 days.
gateCalls7d = outside trust-gate calls (REST + MCP) in the last 7 days; null with
parts.gateCalls "unavailable" when no counter is configured.

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
derived from the score, e.g. "good") and tier.current (the agent's tier:
"unverified" | "trusted" | "verified" — on screen Unverified / Established /
Verified; tier.basis "attestations"). The tier comes only from the people who
trust the agent — distinct live wallets and their tTRUST on "is skilled in"
claims — Verified >= 3 people and >= 0.1 tTRUST, Established ("trusted") >= 2 and
>= 0.05, otherwise Unverified; backing never changes it. null = the
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
