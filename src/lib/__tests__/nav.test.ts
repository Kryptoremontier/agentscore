/**
 * Etap 5b Run 2 commit 2 — three places: Agents · How it works · For developers; everything else
 * under More; Create Claim and Register leave the top bar; the phone's bottom nav is Agents · How
 * it works · More. No route is removed — every page the old nav reached is still reachable.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PRIMARY_NAV, MORE_NAV, HOW_IT_WORKS_HREF, isNavActive, isUnderMore } from '../../components/layout/nav-items'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the nav model', () => {
  it('three primary places, in order', () => {
    expect(PRIMARY_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Agents', '/agents'], ['How it works', '/#how-it-works'], ['For developers', '/docs'],
    ])
  })

  it('no route removed: every page the old nav linked is still in the nav (primary, More, or the profile link)', () => {
    const inNav = new Set([...PRIMARY_NAV, ...MORE_NAV.flatMap((g) => g.items)].map((i) => i.href))
    const OLD = ['/agents', '/skills', '/domains', '/claims', '/explore/intuforge', '/evaluators', '/leaderboard', '/docs', '/register', '/register?tab=skill', '/claims?create=true']
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
  it('phone: Agents · How it works · More; "For developers" first in the More sheet', () => {
    const mobile = code('components/layout/MobileNav.tsx')
    expect(mobile).toMatch(/const BOTTOM_TABS = PRIMARY_NAV\.filter\(item => item\.href !== '\/docs'\)/)
    expect(mobile).toMatch(/grid grid-cols-3 h-16/)
    expect(mobile).toMatch(/\{ label: 'For developers', items: PRIMARY_NAV\.filter\(item => item\.href === '\/docs'\) \},\s*\.\.\.MORE_NAV/)
  })
})
