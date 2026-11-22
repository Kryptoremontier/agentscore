/**
 * The app's navigation, in one place (REPO_MAP §7 rule 4). Etap 9c: the left menu is back, with the
 * three jobs on top —
 *   "Start": Check an agent · Trust an agent · For developers (PRIMARY_NAV);
 *   "More" (collapsible, remembered per viewer): every other page (MORE_NAV);
 *   "Admin" for the admin wallet (ADMIN_NAV), gated where it is rendered.
 * The phone: the same three as bottom tabs, plus a "More" sheet with the same list. The footer group
 * "More from AgentScore" (FOOTER_MORE; components/layout/Footer.tsx) stays on every page.
 */

import {
  SearchCheck, HandHeart, Code2, Trophy, Zap, MessageSquare, Target, Crown, Hammer, PenSquare, Plus,
  ShieldAlert, Bug, Coins, type LucideIcon,
} from 'lucide-react'
import { CHECK_TITLE, DOMAINS_TITLE, LANDING_CTA_VOUCH } from '@/lib/people-copy'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  color: string
  badge?: string
}

export const HOW_IT_WORKS_HREF = '/#how-it-works'

/** The active item's colour — the accent (Etap 6b, globals.css --accent), whatever the item's own colour. */
export const ACCENT = 'rgb(var(--accent))'

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/check', label: CHECK_TITLE, icon: SearchCheck, color: '#C8963C' },
  { href: '/agents', label: LANDING_CTA_VOUCH, icon: HandHeart, color: '#2ECC71' },
  { href: '/docs', label: 'For developers', icon: Code2, color: '#38B6FF' },
]

export const START_LABEL = 'Start'
export const MORE_LABEL = 'More'
export const ADMIN_LABEL = 'Admin'

/** Under "More", in this order (Etap 9c). */
export const MORE_NAV: readonly NavItem[] = [
  { href: '/domains', label: DOMAINS_TITLE, icon: Trophy, color: '#8B5CF6' },
  { href: '/skills', label: 'Skills', icon: Zap, color: '#2EE6D6' },
  { href: '/claims', label: 'Claims', icon: MessageSquare, color: '#38B6FF' },
  { href: '/evaluators', label: 'Evaluators', icon: Target, color: '#F59E0B' },
  { href: '/leaderboard', label: 'Leaderboard', icon: Crown, color: '#C8963C' },
  { href: '/explore/intuforge', label: 'IntuForge', icon: Hammer, color: '#C8963C' },
  { href: '/register', label: 'Register an agent', icon: PenSquare, color: '#C8963C' },
  { href: '/register?tab=skill', label: 'Register a skill', icon: Zap, color: '#2EE6D6' },
  { href: '/claims?create=true', label: 'Create claim', icon: Plus, color: '#B5BDC6' },
]

/** The admin wallet's pages (rendered only for it; the pages themselves sit behind AdminGuard). */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: '/admin/predicates', label: 'Predicates', icon: ShieldAlert, color: '#C8963C' },
  { href: '/admin/feedback', label: 'Bug Reports', icon: Bug, color: '#EF4444' },
  { href: '/admin/fees', label: 'Fees', icon: Coins, color: '#C8963C' },
]

/** Is the current page one of More's? Then the sidebar opens More, so the page's item is visible. */
export function isUnderMore(pathname: string, search = ''): boolean {
  return MORE_NAV.some((i) => isNavActive(i.href, pathname, search))
}

/** Where a viewer's "More" open/closed choice is kept (this browser only). */
export const MORE_OPEN_KEY = 'agentscore.nav.more-open'

/** The viewer's remembered choice; null when none (or storage is unavailable). */
export function readMoreOpen(storage: Pick<Storage, 'getItem'> | null | undefined): boolean | null {
  try {
    const v = storage?.getItem(MORE_OPEN_KEY)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

export function writeMoreOpen(storage: Pick<Storage, 'setItem'> | null | undefined, open: boolean): void {
  try { storage?.setItem(MORE_OPEN_KEY, open ? '1' : '0') } catch { /* private mode: not remembered */ }
}

/** Browser storage, or null where there is none (server, blocked storage). */
export function viewerStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export const FOOTER_MORE_HEADING = 'More from AgentScore'

/**
 * Every page the old "More" menu reached, as footer links (Etap 9): Skills, Claims, Evaluators,
 * Leaderboard, IntuForge, Register a skill and Create claim — and the three that were beside them
 * (How it works, Trust contexts, Register an agent), so nothing loses its link.
 */
export const FOOTER_MORE: ReadonlyArray<{ href: string; label: string }> = [
  { href: HOW_IT_WORKS_HREF, label: 'How it works' },
  { href: '/domains', label: DOMAINS_TITLE },
  { href: '/skills', label: 'Skills' },
  { href: '/claims', label: 'Claims' },
  { href: '/evaluators', label: 'Evaluators' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/explore/intuforge', label: 'IntuForge' },
  { href: '/register', label: 'Register an agent' },
  { href: '/register?tab=skill', label: 'Register a skill' },
  { href: '/claims?create=true', label: 'Create claim' },
]

/**
 * Is this nav item the current page? `/#how-it-works` is the landing's section: active on `/`.
 * Query-string items (`/register?tab=skill`) match their own query only.
 */
export function isNavActive(href: string, pathname: string, search = ''): boolean {
  if (href === HOW_IT_WORKS_HREF) return pathname === '/'
  const [path, query] = href.split('?')
  if (query) return pathname === path && new URLSearchParams(search).toString().includes(query)
  if (path === '/register' && new URLSearchParams(search).get('tab') === 'skill') return false
  return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))
}
