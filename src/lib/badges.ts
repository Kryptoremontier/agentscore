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
  // ── TIER 1: Newcomer — first week of activity ────────────
  {
    id: 'newcomer',
    name: 'Newcomer',
    description: 'Completed your first steps on the platform',
    icon: 'Footprints',
    color: 'slate',
    tier: 1,
    tierLabel: 'Tier 1 · Entry',
    requirements: [
      { label: 'On-chain signals', check: s => s.totalSignals >= 5, current: s => s.totalSignals, target: 5 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 1, current: s => s.totalAgentsRegistered, target: 1 },
      { label: 'Staking positions', check: s => s.totalPositions >= 2, current: s => s.totalPositions, target: 2 },
      { label: 'Days active', check: s => s.daysActive >= 3, current: s => s.daysActive, target: 3, unit: 'days' },
    ],
  },

  // ── TIER 2: Bronze — 2-3 weeks of consistent work ────────
  {
    id: 'pioneer',
    name: 'Pioneer',
    description: 'Building a consistent presence with diverse on-chain activity',
    icon: 'Rocket',
    color: 'sky',
    tier: 2,
    tierLabel: 'Tier 2 · Bronze',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 3, current: s => s.totalAgentsRegistered, target: 3 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 25, current: s => s.totalSignals, target: 25 },
      { label: 'Staking positions', check: s => s.totalPositions >= 5, current: s => s.totalPositions, target: 5 },
      { label: 'tTRUST staked', check: s => staked(s) >= 0.05, current: s => staked(s), target: 0.05, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 7, current: s => s.daysActive, target: 7, unit: 'days' },
    ],
  },
  {
    id: 'first_stake',
    name: 'Staker',
    description: 'Meaningful economic commitment backing multiple agents',
    icon: 'Coins',
    color: 'emerald',
    tier: 2,
    tierLabel: 'Tier 2 · Bronze',
    requirements: [
      { label: 'tTRUST staked', check: s => staked(s) >= 0.1, current: s => staked(s), target: 0.1, unit: 'tTRUST' },
      { label: 'Support positions', check: s => s.agentsSupported >= 3, current: s => s.agentsSupported, target: 3 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 15, current: s => s.totalSignals, target: 15 },
      { label: 'Days active', check: s => s.daysActive >= 7, current: s => s.daysActive, target: 7, unit: 'days' },
    ],
  },

  // ── TIER 3: Silver — 1-2 months of sustained effort ──────
  {
    id: 'builder',
    name: 'Builder',
    description: 'Prolific agent creator actively shaping the network',
    icon: 'Blocks',
    color: 'indigo',
    tier: 3,
    tierLabel: 'Tier 3 · Silver',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 8, current: s => s.totalAgentsRegistered, target: 8 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 75, current: s => s.totalSignals, target: 75 },
      { label: 'tTRUST staked', check: s => staked(s) >= 0.5, current: s => staked(s), target: 0.5, unit: 'tTRUST' },
      { label: 'Total positions', check: s => s.totalPositions >= 10, current: s => s.totalPositions, target: 10 },
      { label: 'Days active', check: s => s.daysActive >= 21, current: s => s.daysActive, target: 21, unit: 'days' },
    ],
  },
  {
    id: 'supporter',
    name: 'Supporter',
    description: 'Wide staking portfolio across the trust network',
    icon: 'Heart',
    color: 'pink',
    tier: 3,
    tierLabel: 'Tier 3 · Silver',
    requirements: [
      { label: 'Support positions', check: s => s.agentsSupported >= 8, current: s => s.agentsSupported, target: 8 },
      { label: 'Total positions', check: s => s.totalPositions >= 15, current: s => s.totalPositions, target: 15 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 60, current: s => s.totalSignals, target: 60 },
      { label: 'tTRUST staked', check: s => staked(s) >= 1, current: s => staked(s), target: 1, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 21, current: s => s.daysActive, target: 21, unit: 'days' },
    ],
  },

  // ── TIER 4: Gold — 2-3 months of dedicated participation ─
  {
    id: 'networker',
    name: 'Networker',
    description: 'Established a broad and deep trust network over time',
    icon: 'Globe',
    color: 'cyan',
    tier: 4,
    tierLabel: 'Tier 4 · Gold',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 15, current: s => s.totalAgentsRegistered, target: 15 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 200, current: s => s.totalSignals, target: 200 },
      { label: 'Total positions', check: s => s.totalPositions >= 25, current: s => s.totalPositions, target: 25 },
      { label: 'tTRUST staked', check: s => staked(s) >= 2.5, current: s => staked(s), target: 2.5, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 45, current: s => s.daysActive, target: 45, unit: 'days' },
    ],
  },
  {
    id: 'guardian',
    name: 'Guardian',
    description: 'Trusted protector of the ecosystem through vigilant reporting',
    icon: 'ShieldCheck',
    color: 'orange',
    tier: 4,
    tierLabel: 'Tier 4 · Gold',
    requirements: [
      { label: 'Reports submitted', check: s => s.reportsSubmitted >= 5, current: s => s.reportsSubmitted, target: 5 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 10, current: s => s.totalAgentsRegistered, target: 10 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 150, current: s => s.totalSignals, target: 150 },
      { label: 'Total positions', check: s => s.totalPositions >= 20, current: s => s.totalPositions, target: 20 },
      { label: 'Days active', check: s => s.daysActive >= 30, current: s => s.daysActive, target: 30, unit: 'days' },
    ],
  },

  // ── TIER 5: Platinum — 4-6 months of high-level activity ─
  {
    id: 'whale',
    name: 'Whale',
    description: 'Major stakeholder with massive economic commitment',
    icon: 'Zap',
    color: 'blue',
    tier: 5,
    tierLabel: 'Tier 5 · Platinum',
    requirements: [
      { label: 'tTRUST staked', check: s => staked(s) >= 10, current: s => staked(s), target: 10, unit: 'tTRUST' },
      { label: 'On-chain signals', check: s => s.totalSignals >= 500, current: s => s.totalSignals, target: 500 },
      { label: 'Total positions', check: s => s.totalPositions >= 40, current: s => s.totalPositions, target: 40 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 20, current: s => s.totalAgentsRegistered, target: 20 },
      { label: 'Days active', check: s => s.daysActive >= 90, current: s => s.daysActive, target: 90, unit: 'days' },
    ],
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Long-term pillar of the community with proven track record',
    icon: 'Award',
    color: 'purple',
    tier: 5,
    tierLabel: 'Tier 5 · Platinum',
    requirements: [
      { label: 'Days active', check: s => s.daysActive >= 120, current: s => s.daysActive, target: 120, unit: 'days' },
      { label: 'On-chain signals', check: s => s.totalSignals >= 400, current: s => s.totalSignals, target: 400 },
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 15, current: s => s.totalAgentsRegistered, target: 15 },
      { label: 'Total positions', check: s => s.totalPositions >= 35, current: s => s.totalPositions, target: 35 },
      { label: 'tTRUST staked', check: s => staked(s) >= 5, current: s => staked(s), target: 5, unit: 'tTRUST' },
      { label: 'Reports submitted', check: s => s.reportsSubmitted >= 3, current: s => s.reportsSubmitted, target: 3 },
    ],
  },

  // ── TIER 6: Diamond — 6-12 months, elite contributors only
  {
    id: 'legend',
    name: 'Legend',
    description: 'Elite status — exceptional contributor across every dimension',
    icon: 'Crown',
    color: 'amber',
    tier: 6,
    tierLabel: 'Tier 6 · Diamond',
    requirements: [
      { label: 'Agents registered', check: s => s.totalAgentsRegistered >= 30, current: s => s.totalAgentsRegistered, target: 30 },
      { label: 'On-chain signals', check: s => s.totalSignals >= 1000, current: s => s.totalSignals, target: 1000 },
      { label: 'Total positions', check: s => s.totalPositions >= 75, current: s => s.totalPositions, target: 75 },
      { label: 'tTRUST staked', check: s => staked(s) >= 25, current: s => staked(s), target: 25, unit: 'tTRUST' },
      { label: 'Days active', check: s => s.daysActive >= 180, current: s => s.daysActive, target: 180, unit: 'days' },
      { label: 'Reports submitted', check: s => s.reportsSubmitted >= 10, current: s => s.reportsSubmitted, target: 10 },
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
