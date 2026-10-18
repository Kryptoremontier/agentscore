/**
 * The app's navigation, in one place. The Beta shape (Etap 7 Run B): three primary places — Check
 * an agent, Vouch (the agent list, where vouching happens), For developers — and everything else
 * under More, How it works included (Etap 5b Run 2 had Agents · How it works · For developers).
 * The desktop sidebar and the phone's bottom nav + More sheet both render from here (REPO_MAP §7
 * rule 4). No route is removed; the admin links stay gated where they are rendered.
 */

import {
  SearchCheck, HandHeart, BookOpenCheck, Code2, Zap, Trophy, MessageSquare, Hammer, Target, Crown, Plus, PenSquare,
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
  { href: '/check', label: 'Check an agent', icon: SearchCheck, color: '#C8963C' },
  { href: '/agents', label: 'Vouch', icon: HandHeart, color: '#2ECC71' },
  { href: '/docs', label: 'For developers', icon: Code2, color: '#38B6FF' },
]

export const MORE_LABEL = 'More'

/** Under More, grouped. Create Claim and Register live here now, not in the top bar. */
export const MORE_NAV: ReadonlyArray<{ label: string; items: readonly NavItem[] }> = [
  {
    label: 'Learn',
    items: [{ href: HOW_IT_WORKS_HREF, label: 'How it works', icon: BookOpenCheck, color: '#2ECC71' }],
  },
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

/**
 * Is the current page one of More's? (The sidebar opens More then, so the page is visible.) How it
 * works is a section of the landing, not a page: the landing doesn't open More.
 */
export function isUnderMore(pathname: string, search = ''): boolean {
  return MORE_NAV.some((g) => g.items.some((i) => i.href !== HOW_IT_WORKS_HREF && isNavActive(i.href, pathname, search)))
}
