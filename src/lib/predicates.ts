// src/lib/predicates.ts
//
// Canonical predicate labels for AgentScore triples.
// Keep this list in sync with Intuition Observatory's whitelisted predicates.
//
// Usage:
//   import { PREDICATES_CONFIG } from '@/lib/predicates'
//   createTripleClaim(cfg, subject, PREDICATES_CONFIG.agentHasSkill, object)

export const PREDICATES_CONFIG = {
  agentHasSkill:    'hasAgentSkill',
  personTrustsAgent: 'trusts',
  personOpposesAgent: 'opposes',
  agentEvaluatedBy: 'evaluatedBy',
  agentDelegatedTo: 'delegatedTo',
} as const

export type PredicateKey = keyof typeof PREDICATES_CONFIG
export type PredicateAtomLabel = (typeof PREDICATES_CONFIG)[PredicateKey]
