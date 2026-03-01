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

export type SkillCompatibility =
  | 'openai'
  | 'anthropic'
  | 'google'
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
  icon: string
  color: string
  description: string
}

export interface SkillCompatibilityDef {
  id: SkillCompatibility
  label: string
  shortLabel: string
  color: string
}

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  { id: 'data-analysis',    label: 'Data Analysis',    icon: '📊', color: '#06b6d4', description: 'Process and analyze structured data' },
  { id: 'code-generation',  label: 'Code Generation',  icon: '💻', color: '#8b5cf6', description: 'Write and review code in any language' },
  { id: 'text-processing',  label: 'Text Processing',  icon: '📝', color: '#10b981', description: 'NLP, summarization, translation' },
  { id: 'image-vision',     label: 'Image / Vision',   icon: '🖼️', color: '#f59e0b', description: 'Analyze and generate images' },
  { id: 'audio-speech',     label: 'Audio / Speech',   icon: '🎙️', color: '#ec4899', description: 'Speech-to-text, TTS, audio analysis' },
  { id: 'web-browsing',     label: 'Web Browsing',     icon: '🌐', color: '#3b82f6', description: 'Browse and scrape web content' },
  { id: 'api-integration',  label: 'API Integration',  icon: '🔌', color: '#f97316', description: 'Connect to external APIs and services' },
  { id: 'reasoning',        label: 'Reasoning',        icon: '🧠', color: '#a855f7', description: 'Multi-step reasoning and planning' },
  { id: 'memory-retrieval', label: 'Memory / RAG',     icon: '💾', color: '#14b8a6', description: 'Vector search and memory management' },
  { id: 'orchestration',    label: 'Orchestration',    icon: '🎭', color: '#6366f1', description: 'Multi-agent coordination' },
  { id: 'security',         label: 'Security',         icon: '🛡️', color: '#ef4444', description: 'Safety, auditing, and security checks' },
  { id: 'communication',    label: 'Communication',    icon: '💬', color: '#22c55e', description: 'Messaging, notifications, social' },
]

export const SKILL_COMPATIBILITIES: SkillCompatibilityDef[] = [
  { id: 'openai',     label: 'OpenAI',           shortLabel: 'OpenAI',    color: '#10a37f' },
  { id: 'anthropic',  label: 'Anthropic / Claude', shortLabel: 'Claude',  color: '#d97706' },
  { id: 'google',     label: 'Google / Gemini',  shortLabel: 'Gemini',    color: '#4285f4' },
  { id: 'ollama',     label: 'Ollama / Local',   shortLabel: 'Ollama',    color: '#8b5cf6' },
  { id: 'langchain',  label: 'LangChain',        shortLabel: 'LangChain', color: '#1c7f6e' },
  { id: 'autogen',    label: 'AutoGen',          shortLabel: 'AutoGen',   color: '#0ea5e9' },
  { id: 'crewai',     label: 'CrewAI',           shortLabel: 'CrewAI',    color: '#ef4444' },
  { id: 'eliza',      label: 'ElizaOS',          shortLabel: 'Eliza',     color: '#a78bfa' },
  { id: 'custom',     label: 'Custom / Any',     shortLabel: 'Any',       color: '#6b7280' },
]
