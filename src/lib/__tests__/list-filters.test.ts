import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  agentListHeaderSegments, corpusTotals, qualityOptions, qualityOptionText, parseListFilters, listFiltersSearch,
  ORIGIN_TABS, type AgentScoreCorpusCounts, type CohortCorpusCounts, type FeedStatus,
} from '../agent-list'
import type { QualityBucket } from '../score-basis'

/**
 * Etap 4b-finish commit 5 — origin as tabs, quality as a filter. The live assertions are in the
 * shots harness (agents-list-fold: first card above the fold at 390×844; agents-list-erc8004:
 * tab counts = header, URL follows; agents-list-erc8004-unrated: the URL alone sets both filters,
 * the dropdown lists every bucket).
 */

const agentScore = (status: FeedStatus, kept = 9): AgentScoreCorpusCounts =>
  ({ status, kept, junk: 6, fetched: kept + 6, total: kept + 6, truncated: false })
const cohort = (status: FeedStatus, count = 263): CohortCorpusCounts => ({ status, count, total: count, truncated: false })

describe('origin tabs print the header line\'s corpus totals (one source)', () => {
  it('both read → each corpus, and All = their sum (live 2026-09-28: 9 + 263 = 272)', () => {
    expect(corpusTotals({ agentScore: agentScore('ok'), cohort: cohort('ok') })).toEqual({ all: 272, agentscore: 9, erc8004: 263 })
  })

  it('a corpus loading or failed is unknown (null → "—"), never 0; All is unknown with it', () => {
    expect(corpusTotals({ agentScore: agentScore('loading'), cohort: cohort('ok') })).toEqual({ all: null, agentscore: null, erc8004: 263 })
    expect(corpusTotals({ agentScore: agentScore('ok'), cohort: cohort('error', 0) })).toEqual({ all: null, agentscore: 9, erc8004: null })
  })

  it('the header prints exactly the tab numbers, in every feed state', () => {
    const states: FeedStatus[] = ['loading', 'ok', 'error']
    for (const a of states) for (const c of states) {
      const input = { agentScore: agentScore(a, 7), cohort: cohort(c, 12) }
      const totals = corpusTotals(input)
      const [aSeg, cSeg] = agentListHeaderSegments(input)
      if (totals.agentscore != null) expect(aSeg).toBe(`${totals.agentscore} AgentScore`)
      else expect(aSeg).not.toMatch(/^\d/)
      if (totals.erc8004 != null) expect(cSeg).toBe(`${totals.erc8004} ERC-8004`)
      else expect(cSeg).not.toMatch(/^\d/)
    }
  })

  it('three tabs: All, AgentScore, ERC-8004', () => {
    expect(ORIGIN_TABS.map((t) => [t.id, t.label])).toEqual([['all', 'All'], ['agentscore', 'AgentScore'], ['erc8004', 'ERC-8004']])
  })
})

describe('qualityOptions — every bucket listed; an empty one disabled with its 0, never hidden', () => {
  const rows = (spec: Partial<Record<QualityBucket, number>>): QualityBucket[] =>
    Object.entries(spec).flatMap(([b, n]) => Array<QualityBucket>(n!).fill(b as QualityBucket))

  it('live-like mix: Low and Critical have no rows → listed, disabled, "(0)"', () => {
    const opts = qualityOptions(rows({ excellent: 2, good: 4, moderate: 1, unrated: 265 }))
    expect(opts.map((o) => [qualityOptionText(o), o.disabled])).toEqual([
      ['All backing levels (272)', false],
      ['Excellent (2)', false],
      ['Good (4)', false],
      ['Moderate (1)', false],
      ['Low (0)', true],
      ['Critical (0)', true],
      ['Unrated (265)', false],
    ])
  })

  it('no rows at all (e.g. a search matching nothing): every bucket still listed, "All" stays selectable', () => {
    const opts = qualityOptions([])
    expect(opts).toHaveLength(7)
    expect(opts[0]).toMatchObject({ id: 'all', count: 0, disabled: false })
    expect(opts.slice(1).every((o) => o.disabled && o.count === 0)).toBe(true)
  })

  it('rows not read yet → no counts printed and nothing disabled (unknown is not 0)', () => {
    const opts = qualityOptions(null)
    expect(opts.map(qualityOptionText)).toEqual(['All backing levels', 'Excellent', 'Good', 'Moderate', 'Low', 'Critical', 'Unrated'])
    expect(opts.some((o) => o.disabled)).toBe(false)
  })
})

describe('URL state — ?origin=erc8004&quality=unrated', () => {
  const params = (q: string) => new URLSearchParams(q)

  it('parses all three; unknown or missing filters fall back to "all", the sort to "Most vouched"', () => {
    expect(parseListFilters(params('?origin=erc8004&quality=unrated'))).toEqual({ origin: 'erc8004', quality: 'unrated', sort: 'vouched' })
    expect(parseListFilters(params('?origin=agentscore&quality=excellent&sort=newest'))).toEqual({ origin: 'agentscore', quality: 'excellent', sort: 'newest' })
    expect(parseListFilters(params(''))).toEqual({ origin: 'all', quality: 'all', sort: 'vouched' })
    expect(parseListFilters(params('?origin=nasa&quality=great&sort=score_desc'))).toEqual({ origin: 'all', quality: 'all', sort: 'vouched' })
  })

  it('writes only non-default filters; keeps unrelated params; drops a stale ?open=', () => {
    expect(listFiltersSearch('', { origin: 'erc8004', quality: 'unrated' })).toBe('?origin=erc8004&quality=unrated')
    expect(listFiltersSearch('?origin=erc8004&quality=unrated', { origin: 'all', quality: 'all' })).toBe('')
    expect(listFiltersSearch('?ref=x&open=0xabc', { origin: 'agentscore', quality: 'all' })).toBe('?ref=x&origin=agentscore')
  })

  it('the sort stays in the URL once chosen — "Most vouched" too (?sort=vouched); a filter change keeps it', () => {
    expect(listFiltersSearch('', { origin: 'all', quality: 'all', sort: 'vouched' })).toBe('?sort=vouched')
    expect(listFiltersSearch('?sort=newest', { origin: 'erc8004', quality: 'all' })).toBe('?sort=newest&origin=erc8004')
    expect(listFiltersSearch('?sort=newest', { origin: 'all', quality: 'all', sort: 'backing' })).toBe('?sort=backing')
  })

  it('round-trips', () => {
    for (const f of [{ origin: 'erc8004', quality: 'unrated', sort: 'vouched' }, { origin: 'all', quality: 'good', sort: 'newest' }, { origin: 'agentscore', quality: 'all', sort: 'backing' }] as const) {
      expect(parseListFilters(params(listFiltersSearch('', f)))).toEqual(f)
    }
  })
})

describe('/agents wires them (source guards — no DOM in this env)', () => {
  const page = readFileSync(path.join(__dirname, '../../app/agents/page.tsx'), 'utf8')

  it('tabs and header read the same corpus counts object', () => {
    expect(page).toMatch(/const originTotals = corpusTotals\(corpusCounts\)/)
    expect(page).toMatch(/agentListHeaderSegments\(\{ \.\.\.corpusCounts, freshness:/)
    expect(page).toMatch(/\{originTotals\[o\.id\] \?\? '—'\}/)
    expect(page).toMatch(/role="tab"\s+aria-selected=\{active\}/)
  })

  it('quality is one dropdown built from qualityOptions, disabled options kept; the old chip row is gone', () => {
    expect(page).toMatch(/<option key=\{o\.id\} value=\{o\.id\} disabled=\{o\.disabled\}>\{qualityOptionText\(o\)\}<\/option>/)
    expect(page).toMatch(/qualityOptions\(listLoaded \? listRows\.enriched\.map\(e => e\.bucket\) : null\)/)
    expect(page).not.toMatch(/setSelectedCategory|selectedCategory/)
  })

  it('a filter change writes the URL; the URL sets the filters', () => {
    expect(page).toMatch(/listFiltersSearch\(window\.location\.search, f\)/)
    expect(page).toMatch(/window\.history\.replaceState\(/)
    expect(page).toMatch(/useState<OriginFilter>\(\(\) => parseListFilters\(searchParams\)\.origin\)/)
    expect(page).toMatch(/useState<QualityFilter>\(\(\) => parseListFilters\(searchParams\)\.quality\)/)
  })
})
