import type { BadgeType, UserBadge, UserStats, ExpertLevel } from '@/types/user'

export interface BadgeDefinition {
  id: BadgeType
  name: string
  description: string
  icon: string                       // Lucide icon name
  color: string                      // Tailwind color
  requirement: (stats: UserStats) => boolean
  progress?: (stats: UserStats) => number  // 0-100 progress to earning
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined during beta phase',
    icon: 'Sparkles',
    color: 'amber',
    requirement: () => false,        // Manually granted
  },
  {
    id: 'trusted_expert',
    name: 'Trusted Expert',
    description: 'Personal reputation score above 90',
    icon: 'Award',
    color: 'emerald',
    requirement: (stats) => stats.reputation >= 90,
    progress: (stats) => Math.min(100, (stats.reputation / 90) * 100),
  },
  {
    id: 'prolific_supporter',
    name: 'Prolific Supporter',
    description: 'Supporting more than 50 agents',
    icon: 'Heart',
    color: 'pink',
    requirement: (stats) => stats.totalAttestations >= 50,
    progress: (stats) => Math.min(100, (stats.totalAttestations / 50) * 100),
  },
  {
    id: 'agent_creator',
    name: 'Agent Creator',
    description: 'Created an agent with trust score above 80',
    icon: 'Cpu',
    color: 'cyan',
    requirement: (stats) => stats.totalAgentsRegistered > 0, // Simplified
  },
  {
    id: 'whale',
    name: 'Whale',
    description: 'Staked more than 10,000 $TRUST',
    icon: 'Coins',
    color: 'blue',
    requirement: (stats) => Number(stats.totalTrustStaked) / 1e18 >= 10000,
    progress: (stats) => Math.min(100, (Number(stats.totalTrustStaked) / 1e18 / 10000) * 100),
  },
  {
    id: 'community_pillar',
    name: 'Community Pillar',
    description: 'Made more than 100 attestations',
    icon: 'Users',
    color: 'violet',
    requirement: (stats) => stats.totalAttestations >= 100,
    progress: (stats) => Math.min(100, (stats.totalAttestations / 100) * 100),
  },
  {
    id: 'verified_identity',
    name: 'Verified Identity',
    description: 'Completed identity verification',
    icon: 'ShieldCheck',
    color: 'green',
    requirement: () => false,        // Manually verified
  },
]

export function calculateExpertLevel(badges: UserBadge[]): ExpertLevel {
  const count = badges.length
  if (count >= 6) return 'legend'
  if (count >= 5) return 'master'
  if (count >= 3) return 'expert'
  if (count >= 1) return 'contributor'
  return 'newcomer'
}

export function checkEarnedBadges(stats: UserStats, currentBadges: UserBadge[]): BadgeType[] {
  const earnedIds = currentBadges.map(b => b.id)
  return BADGE_DEFINITIONS
    .filter(def => !earnedIds.includes(def.id) && def.requirement(stats))
    .map(def => def.id)
}
