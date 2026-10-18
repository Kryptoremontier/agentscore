/**
 * The nav. Etap 7 Run B (the Beta shape): three places — Check an agent · Vouch · For developers;
 * everything else under More, How it works included; the phone's bottom nav is Check an agent ·
 * Vouch · More. Etap 5b Run 2 before it: Create Claim and Register left the top bar. No route is
 * removed — every page the old nav reached is still reachable.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PRIMARY_NAV, MORE_NAV, HOW_IT_WORKS_HREF, isNavActive, isUnderMore } from '../../components/layout/nav-items'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the nav model', () => {
  it('three primary places, in order: Check an agent · Vouch · For developers', () => {
    expect(PRIMARY_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Check an agent', '/check'], ['Vouch', '/agents'], ['For developers', '/docs'],
    ])
  })

  it('How it works moved under More; Skills, Claims, Domains, Evaluators, Leaderboard, IntuForge stay there', () => {
    const more = MORE_NAV.flatMap((g) => g.items).map((i) => i.label)
    expect(more).toEqual(expect.arrayContaining(['How it works', 'Skills', 'Claims', 'Domains', 'Evaluators', 'Leaderboard', 'IntuForge']))
  })

  it('no route removed: every page the old nav linked is still in the nav (primary, More, or the profile link)', () => {
    const inNav = new Set([...PRIMARY_NAV, ...MORE_NAV.flatMap((g) => g.items)].map((i) => i.href))
    const OLD = ['/agents', HOW_IT_WORKS_HREF, '/skills', '/domains', '/claims', '/explore/intuforge', '/evaluators', '/leaderboard', '/docs', '/register', '/register?tab=skill', '/claims?create=true']
    expect(OLD.filter((h) => !inNav.has(h))).toEqual([])
    expect(code('components/layout/Sidebar.tsx')).toMatch(/href="\/profile"/)
    expect(code('components/layout/MobileNav.tsx')).toMatch(/href: '\/profile'/)
  })

  it('every nav link points at a page that exists', () => {
    const hrefs = [...PRIMARY_NAV, ...MORE_NAV.flatMap((g) => g.items)].map((i) => i.href.split(/[?#]/)[0] || '/')
    const pageOf = (h: string) => path.join(SRC, 'app', h === '/' ? '' : h, 'page.tsx')
    expect(hrefs.filter((h) => !existsSync(pageOf(h)))).toEqual([])
    expect(code('components/landing/HowItWorks.tsx')).toMatch(/id="how-it-works"/)
  })

  it('active: the page itself and its sub-pages; How it works on the landing; More opens for its pages', () => {
    expect(isNavActive('/agents', '/agents')).toBe(true)
    expect(isNavActive('/agents', '/agents/0xabc')).toBe(true)
    expect(isNavActive('/agents', '/agentsfoo')).toBe(false)
    expect(isNavActive(HOW_IT_WORKS_HREF, '/')).toBe(true)
    expect(isNavActive(HOW_IT_WORKS_HREF, '/agents')).toBe(false)
    expect(isUnderMore('/domains')).toBe(true)
    expect(isUnderMore('/agents')).toBe(false)
    expect(isUnderMore('/')).toBe(false) // How it works is a landing section: the landing doesn't open More
    expect(isNavActive('/check', '/check/0xabc')).toBe(true)
  })
})

describe('the three surfaces render it', () => {
  it('top bar: logo, search, wallet — no Create Claim, no Register', () => {
    const bar = code('components/layout/Navbar.tsx')
    expect(bar).not.toMatch(/Create Claim|RegisterDropdown|href="\/register|claims\?create/)
    expect(bar).toMatch(/<WalletButton \/>/)
  })
  it('sidebar: the primary three, then More (open on a More page); admin still gated', () => {
    const side = code('components/layout/Sidebar.tsx')
    expect(side).toMatch(/PRIMARY_NAV\.map/)
    expect(side).toMatch(/useState\(\(\) => isUnderMore\(pathname\)\)/)
    expect(side).toMatch(/\{moreOpen && \(/)
    expect(side).toMatch(/\{isAdmin && \(/)
    expect(side).toMatch(/const isAdmin = mounted && isAdminWallet\(address\)/)
  })
  it('phone: Check an agent · Vouch · More; "For developers" first in the More sheet', () => {
    const mobile = code('components/layout/MobileNav.tsx')
    expect(mobile).toMatch(/const BOTTOM_TABS = PRIMARY_NAV\.filter\(item => item\.href !== '\/docs'\)/)
    expect(mobile).toMatch(/grid grid-cols-3 h-16/)
    expect(mobile).toMatch(/\{ label: 'For developers', items: PRIMARY_NAV\.filter\(item => item\.href === '\/docs'\) \},\s*\.\.\.MORE_NAV/)
  })
})
