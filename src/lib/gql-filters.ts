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
 * Usage (template string):
 *   atoms(where: ${AGENT_WHERE_STR}) { ... }
 *
 * Usage (object):
 *   where: AGENT_WHERE_OBJ
 */

import { APP_CONFIG } from './app-config'

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

// ── Agent filters ─────────────────────────────────────────────────────────────

/**
 * Full where-clause STRING for agent atoms.
 * e.g. `atoms(where: ${AGENT_WHERE_STR}) { ... }`
 */
export const AGENT_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `{ label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" }${dateFragStr()} }`
  : dateFragStr()
    ? `{ created_at: { _gte: "${APP_CONFIG.ALPHA_DATE}" } }`
    : '{}'

/**
 * Where-clause OBJECT for agent atoms (structured queries).
 */
export const AGENT_WHERE_OBJ: Record<string, unknown> = APP_CONFIG.APP_SCOPE_ENABLED
  ? { label: { _ilike: `${APP_CONFIG.AGENT_PREFIX}%` }, ...dateFragObj() }
  : { ...dateFragObj() }

// ── Skill filters ─────────────────────────────────────────────────────────────

export const SKILL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `{ label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" }${dateFragStr()} }`
  : dateFragStr()
    ? `{ created_at: { _gte: "${APP_CONFIG.ALPHA_DATE}" } }`
    : '{}'

export const SKILL_WHERE_OBJ: Record<string, unknown> = APP_CONFIG.APP_SCOPE_ENABLED
  ? { label: { _ilike: `${APP_CONFIG.SKILL_PREFIX}%` }, ...dateFragObj() }
  : { ...dateFragObj() }

// ── Claim (triple) subject/object filters ────────────────────────────────────

/**
 * The _or clause that scopes triples to AgentScore subjects/objects.
 * Used inside a triple `where: { ... }` block.
 */
export const TRIPLE_SUBJECT_OR_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `_or: [
        { subject: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } }
        { subject: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } }
      ]`
  : ''

export const TRIPLE_OBJECT_OR_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `_or: [
        { object: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } }
        { object: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } }
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
  ? `shares: { _gt: "0" } vault: { term: { atom: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } } }`
  : 'shares: { _gt: "0" }'

export const SKILL_VAULT_POSITION_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `shares: { _gt: "0" } vault: { term: { atom: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } } }`
  : 'shares: { _gt: "0" }'

export const CLAIM_VAULT_POSITION_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `shares: { _gt: "0" } vault: { term: { triple: { subject: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } } } }`
  : 'shares: { _gt: "0" }'

// ── Signal vault filters ──────────────────────────────────────────────────────

export const AGENT_SIGNAL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `vault: { term: { atom: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } } }`
  : ''

export const SKILL_SIGNAL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `vault: { term: { atom: { label: { _ilike: "${APP_CONFIG.SKILL_PREFIX}%" } } } }`
  : ''

export const CLAIM_SIGNAL_WHERE_STR: string = APP_CONFIG.APP_SCOPE_ENABLED
  ? `vault: { term: { triple: { subject: { label: { _ilike: "${APP_CONFIG.AGENT_PREFIX}%" } } } } }`
  : ''

// ── Convenience: prefix accessors ────────────────────────────────────────────

export const AGENT_PREFIX = APP_CONFIG.AGENT_PREFIX
export const SKILL_PREFIX = APP_CONFIG.SKILL_PREFIX
