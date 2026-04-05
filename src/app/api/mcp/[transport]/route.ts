import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'

import {
  getAgentsWithScores,
  getAgentDetail,
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
import {
  calculateProfileCompleteness,
  serializeAgentCard,
  type AgentCardData,
  type AgentCategory,
} from '@/lib/agent-card'

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
          'Returns agents with their AGENTSCORE (0-100), trust tier, ' +
          'momentum direction, staker count, and skill count. ' +
          'Sort by score, stakers, or newest. Filter by minimum trust score.',
        inputSchema: {
          sort: z.enum(['score', 'stakers', 'newest']).optional()
            .describe('Sort order: score (default), stakers, newest'),
          minTrust: z.number().min(0).max(100).optional()
            .describe('Minimum AGENTSCORE to include (0-100)'),
          limit: z.number().min(1).max(50).optional()
            .describe('Max results to return (default: 20, max: 50)'),
        },
      },
      async ({ sort, minTrust, limit }) => {
        try {
          const { agents } = await getAgentsWithScores({
            sort: sort || 'score',
            limit: limit || 20,
            offset: 0,
            minTrust: minTrust || 0,
          })
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                agents: agents.map(a => ({
                  id: a.id,
                  name: a.name,
                  agentScore: a.agentScore,
                  tier: a.trustTier,
                  momentum: a.momentumDirection,
                  stakers: a.stakerCount,
                  skills: a.skillCount,
                })),
                total: agents.length,
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
          'Returns AGENTSCORE, per-skill breakdown (contextual trust), ' +
          'trust score components (economic confidence, composite quality), ' +
          'anti-manipulation metrics (whale detection, evaluator weights), ' +
          'and tier progression (what\'s needed for next tier).',
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
            return { content: [{ type: 'text' as const, text: 'Agent not found' }] }
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                agent: {
                  id: detail.id,
                  name: detail.name,
                  agentScore: detail.agentScore,
                  tier: detail.trustTier,
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
                info: 'Scores include 6-layer anti-manipulation: soft gate, log diversity, min stake, variance penalty, whale detection, evaluator accuracy weighting',
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
          'tier (Newcomer/Scout/Analyst/Oracle/Sage), and track record ' +
          '(which agents they backed and whether those picks were correct).',
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
          'Shows AGENTSCORE, skill breakdown, tier, momentum for each. ' +
          'Optionally filter comparison to a specific skill domain. ' +
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
              if (!detail) return { id, error: 'not found' }

              const skillScore = skill
                ? detail.skillBreakdown?.find(
                    (s: { skillName: string; score: number }) =>
                      s.skillName.toLowerCase().includes(skill.toLowerCase())
                  )
                : null

              return {
                id: detail.id,
                name: detail.name,
                agentScore: detail.agentScore,
                tier: detail.trustTier,
                momentum: detail.momentumDirection,
                domainScore: skillScore?.score ?? null,
                domainName: skillScore?.skillName ?? null,
                totalSkills: detail.skillBreakdown?.length || 0,
                stakerCount: detail.stakerCount,
              }
            })
          )

          const ranked = comparisons
            .filter((c): c is Exclude<typeof c, { error: string }> => !('error' in c))
            .sort((a, b) => {
              const scoreA = skill ? (a.domainScore ?? 0) : a.agentScore
              const scoreB = skill ? (b.domainScore ?? 0) : b.agentScore
              return scoreB - scoreA
            })

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                comparison: comparisons,
                skill: skill || 'overall',
                recommendation: ranked[0]?.name ?? null,
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
                  '2. Sign and submit createAtom transaction with the atomLabel',
                  '3. Create type triple: [Agent] [is] [AI Agent]',
                  '4. Create skill triples using linkSkillToAgent() for each skill',
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
          'Get the chronological trust history of an AI agent. ' +
          'Shows every significant event: staker joins/leaves, skill additions, ' +
          'tier upgrades (Sandbox at 3, Trusted at 10, Verified at 25 stakers), ' +
          'high-accuracy evaluator staking, and A2A readiness. ' +
          'Use this to understand WHY an agent has its current score ' +
          'and HOW its reputation developed over time.',
        inputSchema: {
          agentId: z.string().describe("Agent's term ID (from search_agents or get_agent_trust)"),
          limit: z.number().min(1).max(50).optional().describe('Max events to return (default: 20)'),
          type: z.enum([
            'staker_joined', 'staker_opposed', 'staker_left',
            'skill_added', 'tier_upgrade', 'evaluator_staked',
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

          if (!rawData) {
            return { content: [{ type: 'text' as const, text: 'Agent not found.' }] }
          }

          const timeline = buildAgentTimeline({
            agentId: rawData.agentId,
            agentName: rawData.agentName,
            createdAt: rawData.createdAt,
            currentScore: agentDetail?.agentScore ?? 50,
            currentTier: agentDetail?.trustTier ?? 'unverified',
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
                currentTier: timeline.currentTier,
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

export { handler as GET, handler as POST }
