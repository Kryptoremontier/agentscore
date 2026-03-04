// Skill types for AgentScore Skills Registry

export type SkillCategory =
  | 'data-analysis'
  | 'code-generation'
  | 'text-processing'
  | 'image-vision'
  | 'audio-speech'
  | 'web-browsing'
  | 'api-integration'
  | 'reasoning'
  | 'memory-retrieval'
  | 'orchestration'
  | 'security'
  | 'communication'
  | 'finance'
  | 'search'
  | 'document'
  | 'blockchain'
  | 'automation'
  | 'monitoring'
  | 'translation'
  | 'testing'
  | 'custom'

export type SkillCompatibility =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'ollama'
  | 'langchain'
  | 'autogen'
  | 'crewai'
  | 'eliza'
  | 'custom'

export interface Skill {
  term_id: string
  label: string
  type: string
  created_at: string
  emoji?: string
  creator?: { label: string; id?: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
  category?: SkillCategory
  compatibilities?: SkillCompatibility[]
  github_url?: string
  install_command?: string
  version?: string
}

export interface SkillCategoryDef {
  id: SkillCategory
  label: string
  /** Lucide icon name */
  icon: string
  color: string
  bg: string
  border: string
  description: string
}

export interface SkillCompatibilityDef {
  id: SkillCompatibility
  label: string
  shortLabel: string
  color: string
}

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  {
    id: 'reasoning',
    label: 'Reasoning',
    icon: 'Brain',
    color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)',
    description: 'Multi-step reasoning, planning, chain-of-thought',
  },
  {
    id: 'code-generation',
    label: 'Code Generation',
    icon: 'Code2',
    color: '#818CF8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.35)',
    description: 'Write, review, debug code in any language',
  },
  {
    id: 'data-analysis',
    label: 'Data Analysis',
    icon: 'BarChart3',
    color: '#2EE6D6', bg: 'rgba(46,230,214,0.12)', border: 'rgba(46,230,214,0.35)',
    description: 'Process, analyze and visualize structured data',
  },
  {
    id: 'web-browsing',
    label: 'Web Browsing',
    icon: 'Globe',
    color: '#38B6FF', bg: 'rgba(56,182,255,0.12)', border: 'rgba(56,182,255,0.35)',
    description: 'Browse, scrape and extract web content',
  },
  {
    id: 'search',
    label: 'Search & Retrieval',
    icon: 'Search',
    color: '#C8963C', bg: 'rgba(200,150,60,0.12)', border: 'rgba(200,150,60,0.35)',
    description: 'Semantic search, full-text, hybrid retrieval',
  },
  {
    id: 'memory-retrieval',
    label: 'Memory / RAG',
    icon: 'Database',
    color: '#14b8a6', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.35)',
    description: 'Vector stores, embeddings, memory management',
  },
  {
    id: 'image-vision',
    label: 'Image / Vision',
    icon: 'Eye',
    color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)',
    description: 'Analyze, generate and transform images',
  },
  {
    id: 'audio-speech',
    label: 'Audio / Speech',
    icon: 'Mic',
    color: '#F472B6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.35)',
    description: 'STT, TTS, audio transcription and analysis',
  },
  {
    id: 'document',
    label: 'Document Processing',
    icon: 'FileText',
    color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)',
    description: 'PDF, DOCX, OCR, document understanding',
  },
  {
    id: 'api-integration',
    label: 'API Integration',
    icon: 'Plug',
    color: '#FB923C', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)',
    description: 'Connect to external APIs and services',
  },
  {
    id: 'orchestration',
    label: 'Orchestration',
    icon: 'GitBranch',
    color: '#6366F1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)',
    description: 'Multi-agent coordination and workflow',
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: 'Zap',
    color: '#EAB308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)',
    description: 'Task automation, RPA, scheduled jobs',
  },
  {
    id: 'blockchain',
    label: 'Blockchain / Web3',
    icon: 'Link2',
    color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)',
    description: 'On-chain reads, wallet, smart contracts',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'TrendingUp',
    color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)',
    description: 'Pricing, portfolio, financial analysis',
  },
  {
    id: 'security',
    label: 'Security',
    icon: 'ShieldCheck',
    color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)',
    description: 'Safety, auditing, red-teaming, security checks',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: 'Activity',
    color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)',
    description: 'Logging, tracing, alerting and observability',
  },
  {
    id: 'translation',
    label: 'Translation / i18n',
    icon: 'Languages',
    color: '#C084FC', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.35)',
    description: 'Language translation and localization',
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: 'MessageSquare',
    color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)',
    description: 'Messaging, email, notifications, social',
  },
  {
    id: 'text-processing',
    label: 'Text Processing',
    icon: 'Type',
    color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)',
    description: 'NLP, summarization, extraction, classification',
  },
  {
    id: 'testing',
    label: 'Testing / QA',
    icon: 'FlaskConical',
    color: '#E879F9', bg: 'rgba(232,121,249,0.12)', border: 'rgba(232,121,249,0.35)',
    description: 'Automated testing, validation and QA',
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: 'Wrench',
    color: '#7A838D', bg: 'rgba(122,131,141,0.12)', border: 'rgba(122,131,141,0.30)',
    description: 'Something unique — define your own category',
  },
]

export const SKILL_COMPATIBILITIES: SkillCompatibilityDef[] = [
  { id: 'openai',     label: 'OpenAI / GPT',       shortLabel: 'OpenAI',    color: '#10a37f' },
  { id: 'anthropic',  label: 'Anthropic / Claude',  shortLabel: 'Claude',   color: '#d97706' },
  { id: 'google',     label: 'Google / Gemini',     shortLabel: 'Gemini',   color: '#4285f4' },
  { id: 'mistral',    label: 'Mistral AI',          shortLabel: 'Mistral',  color: '#FF6B35' },
  { id: 'ollama',     label: 'Ollama / Local LLM',  shortLabel: 'Ollama',   color: '#8b5cf6' },
  { id: 'langchain',  label: 'LangChain',           shortLabel: 'LangChain', color: '#1c7f6e' },
  { id: 'autogen',    label: 'AutoGen',             shortLabel: 'AutoGen',  color: '#0ea5e9' },
  { id: 'crewai',     label: 'CrewAI',              shortLabel: 'CrewAI',   color: '#ef4444' },
  { id: 'eliza',      label: 'ElizaOS',             shortLabel: 'Eliza',    color: '#a78bfa' },
  { id: 'custom',     label: 'Custom / Any',        shortLabel: 'Any',      color: '#6b7280' },
]
