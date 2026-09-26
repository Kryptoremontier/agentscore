/**
 * MCP compare_agents ranking — only measured scores compete (thesis §6,
 * lib/score-basis.ts). Same honesty gate as the /agents sort (agent-list-sort.ts):
 * a score that is only the engine's 50 prior (zero stake) never ranks above a
 * measurement, and is never the recommendation.
 *
 * - Overall: an agent's AGENTSCORE counts when its scoreBasis is 'measured'.
 * - By skill: the skill triple's own score counts when that triple holds stake
 *   (support + oppose > 0). A skill triple at zero stake is a prior. An agent
 *   without the skill has no score for it — null, never 0.
 *
 * Order: measured rows by score (desc), then rows with a prior, then rows
 * without the skill. Ties and the unmeasured groups keep the caller's order.
 * Pure, no I/O.
 */

import type { ScoreBasis } from './score-basis'

/** Basis of the score an agent was compared on. 'missing' = it has no score for the compared skill. */
export type ComparedBasis = ScoreBasis | 'missing'

export interface ComparedScore {
  /** The compared score, or null when it isn't a measurement. */
  score: number | null
  basis: ComparedBasis
}

export interface CompareSkillRow {
  skillName: string
  score: number
  supportStake: number
  opposeStake: number
}

/** Overall: the agent's measured AGENTSCORE, else null with its basis. */
export function comparedOverall(agent: { agentScore: number; scoreBasis: ScoreBasis }): ComparedScore {
  return agent.scoreBasis === 'measured'
    ? { score: agent.agentScore, basis: 'measured' }
    : { score: null, basis: 'prior' }
}

const staked = (s: CompareSkillRow) => s.supportStake + s.opposeStake > 0

/**
 * By skill: a skill whose name contains `skill` (case-insensitive), measured only when it
 * holds stake. A staked match wins over an unstaked one — the breakdown is sorted by score,
 * and a zero-stake triple's 50 prior must not hide a measured match for the same query.
 */
export function comparedBySkill(skills: readonly CompareSkillRow[] | null | undefined, skill: string): ComparedScore & { skillName: string | null } {
  const q = skill.toLowerCase()
  const matches = (skills ?? []).filter((s) => s.skillName.toLowerCase().includes(q))
  const hit = matches.find(staked) ?? matches[0]
  if (!hit) return { score: null, basis: 'missing', skillName: null }
  return staked(hit)
    ? { score: hit.score, basis: 'measured', skillName: hit.skillName }
    : { score: null, basis: 'prior', skillName: hit.skillName }
}

const GROUP: Record<ComparedBasis, number> = { measured: 0, prior: 1, missing: 2 }

/**
 * Rank rows by their compared score. Returns them in rank order with `rank`
 * (1-based) and the recommendation: the top MEASURED row, or null when no
 * row has a measured score — never a pick made on a prior.
 */
export function rankComparison<T>(
  rows: readonly T[],
  compared: (row: T) => ComparedScore,
): { ranked: Array<T & { rank: number }>; recommendation: T | null } {
  const keyed = rows.map((row, i) => ({ row, i, c: compared(row) }))
  keyed.sort((a, b) => {
    const g = GROUP[a.c.basis] - GROUP[b.c.basis]
    if (g !== 0) return g
    if (a.c.basis === 'measured' && b.c.score !== a.c.score) return (b.c.score ?? 0) - (a.c.score ?? 0)
    return a.i - b.i
  })
  const ranked = keyed.map((k, idx) => ({ ...k.row, rank: idx + 1 }))
  const top = keyed[0]
  return { ranked, recommendation: top && top.c.basis === 'measured' ? top.row : null }
}
