import { describe, it, expect } from 'vitest'
import { compareAgentEntries, hasStake, type SortableAgentEntry } from '../agent-list-sort'

const entry = (count: number, shares: string, score: number): SortableAgentEntry => ({
  agent: { positions_aggregate: { aggregate: { count, sum: { shares } } } },
  trust: { score },
})

const UNSTAKED_COHORT = entry(0, '0', 50) // e.g. a cohort atom with no real stake
const SELF_DEPOSIT_ONLY = entry(1, '980000000000000', 100) // 0.00098 tTRUST self-deposit, 100% support ratio
const REAL_AGENT_MODEST = entry(5, '200000000000000000', 62) // real agent, modest score

describe('hasStake', () => {
  it('is false for zero stakers', () => {
    expect(hasStake(UNSTAKED_COHORT)).toBe(false)
  })
  it('is true for any staker count above zero, including a lone self-deposit', () => {
    expect(hasStake(SELF_DEPOSIT_ONLY)).toBe(true)
  })
})

describe('compareAgentEntries — honesty gate: unstaked never outranks staked', () => {
  it('sinks a zero-staker entry below a staked entry under score_desc, even though its raw score is higher', () => {
    // Unstaked cohort atom's neutral ~50 score is LOWER than the real agent's 62 here,
    // so also assert the gate fires even when the unstaked score would win the tie.
    const highScoreButUnstaked = entry(0, '0', 99)
    const sorted = [REAL_AGENT_MODEST, highScoreButUnstaked].sort((a, b) => compareAgentEntries(a, b, 'score_desc'))
    expect(sorted[0]).toBe(REAL_AGENT_MODEST)
    expect(sorted[1]).toBe(highScoreButUnstaked)
  })

  it('sinks a zero-staker entry below a staked entry under score_asc too', () => {
    const sorted = [UNSTAKED_COHORT, REAL_AGENT_MODEST].sort((a, b) => compareAgentEntries(a, b, 'score_asc'))
    expect(sorted[0]).toBe(REAL_AGENT_MODEST)
  })

  it('a lone self-deposit (1 staker) is NOT treated as unstaked — ranks by its own numbers among staked entries', () => {
    const sorted = [REAL_AGENT_MODEST, SELF_DEPOSIT_ONLY].sort((a, b) => compareAgentEntries(a, b, 'score_desc'))
    // SELF_DEPOSIT_ONLY has the higher raw score (100 vs 62) and both count as "staked" (>=1 staker)
    expect(sorted[0]).toBe(SELF_DEPOSIT_ONLY)
  })

  it('preserves ordering among multiple unstaked entries by the requested sort', () => {
    const unstakedA = entry(0, '0', 80)
    const unstakedB = entry(0, '0', 20)
    const sorted = [unstakedA, unstakedB].sort((a, b) => compareAgentEntries(a, b, 'score_desc'))
    expect(sorted).toEqual([unstakedA, unstakedB])
  })
})

describe('compareAgentEntries — sort modes within the staked group', () => {
  const a = entry(10, '500000000000000000', 70)
  const b = entry(3, '100000000000000000', 90)

  it('stakers: more stakers first', () => {
    expect(compareAgentEntries(a, b, 'stakers')).toBeLessThan(0)
  })
  it('stake: more total stake first', () => {
    expect(compareAgentEntries(a, b, 'stake')).toBeLessThan(0)
  })
  it('score_desc: higher score first', () => {
    expect(compareAgentEntries(a, b, 'score_desc')).toBeGreaterThan(0)
  })
  it('newest (unhandled sort key): stable, no reordering within the group', () => {
    expect(compareAgentEntries(a, b, 'newest')).toBe(0)
  })
})
