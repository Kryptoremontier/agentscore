export enum ForgeCategory {
  AI_AGENTS = 'ai_agents',
  DEFI = 'defi',
  SOCIAL = 'social',
  IDENTITY = 'identity',
  DATA = 'data',
  INFRASTRUCTURE = 'infra',
  TOOLING = 'tooling',
  GAMING = 'gaming',
  OTHER = 'other',
}

export const FORGE_CATEGORY_LABELS: Record<ForgeCategory, string> = {
  [ForgeCategory.AI_AGENTS]: 'AI Agents',
  [ForgeCategory.DEFI]: 'DeFi',
  [ForgeCategory.SOCIAL]: 'Social',
  [ForgeCategory.IDENTITY]: 'Identity',
  [ForgeCategory.DATA]: 'Data',
  [ForgeCategory.INFRASTRUCTURE]: 'Infrastructure',
  [ForgeCategory.TOOLING]: 'Tooling',
  [ForgeCategory.GAMING]: 'Gaming',
  [ForgeCategory.OTHER]: 'Other',
}

export enum ProjectStage {
  IDEA = 'idea',
  BUILDING = 'building',
  TESTNET = 'testnet',
  MAINNET = 'mainnet',
}

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  [ProjectStage.IDEA]: 'Idea',
  [ProjectStage.BUILDING]: 'Building',
  [ProjectStage.TESTNET]: 'Testnet',
  [ProjectStage.MAINNET]: 'Mainnet',
}

export interface TeamMember {
  name: string
  role: string
  twitter?: string
  wallet?: string
}

export interface ForgeProject {
  // On-chain identification
  id: string
  atomId: string
  registeredAt: string
  registrantAddress: string

  // Basic info
  name: string
  tagline: string
  description: string
  category: ForgeCategory
  stage: ProjectStage

  // Links (all optional)
  website?: string
  github?: string
  twitter?: string
  discord?: string
  demo?: string

  // Team
  teamSize?: number
  isAnonymous: boolean
  teamMembers?: TeamMember[]

  // Technical
  isOpenSource: boolean
  license?: string
  techStack?: string[]

  // Intuition-specific
  intuitionAtoms?: string[]
  usesFeeProxy: boolean
  hasMCPServer: boolean
  hasAPI: boolean

  // Profile Completeness (0–100, calculated)
  completeness: number

  // Trust (calculated by scoring engine, not user-entered)
  trustScore: number
  compositeScore: number
  finalScore: number
  stakerCount: number
  totalStaked: number
  evaluatorCount: number
  momentum: 'up' | 'down' | 'stable'
  sparklineData: number[]

  // On-chain vault references (populated from GraphQL)
  counterTermId?: string | null
}

export interface ForgeProjectRegistrationInput {
  name: string
  tagline: string
  description: string
  category: ForgeCategory
  stage: ProjectStage
  website?: string
  github?: string
  twitter?: string
  discord?: string
  demo?: string
  teamSize?: number
  isAnonymous: boolean
  teamMembers?: TeamMember[]
  isOpenSource: boolean
  license?: string
  techStack?: string[]
  intuitionAtoms?: string[]
  usesFeeProxy: boolean
  hasMCPServer: boolean
  hasAPI: boolean
}

export interface ForgeLeaderboardEntry {
  rank: number
  project: ForgeProject
}

export interface ForgeStats {
  totalProjects: number
  totalStaked: number
  totalStakers: number
  totalEvaluators: number
  categoryCounts: Record<ForgeCategory, number>
  avgTrustScore: number
}
