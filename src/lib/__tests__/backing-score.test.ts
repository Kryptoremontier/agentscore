/**
 * Etap 5b Run 1 commit 2 — backing score, one number (score decision A). The vault-based number is
 * renamed "Backing score", small and neutral on every agent surface; who vouches is the headline.
 * No scoring formula, calculateAgentTier, API field or scoreBasis rule changes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BackingScore } from '../../components/agents/BackingScore'
import { ScoreParts } from '../../components/profile/ScoreParts'
import { NO_STAKE_TOOLTIP } from '../score-basis'

const SRC = path.join(__dirname, '..', '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')
const code = (f: string) => strip(readFileSync(path.join(SRC, f), 'utf8'))
const PAGE_RAW = readFileSync(path.join(SRC, 'app/agents/page.tsx'), 'utf8')
const PAGE = strip(PAGE_RAW)
const PROFILE = code('app/agents/[id]/page.tsx')
/** The score colours the card and modal used: excellent/good(gold)/moderate/low/critical and the greens. */
const LEVEL_COLOURS = /#34d399|#C8963C|#eab308|#EAB308|#f97316|#F97316|#ef4444|#EF4444|#2ECC71|#22C55E|#22c55e/

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)
const text = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'")

describe('<BackingScore> — small, neutral, "—" without a measurement', () => {
  it('card: "Backing 58"; stat row: "Backing score 58"; list row: the number under its column', () => {
    expect(text(html(createElement(BackingScore, { value: 57.6 })))).toBe('Backing58')
    expect(text(html(createElement(BackingScore, { value: 98, variant: 'line' })))).toBe('Backing score98')
    expect(text(html(createElement(BackingScore, { value: 98, variant: 'value' })))).toBe('98')
  })
  it('no measurement → "—" with the reason as its title; never a 0 or the 50 prior', () => {
    const h = html(createElement(BackingScore, { value: null, tip: NO_STAKE_TOOLTIP }))
    expect(text(h)).toBe('Backing—')
    expect(h).toContain(`title="${NO_STAKE_TOOLTIP}"`)
  })
  it('one neutral colour whatever the value — no green/gold/level colour, no level word', () => {
    for (const v of [5, 35, 55, 75, 95]) {
      const h = html(createElement(BackingScore, { value: v }))
      expect(h).not.toMatch(LEVEL_COLOURS)
      expect(text(h)).not.toMatch(/Excellent|Good|Moderate|Low|Critical/)
    }
  })
})

describe('<ScoreParts> — the parts under Details', () => {
  it('Trust Score (= the backing score) / Composite / Hybrid and the stake split; "—" when not measured; neutral', () => {
    const h = html(createElement(ScoreParts, { view: { trustScore: null, composite: null, hybrid: null, supportWei: 0n, opposeWei: 0n, supportPct: null } }))
    const t = text(h)
    expect(t).toContain('Trust Score — the backing score—')
    expect(t).toContain('Composite (quality)—')
    expect(t).toContain('Hybrid — 60% Trust Score + 40% Composite—')
    expect(t).toContain('Net+0.0000 tTRUST')
    expect(h).not.toMatch(LEVEL_COLOURS)
    const m = text(html(createElement(ScoreParts, { view: { trustScore: 98, composite: 50, hybrid: 78.8, supportWei: 335_100_000_000_000_000n, opposeWei: 0n, supportPct: 100 } })))
    expect(m).toContain('Trust Score — the backing score98')
    expect(m).toContain('Support (100.0%)0.3351 tTRUST')
  })
})

describe('the card and the list row', () => {
  // Sliced on the raw source (the markers are comments), then comments stripped.
  const grid = strip(PAGE_RAW.slice(PAGE_RAW.indexOf('── GRID VIEW ──'), PAGE_RAW.indexOf('── LIST VIEW ──')))
  const list = strip(PAGE_RAW.slice(PAGE_RAW.indexOf('── LIST VIEW ──'), PAGE_RAW.indexOf('{/* Agent Detail Modal */}')))
  it('the backing number is the measured trust score, drawn by <BackingScore> — no level colour, no modal cache', () => {
    expect(grid.length).toBeGreaterThan(1000)
    for (const view of [grid, list]) {
      expect(view).toMatch(/const displayScore = measuredScore\(cardTrust, measured\)/)
      expect(view).toMatch(/<BackingScore value=\{displayScore\} tip=\{noScoreTip\}/)
      expect(view).not.toMatch(/effectiveLevel|getHybridLevel|getMomentumIndicator/)
      // The level ternary's colours (gold stays: the brand hover border and the people line).
      expect(view).not.toMatch(/'#34d399'|'#eab308'|'#f97316'|'#ef4444'|style=\{\{ color \}\}/)
      expect(view).not.toMatch(/AGENTSCORE|NO SCORE/)
    }
  })
  it('the people line is the grid card\'s headline (text-sm); compact cards show "Backing —" too', () => {
    expect(grid.match(/onAttest=\{\(\) => openAgentAtAttested\(agent\)\} size="sm"/g)).toHaveLength(2) // compact + full
    const compact = grid.slice(grid.indexOf('if (isCompactCard({ vaultRead }))'), grid.indexOf('data-card="full"'))
    expect(compact).toMatch(/\{backing\}/)
  })
  it('"Backing level" replaces "Quality": the same buckets, after the sort, muted', () => {
    expect(PAGE).toMatch(/aria-label=\{BACKING_LEVEL\}/)
    expect(PAGE).not.toMatch(/aria-label="Quality"/)
    expect(PAGE.indexOf('aria-label="Sort"')).toBeLessThan(PAGE.indexOf('aria-label={BACKING_LEVEL}'))
  })
})

describe('the modal and the profile: one backing score, the parts under Details', () => {
  it('modal: the card\'s number (the measured trust score) in the stat row; no second score card, no level scale', () => {
    expect(PAGE).toMatch(/const modalBackingScore = measuredScore\(agentTrust, modalMeasured\)/)
    // A modal open never rewrites a card's number (the old hybrid cache is gone).
    expect(PAGE).not.toMatch(/objectScoreByTermId/)
    expect(PAGE).toMatch(/backing=\{<BackingScore variant="line" value=\{modalBackingScore\} tip=\{noScoreTooltip\(modalStakeReading\)\} \/>\}/)
    expect(PAGE).not.toMatch(/Hybrid Score|>Agent Score<|>Trust Score<|Quality Metrics|Trust Score \(time-weighted\)/)
    expect(PAGE).not.toMatch(/<span>Critical<\/span>|<span>Moderate<\/span>|<span>Excellent<\/span>|\{level \?\? 'unrated'\}/)
  })
  it('profile: the envelope\'s trustScore only when measured (scoreBasis), both tiers render the slot; the parts are Details rows', () => {
    expect(PROFILE).toMatch(/const backingScore = agent\.scoreParts\?\.measured \? Math\.round\(agent\.scoreParts\.trustScore\) : null/)
    expect(PROFILE).toMatch(/value=\{null\} tip=\{NOT_SCORED_TIP\}/)
    expect(code('lib/profile-agent.ts')).toMatch(/measured: apiAgent\.scoreBasis === 'measured'/)
  })
})

describe('what does not change', () => {
  it('API fields: score envelope, scoreBasis and the deprecated agentScore stay on the REST item', () => {
    const api = code('lib/api-data.ts')
    expect(api).toMatch(/score: ScoreEnvelope/)
    expect(api).toMatch(/scoreBasis: ScoreBasis/)
    expect(api).toMatch(/agentScore: number/)
  })
  it('the formulas: 60/40 hybrid and the tier rule are untouched by this commit (same exports)', async () => {
    const hybrid = await import('../hybrid-trust')
    expect(typeof hybrid.calculateHybridScore).toBe('function')
    const tier = await import('../agent-tier')
    expect(tier.AGENT_TIER_LADDER.verified.minAttesters).toBe(3)
  })
})
