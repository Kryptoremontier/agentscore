/**
 * Etap 6 commit 4 — the last internal words on screen. The /agents status line says how many
 * agents and how fresh ("272 agents, live"); its breakdown and the hidden-fixtures count sit in
 * the line's popover (still there, never dropped). "via AgentScore" only where it tells something
 * (not inside the AgentScore tab). A pre-canonical skill claim reads "Skill added: watch" on
 * screen, its raw text in the entry's details — and the REST/MCP timeline keeps its words. The
 * Agent Card's "Profile N% complete" bar is shown to the connected owner only.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentScoreCorpusCounts, CohortCorpusCounts } from '../agent-list'
import { buildAgentTimeline } from '../trust-timeline'
import { AGENTS_LIVE } from '../people-copy'
import { agentsStatusText, agentsStatusDetails, AgentsStatusLine } from '../../components/agents/AgentsStatusLine'
import { timelineEntryView } from '../../components/agents/timeline-entry'
import { isAgentOwner } from '../../components/agents/agent-owner'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')

const AS = (over: Partial<AgentScoreCorpusCounts> = {}): AgentScoreCorpusCounts =>
  ({ status: 'ok', kept: 9, junk: 6, fetched: 15, total: 15, truncated: false, ...over })
const CO = (over: Partial<CohortCorpusCounts> = {}): CohortCorpusCounts =>
  ({ status: 'ok', count: 263, total: 263, truncated: false, ...over })

describe('/agents status line: "272 agents, updated N min ago" (or "live" when fresh)', () => {
  it('fresh → live; stale → how old; loading → "—"', () => {
    expect(agentsStatusText({ agentScore: AS(), cohort: CO(), freshness: AGENTS_LIVE })).toBe('272 agents, live')
    expect(agentsStatusText({ agentScore: AS(), cohort: CO(), freshness: 'Updated 3 min ago' })).toBe('272 agents, updated 3 min ago')
    expect(agentsStatusText({ agentScore: AS({ status: 'loading' }), cohort: CO(), freshness: null })).toBe('— agents')
    expect(agentsStatusText({ agentScore: AS({ kept: 1, junk: 0 }), cohort: CO({ count: 0 }), freshness: AGENTS_LIVE })).toBe('1 agent, live')
  })

  it('a list that couldn\'t be read says which — never a silent smaller number', () => {
    expect(agentsStatusText({ agentScore: AS(), cohort: CO({ status: 'error' }), freshness: AGENTS_LIVE }))
      .toBe('9 agents — couldn’t read the ERC-8004 list right now')
    expect(agentsStatusText({ agentScore: AS({ status: 'error' }), cohort: CO(), freshness: AGENTS_LIVE }))
      .toBe('263 agents — couldn’t read the AgentScore list right now')
  })

  it('the popover: the corpus breakdown and the hidden count, with what "hidden" means — no "GraphQL live feed"', () => {
    const d = agentsStatusDetails({ agentScore: AS(), cohort: CO(), freshness: AGENTS_LIVE })
    expect(d).toEqual([
      '9 AgentScore · 263 ERC-8004 · 6 hidden',
      '6 hidden: test fixtures and duplicate registrations of the same agent — counted here, not shown in the list.',
    ])
    expect(agentsStatusDetails({ agentScore: AS({ junk: 0 }), cohort: CO(), freshness: AGENTS_LIVE })).toEqual(['9 AgentScore · 263 ERC-8004'])
    expect(agentsStatusDetails({ agentScore: AS(), cohort: CO(), freshness: 'Updated 3 min ago' })[0]).toBe('9 AgentScore · 263 ERC-8004 · 6 hidden · Updated 3 min ago')
  })

  it('renders the line as a button (its text is its name) and carries the counts for the harness', () => {
    const html = renderToStaticMarkup(createElement(AgentsStatusLine, { agentScore: AS(), cohort: CO(), freshness: AGENTS_LIVE }))
    expect(html).toContain('data-testid="agents-status"')
    expect(html).toContain('data-total="272"')
    expect(html).toContain('data-agentscore="9"')
    expect(html).toContain('data-erc8004="263"')
    expect(html).toContain('data-hidden="6"')
    expect(html).toContain('data-fresh="live"')
    expect(html).toMatch(/<button type="button"[^>]*aria-haspopup="dialog"[^>]*>272 agents, live<\/button>/)
    expect(html).not.toMatch(/GraphQL live feed/)
  })

  it('the page renders it from the tabs\' own corpus counts', () => {
    const page = code('app/agents/page.tsx')
    expect(page).toMatch(/<AgentsStatusLine \{\.\.\.corpusCounts\} freshness=\{pageView \? feedFreshnessLabel\(pageView\.parts, AGENTS_LIVE, nowTick\) : null\} \/>/)
    expect(page).not.toMatch(/GraphQL live feed|agentListHeaderSegments\(/)
  })
})

describe('"via AgentScore" — only where it tells something', () => {
  it('not inside the AgentScore tab; the ERC-8004 chip stays; every card and row passes the tab', () => {
    const page = code('app/agents/page.tsx')
    expect(page).toMatch(/if \(origin !== 'erc8004' && tab === 'agentscore'\) return null/)
    expect(page.match(/<OriginChip origin=\{agent\.origin\} tab=\{originFilter\} \/>/g)).toHaveLength(2)
    expect(page).not.toMatch(/<OriginChip origin=\{agent\.origin\} \/>/)
  })
})

describe('the timeline: "Skill added: watch"; the raw predicate stays in the details', () => {
  const tl = buildAgentTimeline({
    agentId: '0xa', agentName: 'Luda', createdAt: '2026-06-01T07:58:48+00:00', currentScore: 50, currentTier: null,
    tierMilestones: 'none', stakingEvents: [],
    skillEvents: [
      { tripleId: '0x1', skillId: '0xs', skillName: 'watch', timestamp: '2026-06-02T00:00:00Z' },
      { tripleId: '0x2', skillId: '0xd', skillName: 'Knowledge / Productivity', timestamp: '2026-06-03T00:00:00Z', canonical: true },
    ],
  })
  const legacy = tl.events.find((e) => e.type === 'skill_added')!
  const attested = tl.events.find((e) => e.type === 'domain_attested')!

  it('on screen: "Skill added: watch", no description line, the raw text under Details', () => {
    expect(timelineEntryView(legacy)).toEqual({
      title: 'Skill added: watch',
      description: null,
      details: 'Legacy capability claim created: "Luda has skill watch" (pre-canonical predicate).',
    })
  })

  it('other entries are untouched', () => {
    expect(timelineEntryView(attested)).toEqual({ title: attested.title, description: attested.description, details: null })
  })

  it('REST and MCP keep their words: the builder is unchanged', () => {
    expect(legacy.title).toBe('Skill Claim: watch')
    expect(legacy.description).toMatch(/^Legacy capability claim created: .*\(pre-canonical predicate\)\.$/)
  })

  it('the component renders the view, and the details collapsed', () => {
    const src = code('components/agents/TrustTimeline.tsx')
    expect(src).toMatch(/const view = timelineEntryView\(event\)/)
    expect(src).toMatch(/\{view\.title\}/)
    expect(src).toMatch(/<details[^>]*data-testid="timeline-details"/)
    expect(src).not.toMatch(/\{event\.title\}|\{event\.description\}/)
  })
})

describe('the Agent Card\'s "Profile N% complete" bar — the connected owner only', () => {
  const ATOM = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
  const BORN = '2026-06-01T07:58:48+00:00'
  const OWNER = '0xCbdE65F69574C94f0c3Ba7927E3D5Eb7d921FfEd' // Luda's registrant, live (first position = the atom's created_at)
  const positions = [
    { term_id: ATOM, account_id: OWNER, created_at: BORN },
    { term_id: ATOM, account_id: '0x2c55cEEa12675B91839585E8452b64a20841c3B8', created_at: '2026-07-01T00:00:00+00:00' },
    { term_id: '0xcounter', account_id: '0x1111111111111111111111111111111111111111', created_at: BORN },
  ]
  const base = { atomId: ATOM, atomCreatedAt: BORN, positions, registeredHere: false }

  it('the registrant (their position was made with the atom), any address case', () => {
    expect(isAgentOwner({ ...base, wallet: OWNER })).toBe(true)
    expect(isAgentOwner({ ...base, wallet: OWNER.toLowerCase() })).toBe(true)
  })

  it('not a later backer, not a counter-vault position at the same second, not a visitor, not disconnected', () => {
    expect(isAgentOwner({ ...base, wallet: '0x2c55cEEa12675B91839585E8452b64a20841c3B8' })).toBe(false)
    expect(isAgentOwner({ ...base, wallet: '0x1111111111111111111111111111111111111111' })).toBe(false)
    expect(isAgentOwner({ ...base, wallet: '0x9999999999999999999999999999999999999999' })).toBe(false)
    expect(isAgentOwner({ ...base, wallet: null })).toBe(false)
  })

  it('positions not read → only this browser\'s own registration record counts', () => {
    expect(isAgentOwner({ ...base, wallet: OWNER, positions: null })).toBe(false)
    expect(isAgentOwner({ ...base, wallet: OWNER, positions: null, registeredHere: true })).toBe(true)
    expect(isAgentOwner({ ...base, wallet: null, registeredHere: true })).toBe(false)
  })

  it('the modal wraps the bar in it; the rest of the Agent Card stays for everyone', () => {
    const page = code('app/agents/page.tsx')
    expect(page).toMatch(/\{viewerOwnsAgent && <div className="pt-1" data-testid="profile-completeness">/)
    expect(page).toMatch(/wallet: isConnected \? address : null/)
    expect(page).toMatch(/<h3 className="text-white font-bold text-sm mb-3">Agent Card<\/h3>/)
  })
})
