import type { BadgeType, BadgeTier, UserBadge, UserStats, ExpertLevel } from '@/types/user'

export interface BadgeRequirement {
  label: string
  check: (stats: UserStats) => boolean
  current: (stats: UserStats) => number
  target: number
  unit?: string
}

export interface BadgeDefinition {
  id: BadgeType
  name: string
  description: string
  icon: string
  color: string
  tier: BadgeTier
  tierLabel: string
  requirements: BadgeRequirement[]
}

function staked(stats: UserStats): number {
  return stats.tTrustStakedNum
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── TIER 1: Newcomer ─────────────────────────────────────
  {
    id: 'newcomer',
    name: 'Newcomer',
    description: 'Completed your first steps on the platform',
    icon: 'Footprints',
    color: 'slate',
    tier: 1,
    tierLabel: 'Tier 1 · Entry',
    requirements: [
      { label: 'On-chain signals', check: s => s.totalSignals >= 1, current: s => s.totalSignals, target: 1 },
      { label: 'Agent registered or position taken', check: s => s.totalAgentsRegistered >= 1 || s.totalPositions >= 1, current: s => Math.max(s.totalAgentsRegistered, s.totalPositions), target: 1 },
    ],
  },

  // ── TIER 2: Getting started ──────────────────────────────
  {
    id: 'pioneer',
    name: 'Pioneer',
    description: 'Registered agents and started building on-chain activity',
    icon: 'Rocket',
    color: 'sky',
    tier: 2,
    tierLabel: 'Tier 2 · Bronze',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 1, current: s => s.totalAgentsRegistered, target: 1 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 5, current: s => s.totalSignals, target: 5 },
      { label: 'Staking positions', check: s => s.totalPositions >= 1, current: s => s.totalPositions, target: 1 },
    ],
  },
  {
    id: 'first_stake',
    name: 'First Stake',
    description: 'Made your first meaningful stake and supported the ecosystem',
    icon: 'Coins',
    color: 'emerald',
    tier: 2,
    tierLabel: 'Tier 2 · Bronze',
    requirements: [
      { label: 'tTRUST staked', check: s => staked(s) >= 0.01, current: s => staked(s), target: 0.01, unit: 'tTRUST' },
      { label: 'On-chain signals', check: s => s.totalSignals >= 3, current: s => s.totalSignals, target: 3 },
      { label: 'Support positions', check: s => s.agentsSupported >= 1, current: s => s.agentsSupported, target: 1 },
    ],
  },

  // ── TIER 3: Active contributor ───────────────────────────
  {
    id: 'builder',
    name: 'Builder',
    description: 'Actively building and evaluating agents across the network',
    icon: 'Blocks',
    color: 'indigo',
    tier: 3,
    tierLabel: 'Tier 3 · Silver',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 3, current: s => s.totalAgentsRegistered, target: 3 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 15, current: s => s.totalSignals, target: 15 },
      { label: 'tTRUST staked', check: s => staked(s) >= 0.05, current: s => staked(s), target: 0.05, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 3, current: s => s.daysActive, target: 3, unit: 'days' },
    ],
  },
  {
    id: 'supporter',
    name: 'Supporter',
    description: 'Diversified staking across multiple agents with meaningful volume',
    icon: 'Heart',
    color: 'pink',
    tier: 3,
    tierLabel: 'Tier 3 · Silver',
    requirements: [
      { label: 'Support positions', check: s => s.agentsSupported >= 3, current: s => s.agentsSupported, target: 3 },
      { label: 'Total positions', check: s => s.totalPositions >= 5, current: s => s.totalPositions, target: 5 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 15, current: s => s.totalSignals, target: 15 },
      { label: 'tTRUST staked', check: s => staked(s) >= 0.1, current: s => staked(s), target: 0.1, unit: 'tTRUST' },
    ],
  },

  // ── TIER 4: Established ──────────────────────────────────
  {
    id: 'networker',
    name: 'Networker',
    description: 'Established a broad trust network with sustained commitment',
    icon: 'Globe',
    color: 'cyan',
    tier: 4,
    tierLabel: 'Tier 4 · Gold',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 5, current: s => s.totalAgentsRegistered, target: 5 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 40, current: s => s.totalSignals, target: 40 },
      { label: 'Total positions', check: s => s.totalPositions >= 8, current: s => s.totalPositions, target: 8 },
      { label: 'tTRUST staked', check: s => staked(s) >= 0.25, current: s => staked(s), target: 0.25, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 7, current: s => s.daysActive, target: 7, unit: 'days' },
    ],
  },
  {
    id: 'guardian',
    name: 'Guardian',
    description: 'Active protector who reports bad actors and supports the ecosystem',
    icon: 'ShieldCheck',
    color: 'orange',
    tier: 4,
    tierLabel: 'Tier 4 · Gold',
    requirements: [
      { label: 'Reports submitted', check: s => s.reportsSubmitted >= 1, current: s => s.reportsSubmitted, target: 1 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 3, current: s => s.totalAgentsRegistered, target: 3 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 25, current: s => s.totalSignals, target: 25 },
      { label: 'Total positions', check: s => s.totalPositions >= 5, current: s => s.totalPositions, target: 5 },
      { label: 'Days active', check: s => s.daysActive >= 7, current: s => s.daysActive, target: 7, unit: 'days' },
    ],
  },

  // ── TIER 5: Expert ───────────────────────────────────────
  {
    id: 'whale',
    name: 'Whale',
    description: 'Major stakeholder with deep commitment to the trust network',
    icon: 'Zap',
    color: 'blue',
    tier: 5,
    tierLabel: 'Tier 5 · Platinum',
    requirements: [
      { label: 'tTRUST staked', check: s => staked(s) >= 1, current: s => staked(s), target: 1, unit: 'tTRUST' },
      { label: 'On-chain signals', check: s => s.totalSignals >= 60, current: s => s.totalSignals, target: 60 },
      { label: 'Total positions', check: s => s.totalPositions >= 12, current: s => s.totalPositions, target: 12 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 5, current: s => s.totalAgentsRegistered, target: 5 },
      { label: 'Days active', check: s => s.daysActive >= 14, current: s => s.daysActive, target: 14, unit: 'days' },
    ],
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Long-term protocol participant with sustained high-level activity',
    icon: 'Award',
    color: 'purple',
    tier: 5,
    tierLabel: 'Tier 5 · Platinum',
    requirements: [
      { label: 'Days active', check: s => s.daysActive >= 30, current: s => s.daysActive, target: 30, unit: 'days' },
      { label: 'On-chain signals', check: s => s.totalSignals >= 100, current: s => s.totalSignals, target: 100 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 7, current: s => s.totalAgentsRegistered, target: 7 },
      { label: 'Total positions', check: s => s.totalPositions >= 15, current: s => s.totalPositions, target: 15 },
      { label: 'tTRUST staked', check: s => staked(s) >= 0.5, current: s => staked(s), target: 0.5, unit: 'tTRUST' },
    ],
  },

  // ── TIER 6: Legend ───────────────────────────────────────
  {
    id: 'legend',
    name: 'Legend',
    description: 'Elite status — exceptional contributor across every dimension',
    icon: 'Crown',
    color: 'amber',
    tier: 6,
    tierLabel: 'Tier 6 · Diamond',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 10, current: s => s.totalAgentsRegistered, target: 10 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 250, current: s => s.totalSignals, target: 250 },
      { label: 'Total positions', check: s => s.totalPositions >= 25, current: s => s.totalPositions, target: 25 },
      { label: 'tTRUST staked', check: s => staked(s) >= 5, current: s => staked(s), target: 5, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 60, current: s => s.daysActive, target: 60, unit: 'days' },
      { label: 'Reports submitted', check: s => s.reportsSubmitted >= 3, current: s => s.reportsSubmitted, target: 3 },
    ],
  },
]

export function isBadgeEarned(def: BadgeDefinition, stats: UserStats): boolean {
  return def.requirements.every(req => req.check(stats))
}

export function badgeProgress(def: BadgeDefinition, stats: UserStats): number {
  if (def.requirements.length === 0) return 0
  const perReq = def.requirements.map(req => {
    if (req.target === 0) return req.check(stats) ? 100 : 0
    return Math.min(100, (req.current(stats) / req.target) * 100)
  })
  return Math.round(perReq.reduce((a, b) => a + b, 0) / perReq.length)
}

export function calculateExpertLevel(badges: UserBadge[]): ExpertLevel {
  const maxTier = badges.length > 0
    ? Math.max(...badges.map(b => b.tier))
    : 0
  const count = badges.length

  if (maxTier >= 6 || count >= 9) return 'legend'
  if (maxTier >= 5 || count >= 7) return 'master'
  if (maxTier >= 4 || count >= 5) return 'expert'
  if (maxTier >= 2 || count >= 2) return 'contributor'
  return 'newcomer'
}

export function checkEarnedBadges(stats: UserStats, currentBadges: UserBadge[]): BadgeType[] {
  const earnedIds = currentBadges.map(b => b.id)
  return BADGE_DEFINITIONS
    .filter(def => !earnedIds.includes(def.id) && isBadgeEarned(def, stats))
    .map(def => def.id)
}

export function autoBuildBadges(stats: UserStats): UserBadge[] {
  return BADGE_DEFINITIONS
    .filter(def => isBadgeEarned(def, stats))
    .map(def => ({
      id: def.id,
      type: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      earnedAt: new Date(),
      tier: def.tier,
    }))
}

export const TIER_LABELS: Record<BadgeTier, { name: string; color: string }> = {
  1: { name: 'Entry', color: 'slate' },
  2: { name: 'Bronze', color: 'amber' },
  3: { name: 'Silver', color: 'slate' },
  4: { name: 'Gold', color: 'yellow' },
  5: { name: 'Platinum', color: 'cyan' },
  6: { name: 'Diamond', color: 'violet' },
}
