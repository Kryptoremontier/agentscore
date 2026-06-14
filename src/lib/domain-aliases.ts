/**
 * Domain Alias Map — the "interpretation pattern" for domain-scoped trust.
 * ──────────────────────────────────────────────────────────────────────────
 * PROBLEM (observed on mainnet `has category`, predicate 0x96c20ddd…):
 *   The live category graph is fragmented. A single conceptual domain is
 *   expressed many ways — e.g. "Crypto / Onchain" (curated, Title Case) vs
 *   `defi`, `crypto_assets`, `smart_contracts`, `blockchain` (agent-tagged,
 *   snake_case). 61% of all category triples come from ONE auto-tagger wallet
 *   minting ~40 one-off labels. Scoring naïvely would shatter one domain's
 *   signal across a dozen fragments.
 *
 * THIS FILE is the normalization / interpretation layer: it folds fragmented
 * labels onto a small canonical domain set, reusing the EXISTING mainnet bucket
 * atoms (see `termId`s below) rather than minting new ones.
 *
 * FUTURE ON-CHAIN MIGRATION (subsumption, NOT identity):
 *   The interpretation pattern, when migrated on-chain, expresses each fragment
 *   label as BELONGING TO a canonical domain bucket — a subsumption hierarchy,
 *   not identity equivalence. Each alias → bucket entry becomes a future
 *   `[alias] belongs to [canonical bucket]` triple.
 *
 *   This is deliberately NOT the `same as` predicate: `same as` asserts identity
 *   equivalence (two atoms are the same entity), and `defi` is NOT the same
 *   entity as `Crypto / Onchain` — it is a narrower concept SUBSUMED BY it.
 *   The correct relation is categorization/subsumption: `belongs to`.
 *
 *   `belongs to` already exists on mainnet (atom 0x3317b232…, currently zero
 *   triples) — this fragment→bucket subsumption is its natural use case. Migrating
 *   this map turns the interpretation pattern into a verifiable, shared on-chain
 *   artifact instead of app-local config. Keep this file human-readable and 1:1
 *   with that intent — one alias line = one future `belongs to` triple.
 *
 * SCOPE: read-only interpretation. No chain writes. PoC.
 */

export type DomainStatus = 'canonical' | 'pending_canonical'

export interface CanonicalDomain {
  /** Display label — matches the on-chain `has category` object atom label exactly. */
  label: string
  /** Mainnet object-atom term_id to reuse. `null` = not yet minted (PENDING_CANONICAL). */
  termId: string | null
  status: DomainStatus
}

/**
 * The canonical domain set.
 * The 5 `canonical` buckets reuse existing mainnet atoms (curator 0x665e3192
 * for the first three; 0xD998… / 0x3AA4… for Social / Entertainment).
 * The 3 `pending_canonical` buckets are real domains observed in the live tail
 * that have NO canonical atom yet — surfaced honestly, never folded into the 5.
 */
export const CANONICAL_DOMAINS: readonly CanonicalDomain[] = [
  { label: 'Crypto / Onchain',         termId: '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42', status: 'canonical' },
  { label: 'AI / Coding',              termId: '0x0caa623ae3f31ffaa9bf4e27acd1c25d1f7fe3a141145fd77c82cd21b4f59226', status: 'canonical' },
  { label: 'Knowledge / Productivity', termId: '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4', status: 'canonical' },
  { label: 'Social',                   termId: '0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91', status: 'canonical' },
  { label: 'Entertainment',            termId: '0x4e0095d1e2ecfcdccc5abe6e562c513924fb5cddc35c5974ea45327c842618e6', status: 'canonical' },
  // ── PENDING_CANONICAL ── real mainnet domains with no canonical atom yet.
  { label: 'Agriculture',              termId: null, status: 'pending_canonical' },
  { label: 'Energy',                   termId: null, status: 'pending_canonical' },
  { label: 'Safety / Identity',        termId: null, status: 'pending_canonical' },
] as const

/** Sentinel bucket for labels we cannot map. Surfaced to the UI, never dropped. */
export const UNCATEGORIZED = 'Uncategorized'

/**
 * Fragmented label → canonical/pending bucket label.
 * Keys are lowercase; lookup is case-insensitive (see `normalizeCategory`).
 * Each line is conceptually a future `[key] belongs to [value]` on-chain triple
 * (subsumption — the fragment is categorized under the bucket, not equated to it).
 */
const ALIASES: Readonly<Record<string, string>> = {
  // → Crypto / Onchain
  blockchain: 'Crypto / Onchain',
  defi: 'Crypto / Onchain',
  crypto_assets: 'Crypto / Onchain',
  cryptocurrency: 'Crypto / Onchain',
  smart_contracts: 'Crypto / Onchain',
  trading: 'Crypto / Onchain',
  investment_services: 'Crypto / Onchain',
  finance_and_business: 'Crypto / Onchain',
  portfolio_management: 'Crypto / Onchain',
  transaction_monitoring: 'Crypto / Onchain',
  risk_analysis: 'Crypto / Onchain',
  // → AI / Coding
  artificial_intelligence: 'AI / Coding',
  deep_learning: 'AI / Coding',
  software_engineering: 'AI / Coding',
  web_development: 'AI / Coding',
  apis_integration: 'AI / Coding',
  data_collection: 'AI / Coding',
  experimentation: 'AI / Coding',
  // → Knowledge / Productivity
  education: 'Knowledge / Productivity',
  e_learning: 'Knowledge / Productivity',
  educational_technology: 'Knowledge / Productivity',
  curriculum_design: 'Knowledge / Productivity',
  learning_management_systems: 'Knowledge / Productivity',
  pedagogy: 'Knowledge / Productivity',
  work: 'Knowledge / Productivity',
  // → Social
  news: 'Social',
  // → Entertainment
  sports: 'Entertainment',
  games: 'Entertainment',
  // → Agriculture (PENDING_CANONICAL)
  agriculture: 'Agriculture',
  agricultural_technology: 'Agriculture',
  crop_management: 'Agriculture',
  precision_agriculture: 'Agriculture',
  livestock_management: 'Agriculture',
  sustainable_farming: 'Agriculture',
  // → Energy (PENDING_CANONICAL)
  energy: 'Energy',
  energy_storage: 'Energy',
  energy_management: 'Energy',
  oil_and_gas: 'Energy',
  // → Safety / Identity (PENDING_CANONICAL)
  security: 'Safety / Identity',
  harmful_content_detection: 'Safety / Identity',
  misinformation_detection: 'Safety / Identity',
  identity_verification: 'Safety / Identity',
}

/** label → CanonicalDomain (exact, by canonical label). */
const DOMAIN_BY_LABEL: Readonly<Record<string, CanonicalDomain>> = Object.fromEntries(
  CANONICAL_DOMAINS.map((d) => [d.label, d]),
)

/**
 * Precomputed case-insensitive lookup: lowercased label → canonical bucket label.
 * Includes canonical/pending labels themselves (Title-Case pass-through) AND
 * every alias. Built once at module load.
 */
const LOOKUP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>()
  for (const d of CANONICAL_DOMAINS) m.set(d.label.toLowerCase(), d.label) // pass-through
  for (const [alias, bucket] of Object.entries(ALIASES)) m.set(alias.toLowerCase(), bucket)
  return m
})()

export type NormalizationStatus = DomainStatus | 'uncategorized'

export interface Normalization {
  /** The raw label as supplied. */
  input: string
  /** Canonical/pending bucket label, or `UNCATEGORIZED`. */
  bucket: string
  status: NormalizationStatus
  /** Reusable mainnet term_id when the bucket is canonical; otherwise null. */
  termId: string | null
}

/**
 * Normalize a single raw category label to a canonical bucket.
 * Rule: trim + case-insensitive EXACT match against canonical labels and aliases.
 * Unknown labels are NOT dropped — they map to `UNCATEGORIZED` and are surfaced.
 */
export function normalizeCategory(raw: string): Normalization {
  const key = (raw ?? '').trim().toLowerCase()
  const bucket = key ? LOOKUP.get(key) : undefined
  if (!bucket) {
    return { input: raw, bucket: UNCATEGORIZED, status: 'uncategorized', termId: null }
  }
  const domain = DOMAIN_BY_LABEL[bucket]
  return { input: raw, bucket, status: domain.status, termId: domain.termId }
}
