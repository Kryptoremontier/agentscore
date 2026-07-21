/**
 * Skill-corpus junk filter — TRANSITIONAL MODULE.
 * ──────────────────────────────────────────────────────────────────────────
 * The indexer (V1) only classifies atoms as Thing/Organization/caip10/Person/
 * Book, so the raw "is skilled in" object corpus contains non-skills: account
 * handles (intuitionbilly.eth), leaked predicate labels (has tag), and vanity
 * self-descriptions (Flamebearer, LOCKED IN). This module drops them.
 *
 * REVISIT / RETIRE when the new backend entity classification lands
 * (intuition-data-structures) — proper atom typing should make most of these
 * rules unnecessary. Keep this file small and rule-per-section so it is easy
 * to delete piecemeal.
 *
 * Dropped labels are never silently vanished — callers receive a JunkReason
 * and are expected to count/surface them (see refineSkillTriples).
 */

export type JunkReason = 'account_handle' | 'predicate_label' | 'vanity'

/**
 * Leaked predicate labels — exact match (case-insensitive).
 * Seeded with known Intuition predicates observed or plausible as leaks.
 * Extend by appending; keep lowercase.
 */
const PREDICATE_LABELS: ReadonlySet<string> = new Set([
  'has tag',
  'has category',
  'is skilled in',
  'is best at',
  'belongs to',
  'same as',
  'uses',
  'is a',
  'in context of',
  'trusts',
  'endorses',
  'follows',
  'istrustedfor',
  'hasagentskill',
])

/**
 * Vanity / self-description labels — exact match (case-insensitive).
 * Titles people give themselves, not skills. Extend by appending; keep lowercase.
 */
const VANITY_LABELS: ReadonlySet<string> = new Set([
  'locked in',
  'flamebearer',
  'builder',
  'a developer',
  'web3 thought leader',
  'artefact',
  'sofia',
])

/**
 * Classify a (cleaned) skill label as junk, or null if it may be a real skill.
 * Rules:
 *  1. account handles — ENS-style names (*.eth) and 0x hex identifiers
 *     (addresses, term_ids)
 *  2. leaked predicate labels — exact-match blocklist
 *  3. explicit vanity blocklist
 */
export function classifyJunk(label: string): JunkReason | null {
  const trimmed = label.trim()
  const lower = trimmed.toLowerCase()
  if (!lower) return null

  if (/\.eth$/.test(lower) || /^0x[a-f0-9]{6,}$/.test(lower)) return 'account_handle'
  if (PREDICATE_LABELS.has(lower)) return 'predicate_label'
  if (VANITY_LABELS.has(lower)) return 'vanity'
  return null
}
