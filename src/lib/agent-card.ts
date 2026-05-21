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
  image?: string
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
 * New format:  schema.org JSON { "@type": "Thing", "name": ..., ... }  → name, description, image.
 * Old format:  custom JSON (no @type)                                   → full card (backward compat).
 * Plain string: "Name - description" or "Agent:Name"                   → backward compat.
 */
export function parseAgentCard(atomLabel: string | null | undefined): Partial<AgentCardData> {
  if (!atomLabel || typeof atomLabel !== 'string') {
    return { name: 'Unnamed' }
  }
  try {
    const data = JSON.parse(atomLabel)
    if (typeof data === 'object' && data !== null) {
      // New schema.org Thing format
      if (data['@type'] === 'Thing' && typeof data.name === 'string') {
        const card: Partial<AgentCardData> = { name: data.name }
        if (typeof data.description === 'string') card.description = data.description
        if (typeof data.image === 'string') card.image = data.image
        return card
      }
      // Old custom JSON format — return as-is
      if (typeof data.name === 'string') {
        return data as Partial<AgentCardData>
      }
    }
  } catch {
    // not JSON — fall through
  }

  if (atomLabel.includes(' - ')) {
    const [namePart, ...rest] = atomLabel.split(' - ')
    const name = namePart.replace(/^Agent:(?:\w+:)?\s*/i, '').trim()
    const description = rest.join(' - ').trim() || undefined
    return { name, description }
  }

  const name = atomLabel.replace(/^Agent:(?:\w+:)?\s*/i, '').trim()
  return { name }
}

/**
 * Extract the agent name from an atom label.
 * Handles JSON labels (new) and plain string labels (old).
 */
export function agentNameFromLabel(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') return 'Unnamed'
  const card = parseAgentCard(label)
  return card.name || label.split(' - ')[0].replace(/^Agent:(?:\w+:)?\s*/i, '').trim() || label
}

/**
 * Serialize AgentCardData to a schema.org Thing JSON atom payload.
 *
 * Only name, description, and image go into the atom bytes.
 * All other fields (endpoints, source, social) are stored as separate triples
 * by registerAgentBatch() — see AGENT_CARD_PREDICATES.
 */
export function serializeAgentCard(card: Pick<AgentCardData, 'name' | 'description' | 'image' | 'category'>): string {
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: card.name,
  }
  if (card.description) payload.description = card.description
  if (card.image)       payload.image       = card.image
  return JSON.stringify(payload)
}
