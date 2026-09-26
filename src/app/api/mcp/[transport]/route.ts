import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'

import {
  getAgentsWithScores,
  getAgentDetail,
  getCohortAgentDetail,
  getAgentTrustBreakdown,
  getDomains,
  getDomainAgents,
  getEvaluatorLeaderboard,
  getEvaluatorProfile,
  trustQuery,
  getPlatformStats,
} from '@/lib/api-data'
import { fetchTimelineData } from '@/lib/timeline-data'
import { buildAgentTimeline } from '@/lib/trust-timeline'
import { publishedAgentScore } from '@/lib/score-basis'
import { comparedBySkill, comparedOverall, rankComparison } from '@/lib/agent-compare'
import {
  calculateProfileCompleteness,
  serializeAgentCard,
  type AgentCardData,
  type AgentCategory,
} from '@/lib/agent-card'

const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const handler = createMcpHandler(
  (server) => {

    // ═══════════════════════════════════════════
    // TOOL 1: search_agents
    // ═══════════════════════════════════════════
    server.registerTool(
      'search_agents',
      {
        title: 'Search AI Agents',
        description:
          'Search and list AI agents registered on AgentScore. ' +
          'Returns agents with a score envelope (trustScore, qualityScore, objectScore) ' +
          'plus the attestation tier (tier + tierBasis: "attestations" — Verified: >= 3 distinct attesters and >= 0.1 tTRUST attested; Trusted: >= 2 and >= 0.05; otherwise Unverified; null = unknown), ' +
          'momentum direction, live staker count, and skill count. ' +
          'In list context qualityScore is null — use get_agent_trust for the full composite. ' +
          'Sort by score, stakers, or newest. Filter by minimum trust score. ' +
          'Test fixtures and duplicate re-registrations are filtered out by default — ' +
          'set includeJunk to audit them (each tagged junkReason).',
        inputSchema: {
          sort: z.enum(['score', 'stakers', 'newest']).optional()
            .describe('Sort order: score (default), stakers, newest'),
          minTrust: z.number().min(0).max(100).optional()
            .describe('Minimum AGENTSCORE to include (0-100)'),
          limit: z.number().min(1).max(50).optional()
            .describe('Max results to return (default: 20, max: 50)'),
          includeJunk: z.boolean().optional()
            .describe('Include filtered test fixtures/duplicates, each tagged junkReason (default: false)'),
        },
      },
      async ({ sort, minTrust, limit, includeJunk }) => {
        try {
          const { agents, total, junkFiltered, truncated } = await getAgentsWithScores({
            sort: sort || 'score',
            limit: limit || 20,
            offset: 0,
            minTrust: minTrust || 0,
            includeJunk: includeJunk || false,
          })
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                agents: agents.map(a => ({
                  id: a.id,
                  name: a.name,
                  score: a.score,
                  scoreBasis: a.scoreBasis,
                  agentScore: a.agentScore,
                  tier: a.trustTier,
                  tierBasis: a.tierBasis,
                  momentum: a.momentumDirection,
                  stakers: a.stakerCount,
                  skills: a.skillCount,
                  ...(a.junkReason ? { junkReason: a.junkReason } : {}),
                })),
                // Corpus total after filters — was agents.length, i.e. the page size.
                total,
                junkFiltered,
                truncated,
                network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 2: get_agent_trust
    // ═══════════════════════════════════════════
    server.registerTool(
      'get_agent_trust',
      {
        title: 'Get Agent Trust Breakdown',
        description:
          'Get detailed trust analysis for a specific AI agent. ' +
          'Returns a full score envelope (trustScore, qualityScore from 4-pillar composite, objectScore = AGENTSCORE), ' +
          'per-skill breakdown (contextual trust), ' +
          'trust score components (economic confidence, composite quality), ' +
          'anti-manipulation metrics (whale detection, evaluator weights), ' +
          'and the attestation tier with what the next rung needs (distinct attesters, tTRUST attested — never backing). ' +
          "ERC-8004 cohort agents (outside the scored corpus) return origin 'erc8004' with their identity, declared " +
          'domains and attestation tier; they carry no score (scoreBasis null), and no stake/staker fields are invented.',
        inputSchema: {
          agentId: z.string()
            .describe('Agent\'s term ID (get from search_agents)'),
        },
      },
      async ({ agentId }) => {
        try {
          const [detail, trust] = await Promise.all([
            getAgentDetail(agentId),
            getAgentTrustBreakdown(agentId),
          ])
          if (!detail) {
            // Not in the scored corpus: an ERC-8004 cohort agent still answers (tier from attestations).
            const cohort = await getCohortAgentDetail(agentId)
            if (!cohort) return { content: [{ type: 'text' as const, text: 'Agent not found' }] }
            return { content: [{ type: 'text' as const, text: JSON.stringify({ agent: cohort }, null, 2) }] }
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                agent: {
                  id: detail.id,
                  name: detail.name,
                  score: detail.score,
                  scoreBasis: detail.scoreBasis,
                  agentScore: detail.agentScore,
                  tier: detail.trustTier,
                  tierBasis: detail.tierBasis,
                },
                skillBreakdown: detail.skillBreakdown,
                trustAnalysis: trust,
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 3: get_domain_ranking
    // ═══════════════════════════════════════════
    server.registerTool(
      'get_domain_ranking',
      {
        title: 'Get Domain Ranking',
        description:
          'Get the top-ranked AI agents for a specific skill domain. ' +
          'Answer the question: \'Who is the BEST agent for this skill?\' ' +
          'Returns agents ranked by domain-specific trust score. ' +
          'Use list_domains first to see available domains.',
        inputSchema: {
          domainId: z.string()
            .describe('Domain/skill term ID (get from list_domains)'),
          minTrust: z.number().min(0).max(100).optional()
            .describe('Minimum domain score to include'),
          limit: z.number().min(1).max(20).optional()
            .describe('Max results (default: 10)'),
        },
      },
      async ({ domainId, minTrust, limit }) => {
        try {
          const result = await getDomainAgents(domainId, {
            minTrust: minTrust || 0,
            limit: limit || 10,
          })
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 4: list_domains
    // ═══════════════════════════════════════════
    server.registerTool(
      'list_domains',
      {
        title: 'List Skill Domains',
        description:
          'List all skill domains (expertise areas) with their stats. ' +
          'Each domain shows: agent count, total stake, top agent. ' +
          'Use a domain\'s ID with get_domain_ranking to see the full leaderboard.',
        inputSchema: {},
      },
      async () => {
        try {
          const domains = await getDomains()
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                domains: domains.map(d => ({
                  id: d.id,
                  name: d.name,
                  agentCount: d.agentCount,
                  totalStake: d.totalStake,
                  topAgent: d.topAgent,
                  topAgentScore: d.topAgentScore,
                })),
                total: domains.length,
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 5: trust_query (THE LENS)
    // ═══════════════════════════════════════════
    server.registerTool(
      'trust_query',
      {
        title: 'Trust Query (Lens)',
        description:
          'THE MAIN TOOL. Filtered, contextual trust query. ' +
          'Find trusted agents matching specific criteria. ' +
          'Example: \'Find agents trusted for code generation with score above 70\'. ' +
          'Combines domain filtering, trust thresholds, and staker requirements. ' +
          'Results are ranked by trust score with evaluator-weighted anti-manipulation.',
        inputSchema: {
          skill: z.string().optional()
            .describe('Skill/domain name to filter by (case-insensitive partial match). Example: \'developer\', \'code\', \'web3\''),
          minTrust: z.number().min(0).max(100).optional()
            .describe('Minimum trust score (0-100). Default: 0'),
          minStakers: z.number().min(0).optional()
            .describe('Minimum number of stakers. Default: 0'),
          sort: z.enum(['score', 'stakers']).optional()
            .describe('Sort by: score (default) or stakers'),
          limit: z.number().min(1).max(20).optional()
            .describe('Max results (default: 10)'),
        },
      },
      async ({ skill, minTrust, minStakers, sort, limit }) => {
        try {
          const result = await trustQuery({
            skill,
            minTrust: minTrust || 0,
            minStakers: minStakers || 0,
            sort: sort || 'score',
            limit: limit || 10,
          })
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                query: { skill, minTrust, minStakers, sort },
                results: result.results,
                total: result.total,
                info: 'Scores include 7-layer anti-manipulation with attestation gate; no separate soft gate is applied.',
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 6: get_evaluator
    // ═══════════════════════════════════════════
    server.registerTool(
      'get_evaluator',
      {
        title: 'Get Evaluator Profile',
        description:
          'Get the accuracy profile and track record of a specific staker/evaluator. ' +
          'Shows: accuracy percentage, evaluator weight (0.5x-1.5x), ' +
          'tier (Newcomer/Scout/Analyst/Oracle/Sage), track record ' +
          '(which agents they backed and whether those picks were correct; currentTrust and correct ' +
          'are null when that agent\'s oppose read failed — unknown picks are left out of accuracy), ' +
          'and attestation gate status (Layer 7 anti-manipulation): ' +
          'attestationCount, meetsAttestationThreshold, attestationGateActive. ' +
          'evaluatorWeight is capped at 1.0x if attestation threshold is not met.',
        inputSchema: {
          address: z.string()
            .describe('Wallet address (0x...) of the evaluator'),
        },
      },
      async ({ address }) => {
        try {
          const profile = await getEvaluatorProfile(address)
          if (!profile) {
            return { content: [{ type: 'text' as const, text: 'Evaluator not found' }] }
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(profile, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 7: top_evaluators
    // ═══════════════════════════════════════════
    server.registerTool(
      'top_evaluators',
      {
        title: 'Top Evaluators Leaderboard',
        description:
          'Get the leaderboard of most accurate agent evaluators. ' +
          'Evaluators are ranked by their accuracy in predicting agent trust. ' +
          'Higher accuracy = more influence on scores (0.5x-1.5x weight). ' +
          'Filter by minimum accuracy or tier.',
        inputSchema: {
          minAccuracy: z.number().min(0).max(1).optional()
            .describe('Minimum accuracy (0.0-1.0). Example: 0.7 for 70%+'),
          tier: z.string().optional()
            .describe('Filter by tier: newcomer, scout, analyst, oracle, sage'),
          limit: z.number().min(1).max(50).optional()
            .describe('Max results (default: 20)'),
        },
      },
      async ({ minAccuracy, tier, limit }) => {
        try {
          const evaluators = await getEvaluatorLeaderboard({
            minAccuracy,
            tier,
            limit: limit || 20,
          })
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                evaluators,
                total: evaluators.length,
                info: 'Evaluator weight directly multiplies stake influence on agent scores',
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 8: compare_agents
    // ═══════════════════════════════════════════
    server.registerTool(
      'compare_agents',
      {
        title: 'Compare Agents',
        description:
          'Side-by-side comparison of 2-5 agents. ' +
          'Returns score envelope (objectScore = AGENTSCORE), skill breakdown, tier, momentum for each. ' +
          'qualityScore in the envelope reflects the full 4-pillar composite for each agent. ' +
          'Optionally filter comparison to a specific skill domain. ' +
          'Rows come in rank order. Only measured scores compete: comparedScore is null and ' +
          "comparedBasis is 'prior' for an agent (or skill triple) with no stake — its envelope " +
          "score is the neutral 50 anchor, not a measurement — and 'missing' when it lacks the skill; " +
          'those rank after every measured agent and are never the recommendation ' +
          '(recommendation is null when no agent has a measured score). ' +
          'Use this when deciding between multiple agents for a task.',
        inputSchema: {
          agentIds: z.array(z.string()).min(2).max(5)
            .describe('Array of agent term IDs to compare'),
          skill: z.string().optional()
            .describe('Optional: compare within a specific skill domain'),
        },
      },
      async ({ agentIds, skill }) => {
        try {
          const comparisons = await Promise.all(
            agentIds.map(async (id) => {
              const detail = await getAgentDetail(id)
              if (!detail) return { id, error: 'not found' as const }

              // The score this agent is compared on — measured, or null with its basis
              // (lib/agent-compare.ts). A prior is never ranked as if it were measured.
              const bySkill = skill ? comparedBySkill(detail.skillBreakdown, skill) : null
              const compared = bySkill ?? comparedOverall(detail)

              return {
                id: detail.id,
                name: detail.name,
                comparedScore: compared.score,
                comparedBasis: compared.basis,
                score: detail.score,
                scoreBasis: detail.scoreBasis,
                agentScore: detail.agentScore,
                tier: detail.trustTier,
                tierBasis: detail.tierBasis,
                momentum: detail.momentumDirection,
                domainScore: bySkill ? bySkill.score : null,
                domainName: bySkill ? bySkill.skillName : null,
                totalSkills: detail.skillBreakdown?.length || 0,
                stakerCount: detail.stakerCount,
              }
            })
          )

          const found = comparisons.filter((c): c is Exclude<typeof c, { error: 'not found' }> => !('error' in c))
          const { ranked, recommendation } = rankComparison(found, (c) => ({ score: c.comparedScore, basis: c.comparedBasis }))
          const notFound = comparisons.filter((c) => 'error' in c)

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                comparison: [...ranked, ...notFound],
                skill: skill || 'overall',
                recommendation: recommendation?.name ?? null,
                ...(recommendation ? {} : { recommendationNote: 'No compared agent has a measured score — nothing to recommend on.' }),
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 10: register_agent
    // ═══════════════════════════════════════════
    server.registerTool(
      'register_agent',
      {
        title: 'Register AI Agent',
        description:
          'Prepare registration data for a new AI agent on AgentScore. ' +
          'Returns structured data (atomLabel + instructions) needed to create ' +
          'on-chain atoms and triples. ' +
          'The actual on-chain transaction must be signed by the agent\'s wallet — ' +
          'this tool does NOT execute transactions. ' +
          'Provide as much metadata as possible for higher profile completeness score.',
        inputSchema: {
          name: z.string()
            .describe('Agent name (required). E.g. "CodeBuddy"'),
          description: z.string().optional()
            .describe('One-line description of what the agent does (max 500 chars)'),
          category: z.string().optional()
            .describe('Category: developer-tools | data-analysis | content-creation | defi-trading | security-audit | customer-support | research | education | healthcare | gaming | social | infrastructure | other'),
          skills: z.array(z.string()).optional()
            .describe('Array of skill/capability names. E.g. ["code-review", "bug-detection"]'),
          apiEndpoint: z.string().optional()
            .describe('REST API URL where the agent can be reached. E.g. "https://codebuddy.ai/api"'),
          mcpEndpoint: z.string().optional()
            .describe('MCP server URL for agent-to-agent communication. E.g. "https://codebuddy.ai/mcp"'),
          a2aCard: z.string().optional()
            .describe('A2A agent card URL. E.g. "https://codebuddy.ai/.well-known/agent.json"'),
          github: z.string().optional()
            .describe('GitHub repository. E.g. "github.com/org/repo"'),
          version: z.string().optional()
            .describe('Current version. E.g. "v2.1.0"'),
          license: z.string().optional()
            .describe('License. E.g. "MIT", "Apache-2.0", "Proprietary"'),
          framework: z.string().optional()
            .describe('Agent framework. E.g. "LangChain", "CrewAI", "ElizaOS", "Custom"'),
          website: z.string().optional()
            .describe('Agent website URL'),
          twitter: z.string().optional()
            .describe('Twitter/X handle. E.g. "@agentname"'),
        },
      },
      async ({ name, description, category, skills, apiEndpoint, mcpEndpoint, a2aCard, github, version, license, framework, website, twitter }) => {
        try {
          const cardData: AgentCardData = {
            name,
            description,
            category: category as AgentCategory | undefined,
            skills,
            endpoints: {
              api:     apiEndpoint,
              mcp:     mcpEndpoint,
              a2aCard: a2aCard,
              website: website,
            },
            source: { github, version, license, framework },
            social: { twitter },
          }

          const atomLabel    = serializeAgentCard(cardData)
          const completeness = calculateProfileCompleteness(cardData)

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'prepared',
                atomLabel,
                skills: skills || [],
                profileCompleteness: completeness.percentage,
                isA2AReady: completeness.isA2AReady,
                missingFields: completeness.missingFields,
                nextSteps: [
                  '1. Connect wallet to Intuition Testnet (Chain ID: 13579)',
                  '2. Use the AgentScore registration flow/helpers so createAtom routes through FeeProxy',
                  '3. Create type triple: [Agent] [is] [AI Agent] through FeeProxy',
                  '4. Create skill triples using the existing FeeProxy-backed helper for each skill',
                  '5. Profile will appear on AgentScore once indexed',
                ],
                registrationUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agentscore-gilt.vercel.app'}/register`,
                network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 9: platform_stats
    // ═══════════════════════════════════════════
    server.registerTool(
      'platform_stats',
      {
        title: 'AgentScore Platform Statistics',
        description:
          'Get current AgentScore platform statistics: ' +
          'total agents, skills, domains, evaluators, total staked, ' +
          'top domain, and top agent. ' +
          'topAgent.trustScore is trustScore-based (list context — no quality ' +
          'composite computed in aggregate; use get_agent_trust for the full envelope). ' +
          'attesters = distinct wallets with a live position on any attestation triple ' +
          '(is skilled in → canonical domain). A count whose read failed is null, never 0. ' +
          'Use this for a quick overview of the ecosystem.',
        inputSchema: {},
      },
      async () => {
        try {
          const stats = await getPlatformStats()
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(stats, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )

    // ═══════════════════════════════════════════
    // TOOL 11: get_agent_timeline
    // ═══════════════════════════════════════════
    server.registerTool(
      'get_agent_timeline',
      {
        title: 'Get Agent Trust Timeline',
        description:
          'Get the chronological trust history of an AI agent, from real dated ' +
          'on-chain events: staker joins/leaves, skill/domain attestation claims, ' +
          '(an agent\'s tier comes only from attestations, so staker counts emit no tier events), ' +
          'high-accuracy evaluator staking, and A2A readiness. ' +
          'Use this to understand WHY an agent has its current score and WHEN ' +
          'specific events occurred. Historical score snapshots are not persisted — ' +
          'only the current score and these dated events are real; there is no ' +
          'continuous score curve. currentScore is the measured AGENTSCORE or null, never a ' +
          "default: scoreBasis 'prior' = no stake yet (nothing measured), null = the atom is not " +
          'a scored AgentScore agent (e.g. an ERC-8004 cohort agent).',
        inputSchema: {
          agentId: z.string().describe("Agent's term ID (from search_agents or get_agent_trust)"),
          limit: z.number().min(1).max(50).optional().describe('Max events to return (default: 20)'),
          type: z.enum([
            'staker_joined', 'staker_opposed', 'staker_left',
            'skill_added', 'domain_attested', 'tier_upgrade', 'evaluator_staked',
            'registered', 'a2a_ready',
          ]).optional().describe('Filter by event type'),
        },
      },
      async ({ agentId, limit, type }) => {
        try {
          const [rawData, agentDetail] = await Promise.all([
            fetchTimelineData(agentId),
            getAgentDetail(agentId),
          ])

          // null = no such atom; a failed read throws → "Error: …" below, never "not found".
          if (!rawData) {
            return { content: [{ type: 'text' as const, text: 'Agent not found.' }] }
          }

          // Measured AGENTSCORE or null — never the 50 prior (lib/score-basis.ts).
          const published = publishedAgentScore(agentDetail)
          const timeline = buildAgentTimeline({
            agentId: rawData.agentId,
            agentName: rawData.agentName,
            createdAt: rawData.createdAt,
            currentScore: published.score,
            currentTier: agentDetail?.trustTier ?? null, // attestation tier; null = unknown
            tierMilestones: 'none',
            stakingEvents: rawData.stakingEvents,
            skillEvents: rawData.skillEvents,
          })

          let events = timeline.events
          if (type) events = events.filter(e => e.type === type)
          events = events.slice(0, limit ?? 20)

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                agentName: timeline.agentName,
                currentScore: timeline.currentScore,
                scoreBasis: published.scoreBasis,
                currentTier: timeline.currentTier,
                tierBasis: 'attestations',
                summary: timeline.summary,
                events: events.map(e => ({
                  date: e.timestamp,
                  type: e.type,
                  title: e.title,
                  description: e.description,
                  scoreAtEvent: e.scoreAtEvent,
                  severity: e.severity,
                })),
                info: 'Timeline reconstructed from on-chain signals and skill triples. Events are ordered newest first.',
              }, null, 2),
            }],
          }
        } catch (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error}` }] }
        }
      }
    )
  },
  {
    serverInfo: {
      name: 'AgentScore Trust MCP',
      version: '1.0.0',
    },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 30,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
)

async function handlerWithCors(...args: Parameters<typeof handler>): Promise<Response> {
  return withCors(await handler(...args))
}

export { handlerWithCors as GET, handlerWithCors as POST }

export async function OPTIONS() {
  return new Response(null, { headers: MCP_CORS_HEADERS })
}
