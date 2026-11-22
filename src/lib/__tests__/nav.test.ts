/**
 * The nav. Etap 9c: the left menu is back, with the three jobs on top — "Start": Check an agent ·
 * Trust an agent · For developers; "More" (collapsible, remembered per viewer): every other page;
 * "Admin" for the admin wallet. The phone: the three as bottom tabs, plus a "More" sheet with the
 * same list. The footer group "More from AgentScore" stays on every page. No route is removed.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PRIMARY_NAV, MORE_NAV, ADMIN_NAV, START_LABEL, MORE_LABEL, MORE_OPEN_KEY, FOOTER_MORE, FOOTER_MORE_HEADING, HOW_IT_WORKS_HREF,
  isNavActive, isUnderMore, readMoreOpen, writeMoreOpen,
} from '../../components/layout/nav-items'
import { Footer } from '../../components/layout/Footer'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the nav model', () => {
  it('"Start": three places, in order: Check an agent · Trust an agent · For developers', () => {
    expect(START_LABEL).toBe('Start')
    expect(PRIMARY_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Check an agent', '/check'], ['Trust an agent', '/agents'], ['For developers', '/docs'],
    ])
  })

  it('"More": the other pages, in the asked order; none is one of the three', () => {
    expect(MORE_LABEL).toBe('More')
    expect(MORE_NAV.map((i) => i.label)).toEqual([
      'Trust contexts', 'Skills', 'Claims', 'Evaluators', 'Leaderboard', 'IntuForge', 'Register an agent', 'Register a skill', 'Create claim',
    ])
    expect(MORE_NAV.find((i) => i.label === 'Trust contexts')?.href).toBe('/domains')
    expect(new Set(MORE_NAV.map((i) => i.href)).size).toBe(MORE_NAV.length)
    expect(MORE_NAV.filter((i) => PRIMARY_NAV.some((p) => p.href === i.href))).toEqual([])
  })

  it('"Admin": predicates and bug reports', () => {
    expect(ADMIN_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Predicates', '/admin/predicates'], ['Bug Reports', '/admin/feedback'],
    ])
    const pageOf = (h: string) => path.join(SRC, 'app', h, 'page.tsx')
    expect(ADMIN_NAV.filter((i) => !existsSync(pageOf(i.href)))).toEqual([])
  })

  it('More opens on its own pages (so the page is visible), not on the three or the landing', () => {
    expect(isUnderMore('/skills')).toBe(true)
    expect(isUnderMore('/explore/intuforge/abc')).toBe(true)
    expect(isUnderMore('/agents')).toBe(false)
    expect(isUnderMore('/')).toBe(false)
  })

  it('remembered per viewer: read and written in this browser, never throwing', () => {
    const box = new Map<string, string>()
    const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => { box.set(k, v) } }
    expect(readMoreOpen(storage)).toBeNull()
    writeMoreOpen(storage, true)
    expect(box.get(MORE_OPEN_KEY)).toBe('1')
    expect(readMoreOpen(storage)).toBe(true)
    writeMoreOpen(storage, false)
    expect(readMoreOpen(storage)).toBe(false)
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readMoreOpen(blocked)).toBeNull()
    expect(() => writeMoreOpen(blocked, true)).not.toThrow()
    expect(readMoreOpen(null)).toBeNull()
  })

  it('"More from AgentScore": the seven that left the nav, and the three that sat beside them', () => {
    expect(FOOTER_MORE_HEADING).toBe('More from AgentScore')
    const labels = FOOTER_MORE.map((i) => i.label)
    expect(labels).toEqual(expect.arrayContaining(['Skills', 'Claims', 'Evaluators', 'Leaderboard', 'IntuForge', 'Register a skill', 'Create claim']))
    expect(labels).toEqual(expect.arrayContaining(['How it works', 'Trust contexts', 'Register an agent']))
    expect(FOOTER_MORE.find((i) => i.label === 'Trust contexts')?.href).toBe('/domains')
    expect(new Set(FOOTER_MORE.map((i) => i.href)).size).toBe(FOOTER_MORE.length)
    // None of them is one of the three places.
    expect(FOOTER_MORE.filter((i) => PRIMARY_NAV.some((p) => p.href === i.href))).toEqual([])
  })

  it('no route removed: every page the old nav linked is still linked (the nav, the footer group, or the profile link)', () => {
    const linked = new Set([...PRIMARY_NAV, ...MORE_NAV, ...FOOTER_MORE].map((i) => i.href))
    const OLD = ['/agents', HOW_IT_WORKS_HREF, '/skills', '/domains', '/claims', '/explore/intuforge', '/evaluators', '/leaderboard', '/docs', '/register', '/register?tab=skill', '/claims?create=true', '/check']
    expect(OLD.filter((h) => !linked.has(h))).toEqual([])
    expect(code('components/layout/Sidebar.tsx')).toMatch(/href="\/profile"/)
    expect(code('components/wallet/WalletButton.tsx')).toMatch(/href="\/profile"/) // the phone's way to My Profile: the top bar
  })

  it('every link points at a page that exists', () => {
    const hrefs = [...PRIMARY_NAV, ...MORE_NAV, ...FOOTER_MORE].map((i) => i.href.split(/[?#]/)[0] || '/')
    const pageOf = (h: string) => path.join(SRC, 'app', h === '/' ? '' : h, 'page.tsx')
    expect(hrefs.filter((h) => !existsSync(pageOf(h)))).toEqual([])
    expect(code('components/landing/HowItWorks.tsx')).toMatch(/id="how-it-works"/)
  })

  it('active: the page itself and its sub-pages', () => {
    expect(isNavActive('/agents', '/agents')).toBe(true)
    expect(isNavActive('/agents', '/agents/0xabc')).toBe(true)
    expect(isNavActive('/agents', '/agentsfoo')).toBe(false)
    expect(isNavActive(HOW_IT_WORKS_HREF, '/')).toBe(true)
    expect(isNavActive(HOW_IT_WORKS_HREF, '/agents')).toBe(false)
    expect(isNavActive('/check', '/check/0xabc')).toBe(true)
    expect(isNavActive('/docs', '/domains')).toBe(false)
  })
})

describe('the surfaces render it', () => {
  it('top bar: logo, search, wallet — no Create Claim, no Register', () => {
    const bar = code('components/layout/Navbar.tsx')
    expect(bar).not.toMatch(/Create Claim|RegisterDropdown|href="\/register|claims\?create/)
    expect(bar).toMatch(/<WalletButton \/>/)
  })
  it('sidebar: Start (the three), More (collapsible, remembered), Admin (gated)', () => {
    const side = code('components/layout/Sidebar.tsx')
    expect(side).toMatch(/<GroupLabel label=\{START_LABEL\} first \/>\s*\{PRIMARY_NAV\.map/)
    expect(side).toMatch(/aria-expanded=\{moreOpen\}/)
    expect(side).toMatch(/\{moreOpen && \([\s\S]*MORE_NAV\.map/)
    expect(side).toMatch(/readMoreOpen\(viewerStorage\(\)\)/)
    expect(side).toMatch(/writeMoreOpen\(viewerStorage\(\), !open\)/)
    expect(side).toMatch(/\{isAdmin && \([\s\S]*ADMIN_NAV\.map/)
    expect(side).toMatch(/const isAdmin = mounted && isAdminWallet\(address\)/)
    // Order on screen: Start, then More, then Admin.
    expect(side.indexOf('PRIMARY_NAV.map')).toBeLessThan(side.indexOf('MORE_NAV.map'))
    expect(side.indexOf('MORE_NAV.map')).toBeLessThan(side.indexOf('ADMIN_NAV.map'))
  })
  it('phone: the three tabs plus "More", a sheet with the same list (Admin only for the admin wallet)', () => {
    const mobile = code('components/layout/MobileNav.tsx')
    expect(mobile).toMatch(/grid grid-cols-4 h-16/)
    expect(mobile).toMatch(/\{PRIMARY_NAV\.map\(tab => \{/)
    expect(mobile).toMatch(/data-testid="bottom-nav-more"/)
    expect(mobile).toMatch(/\{ label: MORE_LABEL, items: MORE_NAV \}/)
    expect(mobile).toMatch(/\.\.\.\(isAdmin \? \[\{ label: ADMIN_LABEL, items: ADMIN_NAV \}\] : \[\]\)/)
    expect(mobile).toMatch(/const isAdmin = mounted && isAdminWallet\(address\)/)
  })
  it('footer: the group, on every page (the root layout), each link an <a>; Report a bug is there too', () => {
    const html = renderToStaticMarkup(createElement(Footer))
    expect(html).toContain('data-testid="footer-more"')
    expect(html).toContain(`>${FOOTER_MORE_HEADING}</h4>`)
    const group = html.slice(html.indexOf('data-testid="footer-more"'))
    for (const item of FOOTER_MORE) expect(group, item.label).toContain(`href="${item.href.replace(/&/g, '&amp;')}"`)
    for (const label of ['Skills', 'Claims', 'Evaluators', 'Leaderboard', 'IntuForge', 'Register a skill', 'Create claim']) expect(group).toContain(`>${label}</a>`)
    expect(group).toContain('data-testid="report-bug"')
    // Its own stacking context under the page's: an open agent modal is never under the footer.
    expect(html).toMatch(/<footer class="relative z-0 overflow-hidden"/)
    // The two older groups are still there.
    expect(html).toMatch(/>Build<\/h4>[\s\S]*>Connect<\/h4>/)
    expect(code('app/layout.tsx')).toMatch(/<Footer \/>/)
  })
})
