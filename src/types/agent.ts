import type { ExpertLevel } from './user'

export interface Agent {
  id: string                    // Atom ID
  atomId: bigint               // On-chain ID
  name: string
  description: string | null
  platform: AgentPlatform
  walletAddress: `0x${string}` | null
  createdAt: Date
  verificationLevel: VerificationLevel

  // Category
  category?: AgentCategory      // Agent category

  // Avatar
  avatar?: string               // IPFS hash lub URL

  // Owner info
  owner: {
    address: `0x${string}`
    name?: string
    avatar?: string
    expertLevel: ExpertLevel
  }

  // Computed from attestations
  trustScore: number           // 0-100
  positiveStake: bigint        // Total positive $TRUST
  negativeStake: bigint        // Total negative $TRUST
  attestationCount: number
  reportCount: number
  stakerCount: number
}

export type AgentPlatform =
  | 'moltbook'
  | 'openclaw'
  | 'farcaster'
  | 'twitter'
  | 'custom'

export type VerificationLevel =
  | 'none'           // 0 - unverified
  | 'wallet'         // 1 - wallet connected
  | 'social'         // 2 - social verified
  | 'kyc'            // 3 - fully verified

export type TrustLevel =
  | 'excellent'      // 90-100
  | 'good'           // 70-89
  | 'moderate'       // 50-69
  | 'low'            // 30-49
  | 'critical'       // 0-29

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'moderate'
  if (score >= 30) return 'low'
  return 'critical'
}

export function getTrustColor(level: TrustLevel): string {
  const colors: Record<TrustLevel, string> = {
    excellent: '#06B6D4',
    good: '#22C55E',
    moderate: '#EAB308',
    low: '#F97316',
    critical: '#EF4444',
  }
  return colors[level]
}

export type AgentCategory =
  | 'coding'           // Coding assistants
  | 'writing'          // Content creation
  | 'data'             // Data analysis
  | 'trading'          // Trading bots
  | 'social'           // Social media
  | 'gaming'           // Gaming
  | 'defi'             // DeFi agents
  | 'nft'              // NFT tools
  | 'research'         // Research assistants
  | 'customer_service' // Support bots
  | 'other'            // Other

export const AGENT_CATEGORIES: Record<AgentCategory, { label: string; icon: string; color: string }> = {
  coding: { label: 'Coding', icon: 'Code', color: 'blue' },
  writing: { label: 'Writing', icon: 'PenTool', color: 'purple' },
  data: { label: 'Data', icon: 'BarChart', color: 'cyan' },
  trading: { label: 'Trading', icon: 'TrendingUp', color: 'green' },
  social: { label: 'Social', icon: 'MessageCircle', color: 'pink' },
  gaming: { label: 'Gaming', icon: 'Gamepad', color: 'orange' },
  defi: { label: 'DeFi', icon: 'Wallet', color: 'emerald' },
  nft: { label: 'NFT', icon: 'Image', color: 'violet' },
  research: { label: 'Research', icon: 'Search', color: 'yellow' },
  customer_service: { label: 'Support', icon: 'Headphones', color: 'teal' },
  other: { label: 'Other', icon: 'MoreHorizontal', color: 'slate' },
}

export interface AgentFilters {
  search: string
  categories: AgentCategory[]
  trustRange: [number, number]      // [min, max]
  verifiedOnly: boolean
  sortBy: 'trust' | 'staked' | 'newest' | 'attestations'
  sortOrder: 'asc' | 'desc'
}