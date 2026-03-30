import { type NextRequest } from 'next/server'
import { apiSuccess, corsOptions } from '@/lib/api-helpers'

export async function GET(_request: NextRequest) {
  return apiSuccess({
    name: 'AgentScore Trust API',
    version: 'v1',
    network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
    documentation: '/docs#smart-contracts',
    endpoints: {
      api_index: '/api/v1',
      agents: '/api/v1/agents',
      agent_detail: '/api/v1/agents/:id',
      agent_trust: '/api/v1/agents/:id/trust',
      skills: '/api/v1/skills',
      skill_detail: '/api/v1/skills/:id',
      domains: '/api/v1/domains',
      domain_agents: '/api/v1/domains/:id/agents',
      evaluators: '/api/v1/evaluators',
      evaluator_profile: '/api/v1/evaluators/:address',
      trust_query: '/api/v1/trust/query',
      stats: '/api/v1/stats',
    },
  })
}

export async function OPTIONS() {
  return corsOptions()
}
