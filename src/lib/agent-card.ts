/**
 * Agent Card — structured metadata for AI agent identity.
 *
 * Every field maps to a JSON key in the atom label.
 * Machine-readable from day 1 (A2A ready).
 * Human-friendly in UI via parseAgentCard().
 *
 * TODO (Phase 2C): migrate to per-field triples using dedicated predicates
 * e.g. [Agent][hasDescription][...], [Agent][hasGithub][...], etc.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentCardData {
  // Identity (required)
  name: string
  description?: string
  category?: AgentCategory

  // Capabilities (powers Domain Leaderboards & scoring)
  skills?: string[]

  // Endpoints (A2A readiness)
  endpoints?: {
    api?: string
    mcp?: string
    a2aCard?: string
    website?: string
    docs?: string
  }

  // Source & Provenance
  source?: {
    github?: string
    version?: string
    license?: string
    framework?: string
  }

  // Social & Human Identity
  social?: {
    twitter?: string
    discord?: string
    telegram?: string
  }
}

export type AgentCategory =
  | 'developer-tools'
  | 'data-analysis'
  | 'content-creation'
  | 'defi-trading'
  | 'security-audit'
  | 'customer-support'
  | 'research'
  | 'education'
  | 'healthcare'
  | 'gaming'
  | 'social'
  | 'infrastructure'
  | 'other'

export const AGENT_CATEGORIES: { id: AgentCategory; label: string; icon: string }[] = [
  { id: 'developer-tools',  label: 'Developer Tools',  icon: '🛠️' },
  { id: 'data-analysis',    label: 'Data Analysis',    icon: '📊' },
  { id: 'content-creation', label: 'Content Creation', icon: '✍️' },
  { id: 'defi-trading',     label: 'DeFi & Trading',   icon: '💱' },
  { id: 'security-audit',   label: 'Security & Audit', icon: '🔒' },
  { id: 'customer-support', label: 'Customer Support', icon: '💬' },
  { id: 'research',         label: 'Research',         icon: '🔬' },
  { id: 'education',        label: 'Education',        icon: '📚' },
  { id: 'healthcare',       label: 'Healthcare',       icon: '🏥' },
  { id: 'gaming',           label: 'Gaming',           icon: '🎮' },
  { id: 'social',           label: 'Social',           icon: '🌐' },
  { id: 'infrastructure',   label: 'Infrastructure',   icon: '⚙️' },
  { id: 'other',            label: 'Other',            icon: '📦' },
]

export const AGENT_CARD_PREDICATES = {
  HAS_DESCRIPTION:  'hasDescription',
  HAS_CATEGORY:     'hasCategory',
  HAS_API_ENDPOINT: 'hasApiEndpoint',
  HAS_MCP_ENDPOINT: 'hasMcpEndpoint',
  HAS_A2A_CARD:     'hasA2aCard',
  HAS_WEBSITE:      'hasWebsite',
  HAS_DOCS:         'hasDocs',
  HAS_GITHUB:       'hasGithub',
  HAS_VERSION:      'hasVersion',
  HAS_LICENSE:      'hasLicense',
  HAS_FRAMEWORK:    'hasFramework',
  HAS_TWITTER:      'hasTwitter',
  HAS_DISCORD:      'hasDiscord',
  HAS_TELEGRAM:     'hasTelegram',
} as const

// ─── Profile Completeness ─────────────────────────────────────────────────────

export interface ProfileCompletenessResult {
  percentage: number
  completedFields: string[]
  missingFields: string[]
  isA2AReady: boolean
}

/**
 * Calculate how complete an agent's profile is (0–100%).
 *
 * NOT used in scoring (prevents gaming).
 * Used in: UI display, API response, sorting tiebreaker.
 *
 * Weights reflect A2A readiness priority:
 * - Endpoints and capabilities weighted highest
 * - Source provenance next
 * - Social / identity last
 */
export function calculateProfileCompleteness(card: AgentCardData): ProfileCompletenessResult {
  const fields: { name: string; weight: number; filled: boolean }[] = [
    // Identity — 15%
    { name: 'name',        weight: 10, filled: !!card.name },
    { name: 'description', weight: 5,  filled: !!card.description },

    // Category — 5%
    { name: 'category', weight: 5, filled: !!card.category },

    // Capabilities — 15%
    { name: 'skills', weight: 15, filled: (card.skills?.length ?? 0) > 0 },

    // Endpoints — 25% (highest — A2A critical)
    { name: 'api endpoint', weight: 10, filled: !!card.endpoints?.api },
    { name: 'mcp endpoint', weight: 10, filled: !!card.endpoints?.mcp },
    { name: 'a2a card',     weight: 5,  filled: !!card.endpoints?.a2aCard },

    // Source — 20%
    { name: 'github',  weight: 10, filled: !!card.source?.github },
    { name: 'version', weight: 5,  filled: !!card.source?.version },
    { name: 'license', weight: 5,  filled: !!card.source?.license },

    // Website & Docs — 10%
    { name: 'website', weight: 5, filled: !!card.endpoints?.website },
    { name: 'docs',    weight: 5, filled: !!card.endpoints?.docs },

    // Social — 10%
    { name: 'twitter',             weight: 5, filled: !!card.social?.twitter },
    { name: 'discord or telegram', weight: 5, filled: !!card.social?.discord || !!card.social?.telegram },
  ]

  const totalWeight  = fields.reduce((s, f) => s + f.weight, 0)
  const filledWeight = fields.filter(f => f.filled).reduce((s, f) => s + f.weight, 0)
  const percentage   = Math.round((filledWeight / totalWeight) * 100)

  const completedFields = fields.filter(f => f.filled).map(f => f.name)
  const missingFields   = fields.filter(f => !f.filled).map(f => f.name)

  const hasEndpoint = !!card.endpoints?.api || !!card.endpoints?.mcp
  const hasSkill    = (card.skills?.length ?? 0) > 0
  const isA2AReady  = hasEndpoint && hasSkill

  return { percentage, completedFields, missingFields, isA2AReady }
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse an atom label into AgentCardData.
 *
 * New agents: label is JSON  → full card parsed.
 * Old agents: label is plain string "Name - description" → backward compat.
 */
export function parseAgentCard(atomLabel: string): Partial<AgentCardData> {
  // Try JSON (new format)
  try {
    const data = JSON.parse(atomLabel)
    if (typeof data === 'object' && data !== null && typeof data.name === 'string') {
      return data as Partial<AgentCardData>
    }
  } catch {
    // not JSON — fall through
  }

  // Fallback: plain string "Name - description" (old format)
  if (atomLabel.includes(' - ')) {
    const [namePart, ...rest] = atomLabel.split(' - ')
    const name = namePart.replace(/^Agent:(?:\w+:)?\s*/i, '').trim()
    const description = rest.join(' - ').trim() || undefined
    return { name, description }
  }

  // Bare name
  const name = atomLabel.replace(/^Agent:(?:\w+:)?\s*/i, '').trim()
  return { name }
}

/**
 * Extract the agent name from an atom label.
 * Handles JSON labels (new) and plain string labels (old).
 */
export function agentNameFromLabel(label: string): string {
  const card = parseAgentCard(label)
  return card.name || label.split(' - ')[0].replace(/^Agent:(?:\w+:)?\s*/i, '').trim() || label
}

/**
 * Serialize AgentCardData to a JSON atom label.
 * Strips empty/undefined fields to keep it compact.
 */
export function serializeAgentCard(card: AgentCardData): string {
  const clean = (obj: Record<string, unknown>): Record<string, unknown> | undefined => {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === '') continue
      if (typeof v === 'object' && !Array.isArray(v)) {
        const cleaned = clean(v as Record<string, unknown>)
        if (cleaned && Object.keys(cleaned).length > 0) result[k] = cleaned
      } else if (Array.isArray(v) && v.length === 0) {
        continue
      } else {
        result[k] = v
      }
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  const payload: Record<string, unknown> = {
    name: card.name,
  }
  if (card.description) payload.description = card.description
  if (card.category)    payload.category    = card.category

  const endpoints = card.endpoints ? clean(card.endpoints as Record<string, unknown>) : undefined
  const source    = card.source    ? clean(card.source    as Record<string, unknown>) : undefined
  const social    = card.social    ? clean(card.social    as Record<string, unknown>) : undefined

  if (endpoints) payload.endpoints = endpoints
  if (source)    payload.source    = source
  if (social)    payload.social    = social

  return JSON.stringify(payload)
}
