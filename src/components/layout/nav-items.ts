/**
 * The app's navigation, in one place (Etap 5b Run 2): three primary places — Agents, How it
 * works, For developers — and everything else under More. The desktop sidebar and the phone's
 * bottom nav + More sheet both render from here (REPO_MAP §7 rule 4). No route is removed; the
 * admin links stay gated where they are rendered.
 */

import {
  Bot, BookOpenCheck, Code2, Zap, Trophy, MessageSquare, Hammer, Target, Crown, Plus, PenSquare,
  type LucideIcon,
} from 'lucide-react'

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
  { href: '/agents', label: 'Agents', icon: Bot, color: '#C8963C' },
  { href: HOW_IT_WORKS_HREF, label: 'How it works', icon: BookOpenCheck, color: '#2ECC71' },
  { href: '/docs', label: 'For developers', icon: Code2, color: '#38B6FF' },
]

export const MORE_LABEL = 'More'

/** Under More, grouped. Create Claim and Register live here now, not in the top bar. */
export const MORE_NAV: ReadonlyArray<{ label: string; items: readonly NavItem[] }> = [
  {
    label: 'Explore',
    items: [
      { href: '/skills', label: 'Skills', icon: Zap, color: '#2EE6D6' },
      { href: '/domains', label: 'Domains', icon: Trophy, color: '#8B5CF6' },
      { href: '/claims', label: 'Claims', icon: MessageSquare, color: '#38B6FF' },
      { href: '/evaluators', label: 'Evaluators', icon: Target, color: '#F59E0B' },
      { href: '/leaderboard', label: 'Leaderboard', icon: Crown, color: '#C8963C' },
      { href: '/explore/intuforge', label: 'IntuForge', icon: Hammer, color: '#C8963C', badge: 'NEW' },
    ],
  },
  {
    label: 'Create',
    items: [
      { href: '/claims?create=true', label: 'Create claim', icon: Plus, color: '#B5BDC6' },
      { href: '/register', label: 'Register an agent', icon: PenSquare, color: '#C8963C' },
      { href: '/register?tab=skill', label: 'Register a skill', icon: Zap, color: '#2EE6D6' },
    ],
  },
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

/** Is the current page one of More's? (The sidebar opens More then, so the page is visible.) */
export function isUnderMore(pathname: string, search = ''): boolean {
  return MORE_NAV.some((g) => g.items.some((i) => isNavActive(i.href, pathname, search)))
}
