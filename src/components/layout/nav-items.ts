/**
 * The app's navigation, in one place. Etap 9, one job: the nav is three places — Check an agent,
 * Trust an agent (the agent list, where trusting happens), For developers — on the desktop sidebar
 * and the phone's bottom nav alike (REPO_MAP §7 rule 4). Everything else is not nav any more: it
 * lives in the footer, under "More from AgentScore" (FOOTER_MORE; components/layout/Footer.tsx),
 * on every page. No route is removed; the admin links stay gated where they are rendered.
 */

import { SearchCheck, HandHeart, Code2, type LucideIcon } from 'lucide-react'
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
