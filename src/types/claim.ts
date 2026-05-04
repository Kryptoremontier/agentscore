// src/types/claim.ts

// ─── Predicate types ───

export type PredicateId =
  | 'has-agent-skill'
  | 'is-certified-by'
  | 'works-well-with'
  | 'is-alternative-to'
  | 'depends-on'
  | 'enhances'
  | 'is-better-than'
  | 'works-bad-with'
  | 'endorses'
  | 'custom'

export interface PredicateConfig {
  id: PredicateId
  label: string                  // Human-readable display label: "has agent skill"
  atomLabel: string              // On-chain atom label (network-aware)
  atomLabelMainnet: string       // Canonical label used on mainnet (lowercase + spaces)
  atomLabelTestnet: string       // Legacy label used on testnet (camelCase)
  icon: string
  color: string
  description: string
  category: 'positive' | 'negative' | 'neutral' | 'comparative'
  group: 'capability' | 'relationship' | 'opinion'
}

const NETWORK = (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_NETWORK'] : undefined) ?? 'testnet'
const IS_MAINNET = NETWORK === 'mainnet'

function pickLabel(mainnet: string, testnet: string): string {
  return IS_MAINNET ? mainnet : testnet
}

export const PREDICATES: PredicateConfig[] = [
  // ⚡ CAPABILITY — powers scoring & domains
  {
    id: 'has-agent-skill',
    label: 'has agent skill',
    atomLabel: pickLabel('has agent skill', 'hasAgentSkill'),
    atomLabelMainnet: 'has agent skill',
    atomLabelTestnet: 'hasAgentSkill',
    icon: 'ShieldCheck',
    color: '#F59E0B',
    description: 'Agent has this skill or capability',
    category: 'positive',
    group: 'capability',
  },
  {
    id: 'is-certified-by',
    label: 'is certified by',
    atomLabel: pickLabel('is certified by', 'isCertifiedBy'),
    atomLabelMainnet: 'is certified by',
    atomLabelTestnet: 'isCertifiedBy',
    icon: 'BadgeCheck',
    color: '#2ECC71',
    description: 'Officially certified or approved by entity',
    category: 'positive',
    group: 'capability',
  },
  // 🔗 RELATIONSHIP — discovery & connections
  {
    id: 'works-well-with',
    label: 'works well with',
    atomLabel: pickLabel('works well with', 'worksWellWith'),
    atomLabelMainnet: 'works well with',
    atomLabelTestnet: 'worksWellWith',
    icon: 'HeartHandshake',
    color: '#2ECC71',
    description: 'Compatible agents',
    category: 'positive',
    group: 'relationship',
  },
  {
    id: 'is-alternative-to',
    label: 'is alternative to',
    atomLabel: pickLabel('is alternative to', 'isAlternativeTo'),
    atomLabelMainnet: 'is alternative to',
    atomLabelTestnet: 'isAlternativeTo',
    icon: 'ArrowLeftRight',
    color: '#B5BDC6',
    description: 'Similar function',
    category: 'comparative',
    group: 'relationship',
  },
  {
    id: 'depends-on',
    label: 'depends on',
    atomLabel: pickLabel('depends on', 'dependsOn'),
    atomLabelMainnet: 'depends on',
    atomLabelTestnet: 'dependsOn',
    icon: 'Link',
    color: '#B5BDC6',
    description: 'Requires this to work',
    category: 'neutral',
    group: 'relationship',
  },
  {
    id: 'enhances',
    label: 'enhances',
    atomLabel: 'enhances',
    atomLabelMainnet: 'enhances',
    atomLabelTestnet: 'enhances',
    icon: 'Sparkles',
    color: '#C9A84C',
    description: 'Makes the other better',
    category: 'positive',
    group: 'relationship',
  },
  // 💬 OPINION — community stakeable sentiment
  {
    id: 'is-better-than',
    label: 'is better than',
    atomLabel: pickLabel('is better than', 'isBetterThan'),
    atomLabelMainnet: 'is better than',
    atomLabelTestnet: 'isBetterThan',
    icon: 'TrendingUp',
    color: '#38B6FF',
    description: 'Direct comparison',
    category: 'comparative',
    group: 'opinion',
  },
  {
    id: 'works-bad-with',
    label: 'works bad with',
    atomLabel: pickLabel('works bad with', 'worksBadWith'),
    atomLabelMainnet: 'works bad with',
    atomLabelTestnet: 'worksBadWith',
    icon: 'Swords',
    color: '#FF4D4F',
    description: 'Incompatible',
    category: 'negative',
    group: 'opinion',
  },
  {
    id: 'endorses',
    label: 'endorses',
    atomLabel: 'endorses',
    atomLabelMainnet: 'endorses',
    atomLabelTestnet: 'endorses',
    icon: 'ThumbsUp',
    color: '#38B6FF',
    description: 'Public endorsement',
    category: 'positive',
    group: 'opinion',
  },
  // Custom
  {
    id: 'custom',
    label: 'custom predicate',
    atomLabel: '',
    atomLabelMainnet: '',
    atomLabelTestnet: '',
    icon: 'MessageSquare',
    color: '#6b7280',
    description: 'Custom relationship',
    category: 'neutral',
    group: 'relationship',
  },
]

// ─── Claim (Triple) type ───

export interface Claim {
  // Triple identity
  id: string
  triple_id?: string
  term_id: string
  counter_term_id?: string | null

  // Subject (Agent or Skill atom)
  subject: {
    id: string
    label: string
    type: 'agent' | 'skill' | 'unknown'
    term_id?: string
  }

  // Predicate (relationship atom)
  predicate: {
    id: string
    label: string
    term_id?: string
    config?: PredicateConfig
  }

  // Object (Agent or Skill atom)
  object: {
    id: string
    label: string
    type: 'agent' | 'skill' | 'unknown'
    term_id?: string
  }

  // Creator
  creator?: { label?: string; id?: string } | null
  created_at: string

  // Trust data
  trust_score?: number
  trust_ratio?: number
  total_stake?: string
  stakers_count?: number

  positions_aggregate?: {
    aggregate?: {
      count?: number
      sum?: { shares?: string }
    }
  }
}

// ─── Display helpers ───

export function formatClaimText(claim: Claim): string {
  const subj = getAtomName(claim.subject.label)
  const obj  = getAtomName(claim.object.label)
  return `${subj} ${claim.predicate.label} ${obj}`
}

export function getPredicateConfig(predicateLabel: string): PredicateConfig | undefined {
  if (!predicateLabel) return undefined
  return PREDICATES.find(p =>
    p.label === predicateLabel ||
    p.atomLabel === predicateLabel ||
    p.atomLabelMainnet === predicateLabel ||
    p.atomLabelTestnet === predicateLabel ||
    p.id === predicateLabel
  )
}

export function getAtomType(label: string | null | undefined): 'agent' | 'skill' | 'unknown' {
  if (!label || typeof label !== 'string') return 'unknown'
  if (/^Agent:/i.test(label)) return 'agent'
  if (/^Skill:/i.test(label)) return 'skill'
  return 'unknown'
}

export function getAtomName(label: string | null | undefined): string {
  // Handle null/undefined labels
  if (!label || typeof label !== 'string') {
    return 'Unnamed'
  }
  
  // JSON label (new format): {"name":"...","description":"..."}
  try {
    const parsed = JSON.parse(label)
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.name === 'string') {
      return parsed.name
    }
  } catch { /* not JSON — fall through */ }
  // Legacy plain-text format: "Agent:INTU: Name - description"
  return label
    .replace(/^Agent:(?:\w+:)?\s*/i, '')
    .replace(/^Skill:(?:\w+:)?\s*/i, '')
    .split(' - ')[0]
    .trim()
}

/**
 * Strip legacy prefixes from an atom label for display.
 * Backward-compatible: old atoms with "Agent:INTU:" / "Skill:INTU:" prefixes
 * display cleanly; new atoms without prefixes pass through unchanged.
 */
export const cleanAtomName = getAtomName
