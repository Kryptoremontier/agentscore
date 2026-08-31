/**
 * Canonical map of Trust API v1 routes.
 *
 * Single source for both the GET /api/v1 index response and GET /llms.txt —
 * neither should hand-write a path that could drift from the other.
 */
export const API_V1_ENDPOINTS = {
  api_index: '/api/v1',
  agents: '/api/v1/agents',
  agent_detail: '/api/v1/agents/:id',
  agent_trust: '/api/v1/agents/:id/trust',
  agent_card: '/api/v1/agents/:id/card',
  skills: '/api/v1/skills',
  skill_detail: '/api/v1/skills/:id',
  domains: '/api/v1/domains',
  domain_agents: '/api/v1/domains/:id/agents',
  evaluators: '/api/v1/evaluators',
  evaluator_profile: '/api/v1/evaluators/:address',
  trust_query: '/api/v1/trust/query',
  leaderboard: '/api/v1/leaderboard',
  stats: '/api/v1/stats',
} as const
