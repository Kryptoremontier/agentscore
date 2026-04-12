export enum ForgeCategory {
  AI_AGENTS          = 'ai_agents',
  TRUST_REPUTATION   = 'trust_reputation',
  DEFI               = 'defi',
  SOCIAL             = 'social',
  IDENTITY           = 'identity',
  DATA_ANALYTICS     = 'data_analytics',
  DEVELOPER_TOOLS    = 'developer_tools',
  INFRASTRUCTURE     = 'infrastructure',
  PREDICTION_MARKETS = 'prediction_markets',
  GOVERNANCE         = 'governance',
  GAMING_NFT         = 'gaming_nft',
  OTHER              = 'other',
}

export const FORGE_CATEGORY_LABELS: Record<ForgeCategory, string> = {
  [ForgeCategory.AI_AGENTS]:          'AI Agents',
  [ForgeCategory.TRUST_REPUTATION]:   'Trust & Reputation',
  [ForgeCategory.DEFI]:               'DeFi',
  [ForgeCategory.SOCIAL]:             'Social',
  [ForgeCategory.IDENTITY]:           'Identity',
  [ForgeCategory.DATA_ANALYTICS]:     'Data & Analytics',
  [ForgeCategory.DEVELOPER_TOOLS]:    'Developer Tools',
  [ForgeCategory.INFRASTRUCTURE]:     'Infrastructure',
  [ForgeCategory.PREDICTION_MARKETS]: 'Prediction Markets',
  [ForgeCategory.GOVERNANCE]:         'Governance',
  [ForgeCategory.GAMING_NFT]:         'Gaming & NFT',
  [ForgeCategory.OTHER]:              'Other',
}

export interface ForgeCategoryDef {
  id: ForgeCategory
  label: string
  icon: string
  description: string
  color: string
}

export const FORGE_CATEGORIES: ForgeCategoryDef[] = [
  { id: ForgeCategory.AI_AGENTS,          label: 'AI Agents',          icon: 'bot',         description: 'Agent frameworks, tools, evaluators',    color: 'text-purple-400' },
  { id: ForgeCategory.TRUST_REPUTATION,   label: 'Trust & Reputation', icon: 'shield',      description: 'Scoring, verification, identity trust',   color: 'text-amber-400'  },
  { id: ForgeCategory.DEFI,               label: 'DeFi',               icon: 'coins',       description: 'Trading, lending, yield, vaults',         color: 'text-blue-400'   },
  { id: ForgeCategory.SOCIAL,             label: 'Social',             icon: 'globe',       description: 'Social platforms, messaging, community',  color: 'text-pink-400'   },
  { id: ForgeCategory.IDENTITY,           label: 'Identity',           icon: 'fingerprint', description: 'DID, verification, credentials',          color: 'text-cyan-400'   },
  { id: ForgeCategory.DATA_ANALYTICS,     label: 'Data & Analytics',   icon: 'bar-chart-2', description: 'Dashboards, indexers, insights',          color: 'text-emerald-400'},
  { id: ForgeCategory.DEVELOPER_TOOLS,    label: 'Developer Tools',    icon: 'wrench',      description: 'SDKs, CLIs, libraries, testing',          color: 'text-orange-400' },
  { id: ForgeCategory.INFRASTRUCTURE,     label: 'Infrastructure',     icon: 'server',      description: 'Nodes, oracles, bridges, MCP servers',    color: 'text-slate-400'  },
  { id: ForgeCategory.PREDICTION_MARKETS, label: 'Prediction Markets', icon: 'target',      description: 'Forecasting, betting, knowledge markets', color: 'text-violet-400' },
  { id: ForgeCategory.GOVERNANCE,         label: 'Governance',         icon: 'scroll-text', description: 'DAOs, voting, proposals, coordination',   color: 'text-yellow-400' },
  { id: ForgeCategory.GAMING_NFT,         label: 'Gaming & NFT',       icon: 'gamepad-2',   description: 'Games, collectibles, metaverse',          color: 'text-red-400'    },
  { id: ForgeCategory.OTHER,              label: 'Other',              icon: 'layers',      description: 'Everything else',                         color: 'text-white/40'   },
]

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
  opposeStaked: number
  evaluatorCount: number
  momentum: 'up' | 'down' | 'stable'
  sparklineData: number[]
  daysActive: number

  // Individual positions (populated in detail view only)
  supportPositions?: Array<{ address: string; sharesWei: string }>
  opposePositions?: Array<{ address: string; sharesWei: string }>

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
