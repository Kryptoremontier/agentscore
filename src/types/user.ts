export interface UserProfile {
  address: `0x${string}`
  name?: string
  bio?: string
  avatar?: string
  website?: string
  twitter?: string
  farcaster?: string
  stats: UserStats
  badges: UserBadge[]
  expertLevel: ExpertLevel
  registeredAgents: RegisteredAgent[]
  supportedAgents: AgentSupport[]
  joinedAt: Date
  lastActiveAt: Date
}

export interface RegisteredAgent {
  termId: string
  label: string
  emoji?: string
  createdAt: string
  trustScore: number
  stakers: number
  totalStaked: string
}

export interface UserStats {
  totalAgentsRegistered: number
  totalTrustStaked: bigint
  totalAttestations: number
  trustReceived: bigint
  reputation: number
  totalSignals: number
  agentsSupported: number
  reportsSubmitted: number
}

export interface AgentSupport {
  agentTermId: string
  agentLabel: string
  agentEmoji?: string
  shares: string
  side: 'for' | 'against'
  updatedAt: string
}

export interface UserBadge {
  id: string
  type: BadgeType
  name: string
  description: string
  icon: string
  earnedAt: Date
  level?: number
}

export type BadgeType =
  | 'early_adopter'
  | 'first_step'
  | 'agent_creator'
  | 'agent_builder'
  | 'trust_staker'
  | 'opposition_voice'
  | 'active_supporter'
  | 'signal_master'
  | 'community_voice'
  | 'trust_whale'
  | 'report_guardian'
  | 'verified_identity'

export type ExpertLevel =
  | 'newcomer'
  | 'contributor'
  | 'expert'
  | 'master'
  | 'legend'

export const EXPERT_WEIGHT: Record<ExpertLevel, number> = {
  newcomer: 1.0,
  contributor: 1.25,
  expert: 1.5,
  master: 2.0,
  legend: 3.0,
}
