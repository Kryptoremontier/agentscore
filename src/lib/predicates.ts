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
