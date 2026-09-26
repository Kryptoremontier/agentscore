/**
 * Shared by screenshots.spec.ts (what to capture) and warmup.ts (what to
 * pre-compile). Keeping one list means a new route can't be captured cold.
 */

// Term ids of the three reference agents used across the Etap 3/4b work
// (same ids as src/lib/__tests__/agent-profile.test.ts; OPEN CLAW from
// /api/v1/agents). `/agents?open=<id>` is the page's own deep-link.
export const AGENTS = {
  dackie: '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb',
  luda: '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a',
  openclaw: '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d',
} as const

export const ROUTES = {
  landing: '/',
  agents: '/agents',
  agentProfile: (id: string) => `/agents/${id}`,
  domains: '/domains',
  evaluators: '/evaluators',
  leaderboard: '/leaderboard',
  claims: '/claims',
  skills: '/skills',
  intuforge: '/explore/intuforge',
} as const

/**
 * Every distinct route the harness visits, loaded once in a browser before the
 * shots. `?open=` is included because the modal lazy-loads its own chunks.
 */
export const WARMUP_PATHS: string[] = [
  ROUTES.landing,
  ROUTES.agents,
  `${ROUTES.agents}?open=${AGENTS.dackie}`,
  ROUTES.agentProfile(AGENTS.dackie),
  ROUTES.domains,
  ROUTES.evaluators,
  ROUTES.leaderboard,
  ROUTES.claims,
  ROUTES.skills,
  ROUTES.intuforge,
]
