// src/lib/predicates.ts
//
// Canonical predicate labels for AgentScore triples.
//
// LABEL CONVENTION (mainnet):
//   Lowercase with spaces — aligned with Saulo's Intuition Ontology
//   (e.g. "belongs to", "related to", "resolved to" on portal.intuition.systems).
//
// On testnet legacy camelCase labels (`hasAgentSkill`, `evaluatedBy`, ...) may
// still exist; the display layer in `predicate-display.ts` formats both forms
// consistently. Switch the active set with NEXT_PUBLIC_NETWORK env var.
//
// Usage:
//   import { PREDICATES_CONFIG } from '@/lib/predicates'
//   createTripleClaim(cfg, subject, PREDICATES_CONFIG.agentHasSkill, object)

const NETWORK = process.env['NEXT_PUBLIC_NETWORK'] ?? 'testnet'
const IS_MAINNET = NETWORK === 'mainnet'

/**
 * Mainnet labels — lowercase, space-separated, human-readable.
 * Match the convention used by Intuition core ontology atoms
 * ("belongs to", "related to", "resolved to", "true", "false", ...).
 */
const MAINNET_LABELS = {
  agentHasSkill:      'has agent skill',
  personTrustsAgent:  'trusts',
  personOpposesAgent: 'opposes',
  agentEvaluatedBy:   'evaluated by',
  agentDelegatedTo:   'delegated to',
} as const

/**
 * Testnet labels — legacy camelCase from initial development.
 * Kept for backward compatibility with atoms already registered on testnet.
 */
const TESTNET_LABELS = {
  agentHasSkill:      'hasAgentSkill',
  personTrustsAgent:  'trusts',
  personOpposesAgent: 'opposes',
  agentEvaluatedBy:   'evaluatedBy',
  agentDelegatedTo:   'delegatedTo',
} as const

export const PREDICATES_CONFIG = IS_MAINNET ? MAINNET_LABELS : TESTNET_LABELS

export type PredicateKey = keyof typeof PREDICATES_CONFIG
export type PredicateAtomLabel = (typeof PREDICATES_CONFIG)[PredicateKey]

// ─── Report helpers ────────────────────────────────────────────────────────

/** Testnet predicate labels that indicate a report triple */
const TESTNET_REPORT_PREDICATES = new Set([
  'reported_for_scam',
  'reported_for_spam',
  'reported_for_injection',
  'reported_for_impersonation',
])

/**
 * Returns true if a triple represents a "report" regardless of network.
 * Pass the predicate atom label (testnet) or term_id (mainnet).
 */
export function isReportedFor(predicateLabelOrTermId: string): boolean {
  if (IS_MAINNET) {
    // lazy import avoids circular dep — compare against known mainnet term_id
    return predicateLabelOrTermId === '0x51f1febac0b9d05953442f082597c5d1ce827bd2f888446ad811692e0a0f428d'
  }
  return TESTNET_REPORT_PREDICATES.has(predicateLabelOrTermId)
}

/**
 * Returns the human-readable report category label for display.
 *
 * Mainnet: pass object atom label ('Scam' | 'Spam' | 'Injection') or term_id.
 * Testnet: pass predicate label ('reported_for_scam' etc.).
 */
export function reportObject(predicateOrObjectLabel: string, objectTermId?: string): string {
  if (IS_MAINNET && objectTermId) {
    const OBJECT_MAP: Record<string, string> = {
      '0x27f33aaa8e3ff821e0eff6fedfec0b20a29164e21848c5f33e736eede13c39ba': 'Scam',
      '0x6ae6a37850484a61d76ad868c83d1bbe4d6975fa29cd724d7485141a03cde78f': 'Spam',
      '0x8e7674f0813f000a12951d8bf1ea4c8ffac05a2ab5d56fc4f9550a0a19a5887a': 'Injection',
    }
    return OBJECT_MAP[objectTermId] ?? predicateOrObjectLabel
  }
  // testnet: extract category from predicate label suffix
  if (predicateOrObjectLabel.startsWith('reported_for_')) {
    const suffix = predicateOrObjectLabel.replace('reported_for_', '')
    return suffix.charAt(0).toUpperCase() + suffix.slice(1)
  }
  return predicateOrObjectLabel
}
