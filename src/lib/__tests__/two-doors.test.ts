/**
 * Etap 9 commit 6 — two doors, honest emptiness.
 * 1. The hero: a second door under the buttons, "Built an agent? Get your trust link →", to /check
 *    in builder mode (the found card opens on its builder block).
 * 2. /agents: "People trust these (N)", then "Not trusted yet (M)" collapsed; the header's counts
 *    stay the full totals.
 * 3. Card and modal: Backing is under "Details" — no second headline number beside "N people trust it".
 * (§04's contexts are in landing-story.test.ts.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Hero } from '../../components/landing/Hero'
import { CheckBox } from '../../components/check/CheckBox'
import { BuilderDoor } from '../../components/check/BuilderDoor'
import { AgentDetails } from '../../components/profile/AgentDetails'
import { BUILDER_DOOR_HREF, BUILDER_ANCHOR } from '../../components/check/CheckShare'
import { trustSections } from '../agent-list'
import {
  LANDING_DOOR_BUILDER, LANDING_CTA_CHECK, STORY_HOW_LINK, CHECK_BUILDER_NOTE, CHECK_BUILDER_REGISTER,
  agentsTrustedHeading, agentsUntrustedHeading, AGENTS_TRUSTED_NONE, DETAILS_HEADING,
} from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('1 — the hero\'s second door', () => {
  const html = renderToStaticMarkup(createElement(Hero))
  it('"Built an agent? Get your trust link", under the two buttons, to /check in builder mode', () => {
    expect(LANDING_DOOR_BUILDER).toBe('Built an agent? Get your trust link')
    expect(BUILDER_DOOR_HREF).toBe('/check?builder=1')
    const door = html.match(/<a[^>]*data-testid="story-builder-door"[^>]*>/)![0]
    expect(door).toContain('href="/check?builder=1"')
    expect(html.slice(html.indexOf(door))).toContain(LANDING_DOOR_BUILDER)
    const at = (text: string) => html.indexOf(text)
    expect(at(LANDING_CTA_CHECK)).toBeLessThan(at(STORY_HOW_LINK))
    expect(at(STORY_HOW_LINK)).toBeLessThan(at(LANDING_DOOR_BUILDER))
    // The first door stays the primary button; the second is a link, not a third button.
    expect(html.match(/class="btn-primary/g)).toHaveLength(1)
    expect(door).not.toMatch(/btn-primary|btn-secondary/)
  })

  it('/check in builder mode: says what to do, keeps the mode through the search, and offers registering', () => {
    const box = (builder: boolean) => renderToStaticMarkup(createElement(CheckBox, { q: '', builder }))
    expect(box(true)).toContain('<input type="hidden" name="builder" value="1"/>')
    expect(box(false)).not.toContain('name="builder"')
    const page = code('app/check/page.tsx')
    expect(page).toMatch(/const builder = searchParams\.builder !== undefined/)
    expect(page).toMatch(/\{builder && \(\s*<p[^>]*data-testid="check-builder-note">\s*\{CHECK_BUILDER_NOTE\}/)
    expect(page).toMatch(/<Link href="\/register"[^>]*>\{CHECK_BUILDER_REGISTER\}<\/Link>/)
    expect(CHECK_BUILDER_NOTE).toBe('Find your agent. Its card has the trust link and a badge for your README.')
    expect(CHECK_BUILDER_REGISTER).toBe('Not listed yet? Register it')
  })

  it('the found card opens on its builder block', () => {
    expect(BUILDER_ANCHOR).toBe('builder')
    expect(code('app/check/page.tsx')).toMatch(/redirect\(checkPermalink\(lookup\.resolution\.id\) \+ \(builder \? `#\$\{BUILDER_ANCHOR\}` : ''\)\)/)
    const door = renderToStaticMarkup(createElement(BuilderDoor, { id: '0x' + 'ab'.repeat(32), name: 'Luda', people: 2, initialSlug: 'social' }))
    expect(door).toMatch(/<section id="builder" class="scroll-mt-24 /)
  })
})

describe('2 — /agents in two sections', () => {
  const row = (name: string, people: number | null) => ({ name, vouch: people === null ? null : { people, stakeWei: 0n } })

  it('who people trust, then the rest — each in the order it came in', () => {
    const sorted = [row('Luda', 2), row('Dackie', 1), row('Open Claw', 0), row('Talaria', 0)]
    const s = trustSections(sorted)!
    expect(s.trusted.map((r) => r.name)).toEqual(['Luda', 'Dackie'])
    expect(s.untrusted.map((r) => r.name)).toEqual(['Open Claw', 'Talaria'])
    expect(s.trusted.length + s.untrusted.length).toBe(sorted.length) // nothing dropped
  })

  it('a row whose trust was not read is neither: the list stays one list (no "Not trusted yet" claim)', () => {
    expect(trustSections([row('Luda', 2), row('Unread', null)])).toBeNull()
    expect(trustSections([])).toEqual({ trusted: [], untrusted: [] })
  })

  it('the headings carry the counts', () => {
    expect(agentsTrustedHeading(3)).toBe('People trust these (3)')
    expect(agentsUntrustedHeading(269)).toBe('Not trusted yet (269)')
    expect(AGENTS_TRUSTED_NONE).toBe('Nobody trusts an agent in this view yet. Open one below and be the first.')
  })

  const client = code('app/agents/agents-client.tsx')
  it('the page: trusted first, the rest collapsed until asked for — or until someone searches or filters', () => {
    expect(client).toMatch(/const sections = trustSections\(sorted\)/)
    expect(client).toMatch(/const \[untrustedShown, setUntrustedShown\] = useState<boolean \| null>\(null\)/)
    expect(client).toMatch(/const untrustedOpen = untrustedShown \?\? \(searchTerm\.trim\(\) !== '' \|\| qualityFilter !== 'all'\)/)
    expect(client).toMatch(/data-testid="agents-trusted"[\s\S]*agentsTrustedHeading\(sections\.trusted\.length\)[\s\S]*renderRows\(sections\.trusted\)/)
    expect(client).toMatch(/data-testid="agents-untrusted"[\s\S]*aria-expanded=\{untrustedOpen\}[\s\S]*agentsUntrustedHeading\(sections\.untrusted\.length\)/)
    expect(client).toMatch(/\{untrustedOpen && \(\s*<div id="agents-untrusted-rows">\s*\{renderRows\(sections\.untrusted\.slice\(0, shownCount\)\)\}/)
    // The trusted section before the untrusted one.
    expect(client.indexOf('data-testid="agents-trusted"')).toBeLessThan(client.indexOf('data-testid="agents-untrusted"'))
  })

  it('the header\'s counts stay the full totals: the results line and the tabs never read the sections', () => {
    expect(client).toMatch(/agentResultsLine\(sorted\.length, listRows\.sourceCount\)/)
    const status = client.slice(client.indexOf('data-testid="agents-status"') - 1500, client.indexOf('data-testid="agents-status"') + 1500)
    expect(status).not.toMatch(/sections\.|trustSections/)
    expect(client.match(/sections\.(trusted|untrusted)\.length/g)!.length).toBeGreaterThan(3)
    expect(code('lib/agent-list.ts')).toMatch(/if \(sorted\.some\(\(e\) => !e\.vouch\)\) return null/)
  })
})

describe('3 — Backing under "Details"', () => {
  it('Details is closed by default; the backing score is inside it', () => {
    const closed = renderToStaticMarkup(createElement(AgentDetails, { termId: '0x1', backing: createElement('span', null, 'Backing score 58') }))
    expect(closed).toContain(DETAILS_HEADING)
    expect(closed).toContain('aria-expanded="false"')
    expect(closed).not.toContain('Backing score 58')
    expect(code('components/profile/AgentDetails.tsx')).toMatch(/\{open && \([\s\S]*\{backing && \([\s\S]*data-testid="details-backing"[\s\S]*<AtomIdLine/)
  })

  it('the stat row (modal and profile) has no backing score beside the people boxes', () => {
    const row = code('components/profile/ProfileStatRow.tsx')
    expect(row).not.toMatch(/BackingScore|\{backing\}|backing\?:/)
    expect(row).toMatch(/data-testid="backers-line"/) // the muted sentence stays: who backs it, in words
    for (const f of ['app/agents/agents-client.tsx', 'app/agents/[id]/page.tsx']) expect(code(f)).not.toMatch(/<ProfileStatRow[^>]*backing=/)
  })

  it('the /check card: the header is the name alone; Backing is in a closed <details>', () => {
    const card = code('components/check/CheckResultCard.tsx')
    const header = card.slice(card.indexOf('data-testid="check-name"') - 400, card.indexOf('<AgentTierChip'))
    expect(header).not.toMatch(/BackingScore|term="backing"/)
    expect(card).toMatch(/<details className="[^"]*" data-testid="check-details">\s*<summary[^>]*>\{DETAILS_HEADING\}<\/summary>[\s\S]*<BackingScore value=\{card\.backing\} tip=\{card\.backingTip\} \/>\s*<Explainer term="backing" \/>/)
    expect(card).not.toMatch(/<details[^>]* open/)
  })

  it('the /agents card: the header is name, tier and origin; Backing is in the Details row under the people line', () => {
    const client = code('app/agents/agents-client.tsx')
    const full = client.slice(client.indexOf('data-card="full"'), client.indexOf('── LIST VIEW') > 0 ? client.indexOf('── LIST VIEW') : undefined)
    const header = full.slice(0, full.indexOf('<CardAttesterLine'))
    expect(header).not.toMatch(/\{backing\}/)
    expect(full).toMatch(/data-testid="card-details">\s*<span[^>]*>\{DETAILS_HEADING\}<\/span>\s*\{backing\}/)
  })
})
