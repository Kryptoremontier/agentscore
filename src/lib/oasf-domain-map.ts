/**
 * OASF -> Bucket Map — Etap 2c. Maps the OASF taxonomy slugs the ERC-8004
 * cohort actually declares (`has category` domains, `has tag` skills) onto
 * the 8 canonical AgentScore buckets. Sibling of skill-domain-map.ts (same
 * fold-then-map shape), separate module: source predicates, source corpus
 * (cohort atoms, not our `is skilled in` corpus), and label vocabulary
 * (snake_case OASF slugs, not free-text skill labels) are all different.
 *
 * Live recon (2026-09-03, testnet): `has category` edges on the 168-agent
 * cohort are FLAT — no domain->domain hierarchy triples exist on-chain
 * (`finance_and_business` and `defi` are two independent flat edges on the
 * same agent, never joined by a `finance_and_business/defi` path or a
 * hierarchy triple between the two domain atoms). Only one label in the
 * entire cohort corpus contains a literal slash (`technology/blockchain`).
 * The dictionary below is therefore built primarily from exact flat labels
 * observed live, with slash-prefix rules kept as a documented fallback for
 * the hierarchical form should the indexer start emitting it.
 *
 * Every entry here is a judgment call over real OASF slugs — genuinely
 * ambiguous ones map to UNCATEGORIZED rather than being forced into a
 * bucket (thesis §9: no forced categorization).
 */

import { UNCATEGORIZED, type CanonicalDomain } from './domain-aliases'
import { SKILL_DOMAIN_BUCKETS } from './skill-domain-map'

const BUCKET_BY_LABEL: Readonly<Record<string, CanonicalDomain>> = Object.fromEntries(
  SKILL_DOMAIN_BUCKETS.map((d) => [d.label, d])
)

/**
 * OASF slug -> bucket label. Keys are the exact flat labels observed on the
 * live cohort corpus (`has category` for domains, `has tag` for skills) —
 * see project memory `erc8004-oasf-recon` update 2026-09-03 for the source
 * query. Lookup is trim + case-insensitive.
 */
const OASF_ALIASES: Readonly<Record<string, string>> = {
  // → Crypto / Onchain — finance_and_business family + blockchain/crypto tech
  finance_and_business: 'Crypto / Onchain',
  defi: 'Crypto / Onchain',
  trading: 'Crypto / Onchain',
  crypto_assets: 'Crypto / Onchain',
  cryptocurrency: 'Crypto / Onchain',
  blockchain: 'Crypto / Onchain',
  smart_contracts: 'Crypto / Onchain',
  investment_services: 'Crypto / Onchain',
  portfolio_management: 'Crypto / Onchain',
  // Judgment call: financial risk analysis co-occurs with defi/trading edges
  // in the live cohort data (not a safety/compliance context here) -> Crypto.
  risk_analysis: 'Crypto / Onchain',
  'technology/blockchain': 'Crypto / Onchain',

  // → AI / Coding — the rest of the technology family: engineering, ML, data
  artificial_intelligence: 'AI / Coding',
  deep_learning: 'AI / Coding',
  software_engineering: 'AI / Coding',
  apis_integration: 'AI / Coding',
  web_development: 'AI / Coding',
  // Judgment call: engineering-context data/test work, not research analysis.
  data_collection: 'AI / Coding',
  experimentation: 'AI / Coding',

  // → Knowledge / Productivity — education family + analytical/info skills
  education: 'Knowledge / Productivity',
  educational_technology: 'Knowledge / Productivity',
  e_learning: 'Knowledge / Productivity',
  curriculum_design: 'Knowledge / Productivity',
  learning_management_systems: 'Knowledge / Productivity',
  pedagogy: 'Knowledge / Productivity',
  // Judgment call: general information/content work, closest existing bucket.
  news: 'Knowledge / Productivity',
  'analytical_skills/data_analysis': 'Knowledge / Productivity',

  // → Agriculture — direct match, no ambiguity
  agriculture: 'Agriculture',
  agricultural_technology: 'Agriculture',
  crop_management: 'Agriculture',
  livestock_management: 'Agriculture',
  precision_agriculture: 'Agriculture',
  sustainable_farming: 'Agriculture',

  // → Energy — direct match, no ambiguity
  energy: 'Energy',
  energy_management: 'Energy',
  energy_storage: 'Energy',
  oil_and_gas: 'Energy',

  // → Safety / Identity — identity, integrity, and compliance/monitoring
  identity_verification: 'Safety / Identity',
  security: 'Safety / Identity',
  harmful_content_detection: 'Safety / Identity',
  misinformation_detection: 'Safety / Identity',
  // Judgment call: AML/fraud-monitoring reading, not a finance-performance one.
  transaction_monitoring: 'Safety / Identity',
}

/**
 * Prefix-family fallback for slash-form OASF slugs not in the exact
 * dictionary above (defensive — the live cohort corpus is flat today, but
 * the indexer or a future network could emit true `parent/child` labels).
 * Order matters: checked top-to-bottom, first match wins.
 */
const PREFIX_RULES: ReadonlyArray<{ prefix: string; bucket: string }> = [
  { prefix: 'technology/blockchain', bucket: 'Crypto / Onchain' },
  { prefix: 'finance_and_business/', bucket: 'Crypto / Onchain' },
  { prefix: 'technology/', bucket: 'AI / Coding' },
  { prefix: 'analytical_skills/', bucket: 'Knowledge / Productivity' },
]

const LOOKUP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>()
  for (const [alias, bucket] of Object.entries(OASF_ALIASES)) m.set(alias.toLowerCase(), bucket)
  return m
})()

export type OasfBucketStatus = CanonicalDomain['status'] | 'uncategorized'

export interface OasfBucketMapping {
  /** The raw OASF slug as supplied. */
  input: string
  /** Canonical/pending bucket label, or UNCATEGORIZED. */
  bucket: string
  status: OasfBucketStatus
  /** Reusable term_id when the bucket is canonical; otherwise null. */
  termId: string | null
}

/**
 * Map a raw OASF slug (domain or skill, `has category` or `has tag` object
 * label) to its canonical bucket. Exact-label lookup first (built from the
 * live flat corpus), then slash-prefix family fallback, then UNCATEGORIZED.
 * Unknown labels are surfaced, never dropped — same discipline as
 * mapSkillToBucket in skill-domain-map.ts.
 */
export function mapOasfToBucket(raw: string): OasfBucketMapping {
  const key = (raw ?? '').trim().toLowerCase()
  if (!key) return { input: raw, bucket: UNCATEGORIZED, status: 'uncategorized', termId: null }

  let bucket = LOOKUP.get(key)
  if (!bucket) {
    const rule = PREFIX_RULES.find((r) => key.startsWith(r.prefix))
    bucket = rule?.bucket
  }
  if (!bucket) {
    return { input: raw, bucket: UNCATEGORIZED, status: 'uncategorized', termId: null }
  }
  const domain = BUCKET_BY_LABEL[bucket]
  return { input: raw, bucket, status: domain.status, termId: domain.termId }
}
