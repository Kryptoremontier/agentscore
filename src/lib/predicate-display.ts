/**
 * Predicate display formatting.
 *
 * Converts canonical camelCase predicate labels (e.g. "hasAgentSkill")
 * into human-readable form (e.g. "has Agent Skill") for UI display.
 *
 * Canonical labels live in src/lib/predicates.ts and MUST NOT be changed —
 * they are stored on-chain and referenced in Intuition Ontology. This module
 * only affects display, never persisted data.
 */

/**
 * Curated map of canonical labels (from any era) → display strings.
 * Both legacy camelCase (testnet) and new lowercase-with-spaces (mainnet)
 * forms are recognized so the UI looks consistent across networks.
 */
const DISPLAY_OVERRIDES: Record<string, string> = {
  // Core trust predicates
  hasAgentSkill:        'has agent skill',
  'has agent skill':    'has agent skill',
  trusts:               'trusts',
  opposes:              'opposes',
  distrusts:            'distrusts',
  evaluatedBy:          'evaluated by',
  'evaluated by':       'evaluated by',
  delegatedTo:          'delegated to',
  'delegated to':       'delegated to',

  // Capability / relationship / opinion predicates
  isCertifiedBy:        'is certified by',
  'is certified by':    'is certified by',
  worksWellWith:        'works well with',
  'works well with':    'works well with',
  isAlternativeTo:      'is alternative to',
  'is alternative to':  'is alternative to',
  dependsOn:            'depends on',
  'depends on':         'depends on',
  enhances:             'enhances',
  isBetterThan:         'is better than',
  'is better than':     'is better than',
  worksBadWith:         'works bad with',
  'works bad with':     'works bad with',
  endorses:             'endorses',

  // Reports / attestations
  reported_for_scam:      'reported for scam',
  reported_for_spam:      'reported for spam',
  reported_for_injection: 'reported for injection',
  verified_by:            'verified by',
  vouches_for:            'vouches for',

  // Common ontology predicates (Saulo)
  is:                  'is',
  hasA:                'has a',
  hasAn:               'has an',
  belongs_to:          'belongs to',
  related_to:          'related to',
  resolved_to:         'resolved to',
}

/**
 * Format a predicate label for display.
 * - Known predicates use curated overrides
 * - Unknown camelCase labels are split on capital letters: "fooBarBaz" → "foo Bar Baz"
 * - Unknown snake/kebab labels are normalized: "foo_bar" / "foo-bar" → "foo bar"
 * - Falsy/non-string input returns an em-dash placeholder
 */
export function formatPredicateLabel(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') return '—'

  const trimmed = label.trim()
  if (!trimmed) return '—'

  if (DISPLAY_OVERRIDES[trimmed]) return DISPLAY_OVERRIDES[trimmed]

  // Replace separators with spaces
  let result = trimmed.replace(/[_-]+/g, ' ')

  // Split camelCase into words (insert space before uppercase letters preceded by lowercase)
  result = result.replace(/([a-z])([A-Z])/g, '$1 $2')

  // Collapse multiple spaces and trim
  result = result.replace(/\s+/g, ' ').trim()

  return result || trimmed
}
