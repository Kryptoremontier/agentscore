import { describe, it, expect } from 'vitest'
import {
  compareAgentEntries, hasStake, backingOf, parseSort, DEFAULT_SORT, SORT_OPTIONS, type SortableAgentEntry,
} from '../agent-list-sort'

// `stakers` = live stakers (lib/live-position.ts countLiveStakers) — never a raw row count.
const entry = (stakers: number, shares: string, score: number, extra: Partial<SortableAgentEntry> = {}, created_at = '2026-01-01T00:00:00Z'): SortableAgentEntry => ({
  agent: { positions_aggregate: { aggregate: { sum: { shares } } }, liveStakerCount: stakers, created_at },
  trust: { score },
  ...extra,
})
const E18 = 10n ** 18n
const wei = (t: number) => BigInt(Math.round(t * 1e6)) * (E18 / 1_000_000n)
const sortBy = (rows: SortableAgentEntry[], mode: Parameters<typeof compareAgentEntries>[2]) => [...rows].sort((a, b) => compareAgentEntries(a, b, mode))

const UNSTAKED_COHORT = entry(0, '0', 50) // e.g. a cohort atom with no real stake
const SELF_DEPOSIT_ONLY = entry(1, '980000000000000', 100) // 0.00098 tTRUST self-deposit, 100% support ratio
const REAL_AGENT_MODEST = entry(5, '200000000000000000', 62) // real agent, modest score

describe('the options — people first by default', () => {
  it('"Most vouched" (default), "Newest", "Highest backing"; ?sort= parses, anything else → the default', () => {
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual(['Most vouched', 'Newest', 'Highest backing'])
    expect(DEFAULT_SORT).toBe('vouched')
    expect([parseSort('vouched'), parseSort('newest'), parseSort('backing')]).toEqual(['vouched', 'newest', 'backing'])
    expect([parseSort(null), parseSort(''), parseSort('score_desc')]).toEqual(['vouched', 'vouched', 'vouched'])
  })
})

describe('Most vouched: people → tTRUST behind vouches → backing score → newest', () => {
  // Live 2026-09-30: Luda and Captain Dackie each have one person vouching (the same wallet);
  // Luda 0.0208 tTRUST, Dackie 0.0099. Everyone else: nobody.
  const LUDA = entry(1, '1000000000000000', 50, { measured: true, vouch: { people: 1, stakeWei: wei(0.0208) } }, '2026-06-01T00:00:00Z')
  const DACKIE = entry(0, '0', 50, { measured: false, vouch: { people: 1, stakeWei: wei(0.0099) } }, '2026-03-01T00:00:00Z')
  const OPEN_CLAW = entry(1, '335100000000000000', 98, { measured: true, vouch: null }, '2026-02-18T00:00:00Z')
  const CODEBUDDY = entry(2, '99000000000000000', 81, { measured: true, vouch: null }, '2026-05-01T00:00:00Z')
  const NEW_COHORT = entry(0, '0', 50, { measured: false, vouch: null }, '2026-09-01T00:00:00Z')
  const OLD_COHORT = entry(0, '0', 50, { measured: false, vouch: null }, '2026-01-01T00:00:00Z')

  it('the live order starts Luda, Captain Dackie; then backing high → low; then "—" rows newest first', () => {
    expect(sortBy([OLD_COHORT, OPEN_CLAW, NEW_COHORT, DACKIE, CODEBUDDY, LUDA], 'vouched'))
      .toEqual([LUDA, DACKIE, OPEN_CLAW, CODEBUDDY, NEW_COHORT, OLD_COHORT])
  })
  it('more people beat more tTRUST; with equal people, more tTRUST first', () => {
    const twoSmall = entry(0, '0', 50, { vouch: { people: 2, stakeWei: wei(0.001) } })
    const oneBig = entry(0, '0', 50, { vouch: { people: 1, stakeWei: wei(5) } })
    expect(sortBy([oneBig, twoSmall], 'vouched')).toEqual([twoSmall, oneBig])
  })
  it('a vouch outranks any backing: people first (an unbacked agent people vouch for leads a backed one)', () => {
    expect(sortBy([OPEN_CLAW, DACKIE], 'vouched')).toEqual([DACKIE, OPEN_CLAW])
  })
  it('an unread vouch count (null) sorts as nobody — never above a counted one', () => {
    expect(sortBy([entry(1, '1', 99, { vouch: undefined }), DACKIE], 'vouched')[0]).toBe(DACKIE)
  })
})

describe('Newest', () => {
  it('created_at, newest first — nothing else', () => {
    const a = entry(0, '0', 50, {}, '2026-09-01T00:00:00Z')
    const b = entry(9, '9000000000000000000', 99, { vouch: { people: 3, stakeWei: wei(1) } }, '2026-01-01T00:00:00Z')
    expect(sortBy([b, a], 'newest')).toEqual([a, b])
  })
})

describe('Highest backing — the honesty gate: an unmeasured row never ranks by its prior', () => {
  it('sinks a zero-staker entry below a staked entry, even though its raw score is higher', () => {
    const highScoreButUnstaked = entry(0, '0', 99)
    expect(sortBy([highScoreButUnstaked, REAL_AGENT_MODEST], 'backing')).toEqual([REAL_AGENT_MODEST, highScoreButUnstaked])
  })
  it('a lone self-deposit (1 staker) is NOT treated as unstaked — ranks by its own number', () => {
    expect(sortBy([REAL_AGENT_MODEST, SELF_DEPOSIT_ONLY], 'backing')[0]).toBe(SELF_DEPOSIT_ONLY)
  })
  it('unmeasured rows keep newest-first among themselves', () => {
    const newer = entry(0, '0', 20, {}, '2026-05-01T00:00:00Z')
    const older = entry(0, '0', 80, {}, '2026-04-01T00:00:00Z')
    expect(sortBy([older, newer, UNSTAKED_COHORT], 'backing')).toEqual([newer, older, UNSTAKED_COHORT])
  })
})

describe('hasStake / backingOf — the measured flag decides; a zero-share "staker" has no backing score', () => {
  const ZERO_SHARE: SortableAgentEntry = { ...entry(1, '0', 50), measured: false }
  const MEASURED_LOW: SortableAgentEntry = { ...entry(1, '980000000000000', 50), measured: true }
  const MEASURED_HIGH: SortableAgentEntry = { ...entry(1, '335061000000000000', 98), measured: true }

  it('hasStake follows the measured flag when provided', () => {
    expect(hasStake(ZERO_SHARE)).toBe(false)
    expect(hasStake(MEASURED_LOW)).toBe(true)
    expect([backingOf(ZERO_SHARE), backingOf(MEASURED_LOW)]).toEqual([null, 50])
  })
  it('sinks the unmeasured row below every measured row', () => {
    expect(sortBy([ZERO_SHARE, MEASURED_LOW, MEASURED_HIGH], 'backing')).toEqual([MEASURED_HIGH, MEASURED_LOW, ZERO_SHARE])
  })
  it('without the flag the gate reads LIVE stakers: a lone 0-share row is 0 stakers, so not staked', () => {
    expect(hasStake(entry(0, '0', 50))).toBe(false)
    expect(hasStake(entry(1, '980000000000000', 50))).toBe(true)
  })
  it('unknown stakers (a failed read, null) are not staked', () => {
    const unknown: SortableAgentEntry = { agent: { liveStakerCount: null }, trust: { score: 90 } }
    expect(backingOf(unknown)).toBeNull()
    expect(sortBy([unknown, entry(1, '1', 10)], 'backing')[1]).toBe(unknown)
  })
})
