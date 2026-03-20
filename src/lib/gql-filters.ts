/**
 * AgentScore — GraphQL Filter Builders
 *
 * All query filters for Agents, Skills, and Claims are defined here.
 * They respect APP_CONFIG so that app-scoping and alpha-date filtering
 * apply platform-wide from a single place.
 *
 * Two flavours are exported for each entity type:
 *   - *Str  → string fragment for template-literal GraphQL queries
 *   - *Obj  → plain object for structured/variable-based queries
 *
 * Filtering model (mainnet-aligned):
 *   Agents  — atoms that have a trust triple (predicate: "is trustworthy")
 *             OR legacy "Agent:INTU:" label prefix (backward compat)
 *   Skills  — atoms that have a type triple [skill] [is] [Agent Skill]
 *             OR legacy "Skill:INTU:" label prefix (backward compat)
 *
 * Usage (template string):
 *   atoms(where: ${AGENT_WHERE_STR}) { ... }
 *
 * Usage (object):
 *   where: AGENT_WHERE_OBJ
 */

import { APP_CONFIG } from './app-config'

// ── Canonical term IDs ────────────────────────────────────────────────────────

/**
 * "is trustworthy" predicate on Intuition Testnet.
 * Used in trust triples: [Agent] [is trustworthy] [AI Agent]
 * Agents are identified by having this triple as subject.
 */
const TRUST_PREDICATE_TERM_ID = '0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba'

// ── internal helpers ──────────────────────────────────────────────────────────

/** Returns the date condition fragment (string) or empty string. */
function dateFragStr(): string {
  return APP_CONFIG.ALPHA_DATE
    ? ` created_at: { _gte: "${APP_CONFIG.ALPHA_DATE}" }` : ''
}

/** Returns the date condition as a partial object, or empty object. */
function dateFragObj(): Record<string, unknown> {
  return APP_CONFIG.ALPHA_DATE
    ? { created_at: { _gte: APP_CONFIG.ALPHA_DATE } } : {}
}

/** Scope-off fallback: just a date filter or empty object. */
function scopeOffStr(): string {
  return APP_CONFIG.ALPHA_DATE
    ? `{ created_at: { _gte: "${APP_CONFIG.ALPHA_DATE}" } }`
    : '{}'
}

// ── Agent filters ─────────────────────────────────────────────────────────────
//
// Agents are identified by:
//  1. Trust triple as subject: [Agent] [is trustworthy] [AI Agent]   ← new semantic model
//  2. Legacy "Agent:INTU:" label prefix                              ← backward compat

/**
 * Full where-clause STRING for agent atoms.
 * e.g. `atoms(where: ${AGENT_WHERE_STR}) { ... }`
 */
export const AGENT_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `{ _or: [
        { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } }
        { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } }
      ]${dateFragStr()} }`
  : scopeOffStr()

/**
 * Where-clause OBJECT for agent atoms (structured queries).
 */
export const AGENT_WHERE_OBJ: Record<string, unknown> = APP_CONFIG.APP_SCOPE_ENABLED
  ? {
      _or: [
        { label: { _ilike: `${APP_CONFIG.AGENT_PREFIX}%` } },
        { as_subject_triples: { predicate_id: { _eq: TRUST_PREDICATE_TERM_ID } } },
      ],
      ...dateFragObj(),
    }
  : { ...dateFragObj() }

// ── Skill filters ─────────────────────────────────────────────────────────────
//
// Skills are identified by:
//  1. Type triple: [Skill] [is] [Agent Skill]   ← new semantic model
//  2. Legacy "Skill:INTU:" label prefix          ← backward compat

export const SKILL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `{ _or: [
        { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } }
        { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } }
      ]${dateFragStr()} }`
  : scopeOffStr()

export const SKILL_WHERE_OBJ: Record<string, unknown> = APP_CONFIG.APP_SCOPE_ENABLED
  ? {
      _or: [
        { label: { _ilike: `${APP_CONFIG.SKILL_PREFIX}%` } },
        { as_subject_triples: { predicate: { label: { _eq: 'is' } }, object: { label: { _eq: 'Agent Skill' } } } },
      ],
      ...dateFragObj(),
    }
  : { ...dateFragObj() }

// ── Claim (triple) subject/object filters ────────────────────────────────────

/**
 * The _or clause that scopes triples to AgentScore subjects.
 * Used inside a triple `where: { ... }` block.
 */
export const TRIPLE_SUBJECT_OR_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `_or: [
        { subject: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } }
        { subject: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } }
        { subject: { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } } }
        { subject: { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } } }
      ]`
  : ''

export const TRIPLE_OBJECT_OR_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `_or: [
        { object: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } }
        { object: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } }
        { object: { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } } }
        { object: { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } } }
      ]`
  : ''

/** Full claims (triples) WHERE string that includes subject+object scoping. */
export const CLAIMS_WHERE_STR: string = (() => {
  const parts: string[] = []
  if (APP_CONFIG.APP_SCOPE_ENABLED) {
    parts.push(`{ ${TRIPLE_SUBJECT_OR_STR} }`)
    parts.push(`{ ${TRIPLE_OBJECT_OR_STR} }`)
  }
  if (APP_CONFIG.ALPHA_DATE) {
    parts.push(`{ created_at: { _gte: "${APP_CONFIG.ALPHA_DATE}" } }`)
  }
  return parts.length > 0 ? `{ _and: [${parts.join('\n')}] }` : '{}'
})()

// ── Position / Signal vault filters ──────────────────────────────────────────

/**
 * Vault filter for positions/signals — scopes to AgentScore Agent vaults.
 * Used in: positions(where: ${AGENT_VAULT_POSITION_STR}) { ... }
 */
export const AGENT_VAULT_POSITION_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `shares: { _gt: "0" } vault: { term: { atom: { _or: [
        { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } }
        { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } }
      ] } } }`
  : 'shares: { _gt: "0" }'

export const SKILL_VAULT_POSITION_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `shares: { _gt: "0" } vault: { term: { atom: { _or: [
        { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } }
        { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } }
      ] } } }`
  : 'shares: { _gt: "0" }'

export const CLAIM_VAULT_POSITION_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `shares: { _gt: "0" } vault: { term: { triple: { subject: { _or: [
        { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } }
        { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } }
      ] } } } }`
  : 'shares: { _gt: "0" }'

// ── Signal vault filters ──────────────────────────────────────────────────────

export const AGENT_SIGNAL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `vault: { term: { atom: { _or: [
        { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } }
        { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } }
      ] } } }`
  : ''

export const SKILL_SIGNAL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `vault: { term: { atom: { _or: [
        { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } }
        { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } }
      ] } } }`
  : ''

export const CLAIM_SIGNAL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `vault: { term: { triple: { subject: { _or: [
        { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } }
        { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } }
      ] } } } }`
  : ''

// ── Inline fragments (for use inside nested template-literal where clauses) ───
//
// These emit just the _or content without wrapping { } so they can be embedded
// alongside other conditions in a where block:
//   `atoms(where: { ${AGENT_ATOM_INLINE} creator_id: { _eq: $addr } })`

export const AGENT_ATOM_INLINE: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `_or: [
        { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } }
        { as_subject_triples: { predicate_id: { _eq: "${TRUST_PREDICATE_TERM_ID}" } } }
      ]`
  : ''

export const SKILL_ATOM_INLINE: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `_or: [
        { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } }
        { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } }
      ]`
  : ''

// ── Convenience: prefix accessors (backward compat) ──────────────────────────

export const AGENT_PREFIX = APP_CONFIG.AGENT_PREFIX
export const SKILL_PREFIX = APP_CONFIG.SKILL_PREFIX
