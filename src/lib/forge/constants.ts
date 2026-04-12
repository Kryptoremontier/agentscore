import { ForgeCategory, ProjectStage } from './types'

// Emoji icons — rendered directly in CategoryPill / ProjectGrid
// Lucide icon key strings — mapped to React components in CategoryPill / ProjectGrid
export const FORGE_CATEGORY_ICONS: Record<ForgeCategory, string> = {
  ai_agents:          'bot',
  trust_reputation:   'shield',
  defi:               'coins',
  social:             'globe',
  identity:           'fingerprint',
  data_analytics:     'bar-chart-2',
  developer_tools:    'wrench',
  infrastructure:     'server',
  prediction_markets: 'target',
  governance:         'scroll-text',
  gaming_nft:         'gamepad-2',
  other:              'layers',
}

export const PROJECT_STAGE_COLORS: Record<ProjectStage, string> = {
  idea: 'text-white/40',
  building: 'text-blue-400',
  testnet: 'text-amber-400',
  mainnet: 'text-emerald-400',
}

export const PROJECT_STAGE_DOT_COLORS: Record<ProjectStage, string> = {
  idea: '#9ca3af',
  building: '#60a5fa',
  testnet: '#fbbf24',
  mainnet: '#34d399',
}

// Weights for Profile Completeness — higher for ecosystem-relevant elements
export const COMPLETENESS_WEIGHTS = {
  name: 5,
  tagline: 5,
  description: 10,
  category: 5,
  stage: 5,
  website: 5,
  github: 10,
  twitter: 5,
  discord: 5,
  demo: 10,
  teamSize: 3,
  techStack: 7,
  isOpenSource: 5,
  usesFeeProxy: 5,
  hasMCPServer: 5,
  hasAPI: 5,
  // total: 100
}

export const FORGE_ATOM_PREDICATE = 'hasForgeCategory'
export const FORGE_TYPE_PREDICATE = 'is'
export const FORGE_TYPE_OBJECT = 'Intuition Project'

export const FORGE_API_BASE = '/api/v1/forge'
