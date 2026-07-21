/**
 * Domain Score Engine — PoC for domain-scoped trust (ARP / "billy" direction).
 * ──────────────────────────────────────────────────────────────────────────
 * Produces a PER-DOMAIN score vector for an entity instead of one global score.
 * This is a proof-of-concept of the SHAPE (a vector keyed by canonical domain),
 * not the final scoring math.
 *
 * PURE FUNCTIONS ONLY. No side effects, no I/O, no clock, no chain access.
 * Deliberately standalone: this module does NOT import or touch the live
 * scoring engines (trust-score-engine / composite-trust). Fully unit-testable.
 *
 * Pipeline:
 *   raw `has category` attestations → normalizeCategory() → per-bucket accrual
 *   → { count, distinctAttesters, score, sources } vector, plus surfaced lists
 *   of any PENDING_CANONICAL / Uncategorized labels (taxonomy gaps for the UI).
 */

import { normalizeCategory, type NormalizationStatus } from './domain-aliases'

/** One `has category` attestation: an entity tagged with `category` by `attester`. */
export interface CategoryAttestation {
  /** Raw category label from the `has category` triple's object atom. */
  category: string
  /** Wallet that authored the triple (the attester). Used for diversity weighting. */
  attester: string
}

export interface DomainScore {
  /** Canonical/pending bucket label (or 'Uncategorized'). */
  bucket: string
  /** Reusable mainnet term_id when canonical; null for pending/uncategorized. */
  termId: string | null
  status: NormalizationStatus
  /** Total attestations folded into this bucket. */
  count: number
  /** Distinct attester wallets (independence signal). */
  distinctAttesters: number
  /** PoC score — see formula in `scoreDomains`. */
  score: number
  /** Distinct raw labels that normalized into this bucket (for the UI "money shot"). */
  sources: string[]
}

export interface DomainScoreResult {
  /** Per-domain vector, keyed by bucket label. */
  vector: Record<string, DomainScore>
  /** Raw labels that hit 'Uncategorized' (surface, don't drop). */
  uncategorized: string[]
  /** Raw labels folded into PENDING_CANONICAL buckets (taxonomy gaps to fill). */
  pendingCanonical: string[]
  /** Total attestations processed. */
  totalAttestations: number
}

/**
 * PoC scoring weights. Intentionally trivial and explicit.
 * Rationale: an INDEPENDENT attester is far stronger evidence than a repeat
 * tag from the same wallet (basic sybil resistance). So each distinct attester
 * is worth more than each additional repeat attestation.
 *   score = distinctAttesters × DISTINCT_ATTESTER_WEIGHT
 *         + repeats          × REPEAT_ATTESTATION_WEIGHT
 *   where repeats = count − distinctAttesters
 * This is a placeholder shape, NOT the final formula.
 */
export const DISTINCT_ATTESTER_WEIGHT = 10
export const REPEAT_ATTESTATION_WEIGHT = 1

interface Bucket {
  termId: string | null
  status: NormalizationStatus
  count: number
  attesters: Set<string>
  sources: Set<string>
}

/**
 * Score an entity's `has category` attestations into a per-domain vector.
 * Pure: same input → same output. Tolerates empty input and malformed rows.
 */
export function scoreDomains(attestations: readonly CategoryAttestation[]): DomainScoreResult {
  const acc = new Map<string, Bucket>()
  const uncategorized = new Set<string>()
  const pendingCanonical = new Set<string>()
  let total = 0

  for (const a of attestations ?? []) {
    if (!a || typeof a.category !== 'string') continue
    const norm = normalizeCategory(a.category)
    total++

    let b = acc.get(norm.bucket)
    if (!b) {
      b = { termId: norm.termId, status: norm.status, count: 0, attesters: new Set(), sources: new Set() }
      acc.set(norm.bucket, b)
    }
    b.count++
    b.sources.add(a.category)
    const attester = (a.attester ?? '').trim().toLowerCase()
    if (attester) b.attesters.add(attester)

    if (norm.status === 'uncategorized') uncategorized.add(a.category)
    else if (norm.status === 'pending_canonical') pendingCanonical.add(a.category)
  }

  const vector: Record<string, DomainScore> = {}
  for (const [bucket, b] of acc) {
    const distinctAttesters = b.attesters.size
    const repeats = Math.max(0, b.count - distinctAttesters)
    const score = distinctAttesters * DISTINCT_ATTESTER_WEIGHT + repeats * REPEAT_ATTESTATION_WEIGHT
    vector[bucket] = {
      bucket,
      termId: b.termId,
      status: b.status,
      count: b.count,
      distinctAttesters,
      score,
      sources: [...b.sources].sort(),
    }
  }

  return {
    vector,
    uncategorized: [...uncategorized].sort(),
    pendingCanonical: [...pendingCanonical].sort(),
    totalAttestations: total,
  }
}
