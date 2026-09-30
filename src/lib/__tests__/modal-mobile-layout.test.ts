import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Etap 4b-finish commit 3 — the modal at 390 px (4b-list §6 #1, #5). The live assertion is the
 * shots harness (tests/e2e/screenshots.spec.ts modalFitsPhone: every tab on screen, ≥44 px,
 * clickable; nothing past the viewport on any tab). CI runs no browser, so this guards the three
 * layout facts that assertion depends on.
 */

const page = readFileSync(path.join(__dirname, '../../app/agents/page.tsx'), 'utf8')
const timeline = readFileSync(path.join(__dirname, '../../components/agents/TrustTimeline.tsx'), 'utf8')

describe('agent modal on a phone', () => {
  it('the tab strip never clips a tab: a scrollable tablist of ≥44 px tabs, the selected one marked', () => {
    const strip = page.slice(page.indexOf('role="tablist"') - 200, page.indexOf('{/* Overview Tab */}'))
    expect(strip).toMatch(/className="[^"]*\boverflow-x-auto\b/)
    expect(strip).toMatch(/role="tab"/)
    expect(strip).toMatch(/aria-selected=\{activeTab === tab\.id\}/)
    expect(strip).toMatch(/min-h-\[(4[4-9]|[5-9]\d)px\]/)
    // The old strip was a non-wrapping row inside an overflow-hidden card: Timeline was cut off.
    expect(page.slice(page.indexOf('=== TABS:'), page.indexOf('role="tablist"'))).not.toMatch(/overflow-hidden/)
  })

  it('the Timeline tab renders inside the tab card, like the other three', () => {
    const cardBody = page.slice(page.indexOf('role="tablist"'), page.indexOf('{/* === REPORT SECTION === */}'))
    expect(cardBody).toMatch(/activeTab === 'timeline'[\s\S]*<TrustTimeline[\s\S]*\}\)\(\)\}\s*<\/div>\s*$/)
  })

  it('two-column blocks stack below their breakpoint: Timeline chart/events (the score block is one column under Details now)', () => {
    // Etap 5b: the two-column AGENTSCORE + STAKE BREAKDOWN card became rows in the collapsed Details.
    expect(page).not.toMatch(/=== AGENTSCORE \+ STAKE BREAKDOWN ===/)
    expect(page).toMatch(/<AgentDetails termId=\{selectedAgent\.term_id\}[^>]*>\s*<ScoreParts view=/)
    expect(timeline).toMatch(/hasChart \? 'grid-cols-1 md:grid-cols-2/)
    expect(timeline).not.toMatch(/hasChart \? 'grid-cols-2'/)
  })
})
