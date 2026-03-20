// src/types/claim.ts

// ─── Predicate types ───

export type PredicateId =
  | 'is-banger-with'
  | 'works-best-with'
  | 'is-better-than'
  | 'is-required-by'
  | 'enhances'
  | 'replaces'
  | 'competes-with'
  | 'has-agent-skill'
  | 'is-certified-by'
  | 'custom'

export interface PredicateConfig {
  id: PredicateId
  label: string        // Human-readable: "is banger with"
  atomLabel: string    // On-chain atom label: "isBangerWith"
  icon: string
  color: string
  description: string
  category: 'positive' | 'negative' | 'neutral' | 'comparative'
}

export const PREDICATES: PredicateConfig[] = [
  {
    id: 'is-banger-with',
    label: 'is banger with',
    atomLabel: 'isBangerWith',
    icon: 'Flame',
    color: '#C8963C',
    description: 'This agent/skill combination is exceptional',
    category: 'positive',
  },
  {
    id: 'works-best-with',
    label: 'works best with',
    atomLabel: 'worksBestWith',
    icon: 'HeartHandshake',
    color: '#2ECC71',
    description: 'These work great together',
    category: 'positive',
  },
  {
    id: 'is-better-than',
    label: 'is better than',
    atomLabel: 'isBetterThan',
    icon: 'TrendingUp',
    color: '#38B6FF',
    description: 'Direct comparison — one outperforms the other',
    category: 'comparative',
  },
  {
    id: 'is-required-by',
    label: 'is required by',
    atomLabel: 'isRequiredBy',
    icon: 'Link',
    color: '#B5BDC6',
    description: 'Dependency relationship',
    category: 'neutral',
  },
  {
    id: 'enhances',
    label: 'enhances',
    atomLabel: 'enhances',
    icon: 'Sparkles',
    color: '#C9A84C',
    description: 'Makes the other better',
    category: 'positive',
  },
  {
    id: 'replaces',
    label: 'replaces',
    atomLabel: 'replaces',
    icon: 'ArrowLeftRight',
    color: '#A87820',
    description: 'Can be used instead of',
    category: 'comparative',
  },
  {
    id: 'competes-with',
    label: 'competes with',
    atomLabel: 'competesWith',
    icon: 'Swords',
    color: '#FF4D4F',
    description: 'Direct competitor',
    category: 'comparative',
  },
  {
    id: 'has-agent-skill',
    label: 'has agent skill',
    atomLabel: 'hasAgentSkill',
    icon: 'ShieldCheck',
    color: '#2EE6D6',
    description: 'Agent has this skill or capability',
    category: 'positive',
  },
  {
    id: 'is-certified-by',
    label: 'is certified by',
    atomLabel: 'isCertifiedBy',
    icon: 'BadgeCheck',
    color: '#2ECC71',
    description: 'Officially certified or approved',
    category: 'positive',
  },
  {
    id: 'custom',
    label: 'custom predicate',
    atomLabel: '',
    icon: 'MessageSquare',
    color: '#6b7280',
    description: 'Custom relationship',
    category: 'neutral',
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
  return PREDICATES.find(p =>
    p.label === predicateLabel ||
    p.atomLabel === predicateLabel ||
    p.id === predicateLabel
  )
}

export function getAtomType(label: string): 'agent' | 'skill' | 'unknown' {
  if (/^Agent:/i.test(label)) return 'agent'
  if (/^Skill:/i.test(label)) return 'skill'
  return 'unknown'
}

export function getAtomName(label: string): string {
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
