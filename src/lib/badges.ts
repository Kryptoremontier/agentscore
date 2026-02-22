import type { BadgeType, UserBadge, UserStats, ExpertLevel } from '@/types/user'

export interface BadgeDefinition {
  id: BadgeType
  name: string
  description: string
  icon: string
  color: string
  requirement: (stats: UserStats) => boolean
  progress?: (stats: UserStats) => number
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined during testnet beta phase',
    icon: 'Sparkles',
    color: 'amber',
    requirement: () => true,
  },
  {
    id: 'first_step',
    name: 'First Step',
    description: 'Made your first on-chain action',
    icon: 'Footprints',
    color: 'sky',
    requirement: (stats) => stats.totalSignals >= 1,
    progress: (stats) => Math.min(100, stats.totalSignals * 100),
  },
  {
    id: 'agent_creator',
    name: 'Agent Creator',
    description: 'Registered your first AI agent',
    icon: 'Cpu',
    color: 'cyan',
    requirement: (stats) => stats.totalAgentsRegistered >= 1,
    progress: (stats) => Math.min(100, stats.totalAgentsRegistered * 100),
  },
  {
    id: 'agent_builder',
    name: 'Agent Builder',
    description: 'Registered 3 or more agents',
    icon: 'Blocks',
    color: 'indigo',
    requirement: (stats) => stats.totalAgentsRegistered >= 3,
    progress: (stats) => Math.min(100, (stats.totalAgentsRegistered / 3) * 100),
  },
  {
    id: 'trust_staker',
    name: 'Trust Staker',
    description: 'Made your first Support stake',
    icon: 'ThumbsUp',
    color: 'emerald',
    requirement: (stats) => stats.agentsSupported >= 1,
    progress: (stats) => Math.min(100, stats.agentsSupported * 100),
  },
  {
    id: 'opposition_voice',
    name: 'Opposition Voice',
    description: 'Made your first Oppose stake',
    icon: 'ShieldAlert',
    color: 'rose',
    requirement: (stats) => stats.totalAttestations >= 1 && stats.totalSignals >= 2,
    progress: (stats) => Math.min(100, (stats.totalSignals / 2) * 100),
  },
  {
    id: 'active_supporter',
    name: 'Active Supporter',
    description: 'Supporting 3 or more different agents',
    icon: 'Heart',
    color: 'pink',
    requirement: (stats) => stats.agentsSupported >= 3,
    progress: (stats) => Math.min(100, (stats.agentsSupported / 3) * 100),
  },
  {
    id: 'signal_master',
    name: 'Signal Master',
    description: 'Completed 10+ on-chain transactions',
    icon: 'Zap',
    color: 'yellow',
    requirement: (stats) => stats.totalSignals >= 10,
    progress: (stats) => Math.min(100, (stats.totalSignals / 10) * 100),
  },
  {
    id: 'community_voice',
    name: 'Community Voice',
    description: 'Made 5 or more attestations',
    icon: 'MessageCircle',
    color: 'violet',
    requirement: (stats) => stats.totalAttestations >= 5,
    progress: (stats) => Math.min(100, (stats.totalAttestations / 5) * 100),
  },
  {
    id: 'trust_whale',
    name: 'Trust Whale',
    description: 'Staked 1+ tTRUST total across all agents',
    icon: 'Coins',
    color: 'blue',
    requirement: (stats) => Number(stats.totalTrustStaked) / 1e18 >= 1,
    progress: (stats) => Math.min(100, (Number(stats.totalTrustStaked) / 1e18) * 100),
  },
  {
    id: 'report_guardian',
    name: 'Report Guardian',
    description: 'Submitted an agent report to protect the community',
    icon: 'Flag',
    color: 'orange',
    requirement: (stats) => stats.reportsSubmitted >= 1,
    progress: (stats) => Math.min(100, stats.reportsSubmitted * 100),
  },
  {
    id: 'verified_identity',
    name: 'Verified Identity',
    description: 'Completed wallet signature verification',
    icon: 'ShieldCheck',
    color: 'green',
    requirement: () => false,
  },
]

export function calculateExpertLevel(badges: UserBadge[]): ExpertLevel {
  const count = badges.length
  if (count >= 10) return 'legend'
  if (count >= 7) return 'master'
  if (count >= 4) return 'expert'
  if (count >= 2) return 'contributor'
  if (count >= 1) return 'contributor'
  return 'newcomer'
}

export function checkEarnedBadges(stats: UserStats, currentBadges: UserBadge[]): BadgeType[] {
  const earnedIds = currentBadges.map(b => b.id)
  return BADGE_DEFINITIONS
    .filter(def => !earnedIds.includes(def.id) && def.requirement(stats))
    .map(def => def.id)
}

export function autoBuildBadges(stats: UserStats): UserBadge[] {
  return BADGE_DEFINITIONS
    .filter(def => def.requirement(stats))
    .map(def => ({
      id: def.id,
      type: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      earnedAt: new Date(),
    }))
}
