/**
 * The nav. Etap 9, one job: three places — Check an agent · Trust an agent · For developers — on
 * the desktop sidebar and the phone's bottom nav alike. Skills, Claims, Evaluators, Leaderboard,
 * IntuForge, Register a skill and Create claim (and the three that sat beside them under "More")
 * are a footer group, "More from AgentScore", on every page. No route is removed — every page the
 * old nav reached is still reachable.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PRIMARY_NAV, FOOTER_MORE, FOOTER_MORE_HEADING, HOW_IT_WORKS_HREF, isNavActive } from '../../components/layout/nav-items'
import { Footer } from '../../components/layout/Footer'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the nav model', () => {
  it('three places, in order: Check an agent · Trust an agent · For developers — and nothing else', () => {
    expect(PRIMARY_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Check an agent', '/check'], ['Trust an agent', '/agents'], ['For developers', '/docs'],
    ])
    const model = code('components/layout/nav-items.ts')
    expect(model).not.toMatch(/MORE_NAV|MORE_LABEL|isUnderMore/)
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
    const linked = new Set([...PRIMARY_NAV, ...FOOTER_MORE].map((i) => i.href))
    const OLD = ['/agents', HOW_IT_WORKS_HREF, '/skills', '/domains', '/claims', '/explore/intuforge', '/evaluators', '/leaderboard', '/docs', '/register', '/register?tab=skill', '/claims?create=true', '/check']
    expect(OLD.filter((h) => !linked.has(h))).toEqual([])
    expect(code('components/layout/Sidebar.tsx')).toMatch(/href="\/profile"/)
    expect(code('components/wallet/WalletButton.tsx')).toMatch(/href="\/profile"/) // the phone's way to My Profile: the top bar
  })

  it('every link points at a page that exists', () => {
    const hrefs = [...PRIMARY_NAV, ...FOOTER_MORE].map((i) => i.href.split(/[?#]/)[0] || '/')
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
  it('sidebar: the three places, no "More"; admin still gated', () => {
    const side = code('components/layout/Sidebar.tsx')
    expect(side).toMatch(/PRIMARY_NAV\.map/)
    expect(side).not.toMatch(/moreOpen|nav-more|MoreHorizontal|FOOTER_MORE|BugReportModal/)
    expect(side).toMatch(/\{isAdmin && \(/)
    expect(side).toMatch(/const isAdmin = mounted && isAdminWallet\(address\)/)
  })
  it('phone: the same three in the bottom nav — no "More" tab, no sheet', () => {
    const mobile = code('components/layout/MobileNav.tsx')
    expect(mobile).toMatch(/grid grid-cols-3 h-16/)
    expect(mobile).toMatch(/\{PRIMARY_NAV\.map\(tab => \{/)
    expect(mobile).not.toMatch(/menuOpen|AnimatePresence|MORE_|FOOTER_MORE|<button/)
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
