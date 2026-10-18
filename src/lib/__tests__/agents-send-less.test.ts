/**
 * Etap 7a commit 4 — /agents sends less. The list answer carried every cohort agent's identity link
 * and declarations (only the modal shows them) and an empty attestation list per cohort agent; the
 * page drew all 272 cards at once and loaded recharts (~290 kB), the attest flow and the Back/Sell
 * panel with the list although only a modal uses them.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { LIST_PAGE_SIZE } from '../agent-list'
import { showMoreAgents } from '../people-copy'
import { MODAL_HEADER_PARTS, MODAL_REST_PARTS } from '../agents-page-types'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const client = code('app/agents/agents-client.tsx')

describe('the first 48 rows, then "Show N more"', () => {
  it('48 rows of the current order; the button adds the next ones; the counts stay full', () => {
    expect(LIST_PAGE_SIZE).toBe(48)
    expect(showMoreAgents(48)).toBe('Show 48 more')
    expect(client).toMatch(/const visible = sorted\.slice\(0, shownCount\)/)
    expect(client.match(/\{visible\.map\(\(\{ agent, trust: cardTrust, measured, noScoreTip \}/g)).toHaveLength(2) // grid and list
    expect(client).not.toMatch(/\{sorted\.map\(\(\{ agent/)
    expect(client).toMatch(/agentResultsLine\(sorted\.length, listRows\.sourceCount\)/) // the results line counts every row
    expect(client).toMatch(/onClick=\{\(\) => setShownCount\(\(n\) => n \+ LIST_PAGE_SIZE\)\}/)
    expect(client).toMatch(/showMoreAgents\(Math\.min\(LIST_PAGE_SIZE, sorted\.length - visible\.length\)\)/)
  })

  it('back to one page when the view changes (tab, backing level, sort, search)', () => {
    expect(client).toMatch(/useEffect\(\(\) => \{ setShownCount\(LIST_PAGE_SIZE\) \}, \[originFilter, qualityFilter, sortBy, searchTerm\]\)/)
  })
})

describe('the modal\'s heavy parts load with a modal, not with the list', () => {
  it('no static import of recharts, the timeline charts, the attest flow or the Back/Sell panel', () => {
    expect(client).not.toMatch(/from 'recharts'/)
    for (const m of ['agents/TrustTimeline', 'attest/AttestStickyBar', 'profile/AttestedDomains', 'profile/BackThisAgentSection', 'agents/BondingCurveChart']) {
      expect(client, m).not.toMatch(new RegExp(`^import [^\\n]*'@/components/${m}'`, 'm'))
      expect(client, m).toMatch(new RegExp(`import\\('@/components/${m}'\\)`))
    }
    expect(client.match(/= dynamic\(/g)?.length).toBeGreaterThanOrEqual(6)
    expect(code('components/agents/BondingCurveChart.tsx')).toMatch(/from 'recharts'/)
  })

  it('loaded on intent: a card pointed at or focused, and any modal that opens (a deep link too)', () => {
    expect(client.match(/onPointerEnter=\{preloadModal\}\s*onFocus=\{preloadModal\}/g)).toHaveLength(3) // compact, full, list row
    expect(client).toMatch(/if \(!selectedAgent\) return\s*preloadModal\(\)/)
  })
})

describe('a cohort agent\'s identity link and declarations come with its modal', () => {
  it('a part of its own, never in front of the header', () => {
    expect(MODAL_REST_PARTS).toContain('identity')
    expect(MODAL_HEADER_PARTS as readonly string[]).not.toContain('identity')
  })

  it('on its way → nothing drawn; failed → "couldn\'t read" (null), never "declares nothing"', () => {
    expect(client).toMatch(/if \(!part\) return undefined\s*return part\.status === 'ok' \? part\.value : null/)
    expect(client).toMatch(/<DeclaredDomains declaredDomains=\{cohortIdentity === undefined \? undefined : cohortIdentity === null \? null : cohortIdentity\.declaredDomains\}/)
    expect(client).toMatch(/caipIdentity=\{cohortIdentity\?\.caipIdentity\}/)
  })

  it('read from the same cached cohort; not a cohort agent (null) only from a cohort read to the end', () => {
    const data = code('lib/agents-page-data.ts')
    expect(data).toMatch(/export async function cohortIdentityOf\(termId: string\)[\s\S]*?await loadErc8004Cohort\(\)[\s\S]*?if \(c\.truncated !== false\) throw/)
  })
})
