/**
 * Etap 5b Run 2 commit 3 — secondary pages speak human: /domains opens with a plain intro instead of
 * jargon counts, /evaluators' "Vouched" and "Picks" headers no longer overlap and the struck-out
 * weight and the lock have a legend, /leaderboard names people (Run 1's <PersonName>).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DOMAINS_INTRO, EVALUATOR_LEGEND, evaluatorCappedTip, evaluatorVouchedTip } from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('/domains', () => {
  const page = code('app/domains/page.tsx')
  it('a plain intro, the spec\'s words', () => {
    expect(DOMAINS_INTRO).toBe('Areas people vouch for agents in. Below them, topics agents tag themselves with — not vouched for.')
    expect(page).toMatch(/data-testid="domains-intro">\s*\{DOMAINS_INTRO\}/)
  })
  it('no jargon header counts (active domains, ranked agents, total stakers, "attested · skills shown · junk filtered")', () => {
    expect(page).not.toMatch(/Active Domains|Ranked Agents|Total Stakers|junk filtered|skills shown/)
  })
  it('vouch vocabulary in its sections', () => {
    expect(page).not.toMatch(/>Attested<|attested by|Community attestations|No attested agents yet|Ecosystem signals|'attester'/)
    expect(page).toMatch(/\{DOMAINS_VOUCHED_HEADING\}/)
    expect(page).toMatch(/\{DOMAINS_TAGS_HEADING\}/)
  })
})

describe('/evaluators', () => {
  const client = code('components/evaluators/EvaluatorsClient.tsx')
  it('header and rows share one column template; from sm up Vouched and Picks are wide enough (no overlap)', () => {
    expect(client.match(/\$\{TABLE_GRID\}/g)).toHaveLength(2)
    const grid = client.match(/const TABLE_GRID = '([^']+)'/)![1]
    const sm = grid.match(/sm:grid-cols-\[([^\]]+)\]/)![1].split('_')
    expect(parseInt(sm[5], 10)).toBeGreaterThanOrEqual(76) // "VOUCHED" at 10px, tracking-widest
    expect(parseInt(sm[6], 10)).toBeGreaterThanOrEqual(52) // "PICKS"
    expect(client).not.toMatch(/>Attested</)
  })
  it('a legend for the struck-out weight, the lock and the check', () => {
    expect(client).toMatch(/data-testid="evaluators-legend"/)
    expect(client).toMatch(/<span className="line-through tabular-nums">1\.40×<\/span> — \{EVALUATOR_LEGEND\.struck\}/)
    expect(client).toMatch(/<Lock className="w-3 h-3" \/>[\s\S]*?\{EVALUATOR_LEGEND\.lock\}/)
    expect(EVALUATOR_LEGEND.struck).toMatch(/capped at 1\.0× until someone vouches/)
    expect(evaluatorCappedTip(1.4)).toBe('Capped at 1.0× — needs 1 person to vouch for this evaluator to unlock 1.40×')
    expect(evaluatorVouchedTip(1)).toBe('1 person vouches for this evaluator')
  })
})

describe('/leaderboard', () => {
  it('names people through <PersonName> (Run 1), no hex helper', () => {
    const client = code('components/leaderboard/LeaderboardClient.tsx')
    expect(client).toMatch(/<PersonName wallet=\{e\.address\} \/>/)
    expect(client).not.toMatch(/function shortAddr|\.slice\(-4\)/)
  })
})
