/**
 * Skill → Domain Map — canonical-bucket grouping for the /domains skill corpus.
 * ──────────────────────────────────────────────────────────────────────────
 * Sibling of `domain-aliases.ts` (which folds CATEGORY labels from the mainnet
 * `has category` corpus). This file folds SKILL labels — the finer-grained
 * objects of `is skilled in` triples on testnet — onto the SAME canonical
 * bucket set. Bucket definitions/term_ids are imported from domain-aliases,
 * not duplicated.
 *
 * Pipeline (see `refineSkillTriples`):
 *   raw triples → cleanDomainName → junk filter (skill-junk-filter.ts,
 *   TRANSITIONAL) → case-fold + duplicate-atom merge → bucket mapping.
 *
 * Like domain-aliases, each alias line is conceptually a future
 * `[skill] belongs to [canonical bucket]` on-chain triple (subsumption).
 * Unknown non-junk labels map to UNCATEGORIZED — surfaced, never dropped.
 */

import {
  CANONICAL_DOMAINS,
  UNCATEGORIZED,
  type CanonicalDomain,
  type DomainStatus,
} from './domain-aliases'
import { classifyJunk } from './skill-junk-filter'
import { cleanDomainName, type DomainTripleData } from './domain-scoring'

export { UNCATEGORIZED }

/**
 * "Design / Creative" is a real cluster in the live skill corpus (Design,
 * Graphic Design, UX, Figma, Sound Design…) with NO canonical atom yet —
 * a PENDING_CANONICAL bucket, exactly like Agriculture/Energy were in the
 * category PoC. Defined here (not in domain-aliases) because it is observed
 * in the SKILL corpus only; move it to CANONICAL_DOMAINS once the atom is
 * minted.
 */
const DESIGN_CREATIVE: CanonicalDomain = {
  label: 'Design / Creative',
  termId: null,
  status: 'pending_canonical',
}

/** Bucket set for skill grouping: the 8 shared buckets + Design / Creative. */
export const SKILL_DOMAIN_BUCKETS: readonly CanonicalDomain[] = [
  ...CANONICAL_DOMAINS,
  DESIGN_CREATIVE,
] as const

/**
 * Skill label → bucket label. Keys lowercase; lookup is trim+case-insensitive
 * (folds philosophy/Philosophy). Seeded from the live testnet `is skilled in`
 * corpus (verified 7 Jul 2026). One line = one future `belongs to` triple.
 */
const SKILL_ALIASES: Readonly<Record<string, string>> = {
  // → Crypto / Onchain — chains, wallets, protocols, tokens, onchain products
  'blockchain technology': 'Crypto / Onchain',
  base: 'Crypto / Onchain',
  'rabby wallet': 'Crypto / Onchain',
  coinbase: 'Crypto / Onchain',
  'aerodrome finance': 'Crypto / Onchain',
  depin: 'Crypto / Onchain',
  nansen: 'Crypto / Onchain',
  tally: 'Crypto / Onchain',
  aethir: 'Crypto / Onchain',
  $trust: 'Crypto / Onchain',
  hodl: 'Crypto / Onchain',
  'metamask fiat on-ramp': 'Crypto / Onchain',
  'passport xyz (aka gitcoin passport)': 'Crypto / Onchain',
  'gitcoin passport': 'Crypto / Onchain',
  intuition: 'Crypto / Onchain',
  'intuition use case list': 'Crypto / Onchain',
  // → AI / Coding — languages, frameworks, engineering practice, agent tooling
  typescript: 'AI / Coding',
  react: 'AI / Coding',
  javascript: 'AI / Coding',
  php: 'AI / Coding',
  devops: 'AI / Coding',
  engineering: 'AI / Coding',
  'web search tool': 'AI / Coding',
  data: 'AI / Coding',
  chart: 'AI / Coding',
  // → Knowledge / Productivity — management, education, humanities, soft skills
  'project management': 'Knowledge / Productivity',
  'product management': 'Knowledge / Productivity',
  product: 'Knowledge / Productivity',
  education: 'Knowledge / Productivity',
  english: 'Knowledge / Productivity',
  philosophy: 'Knowledge / Productivity',
  leadership: 'Knowledge / Productivity',
  devrel: 'Knowledge / Productivity',
  // → Social — community work + social platforms
  community: 'Social',
  'community manager': 'Social',
  warpcast: 'Social',
  // → Entertainment
  music: 'Entertainment',
  touchdesigner: 'Entertainment',
  // → Design / Creative (PENDING_CANONICAL)
  design: 'Design / Creative',
  'graphic design': 'Design / Creative',
  ux: 'Design / Creative',
  ui: 'Design / Creative',
  figma: 'Design / Creative',
  'sound design': 'Design / Creative',
}

/** bucket label → CanonicalDomain. */
const BUCKET_BY_LABEL: Readonly<Record<string, CanonicalDomain>> = Object.fromEntries(
  SKILL_DOMAIN_BUCKETS.map((d) => [d.label, d]),
)

/** Precomputed lowercase lookup: bucket labels pass through + every alias. */
const LOOKUP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>()
  for (const d of SKILL_DOMAIN_BUCKETS) m.set(d.label.toLowerCase(), d.label)
  for (const [alias, bucket] of Object.entries(SKILL_ALIASES)) m.set(alias.toLowerCase(), bucket)
  return m
})()

export type SkillBucketStatus = DomainStatus | 'uncategorized'

export interface SkillBucketMapping {
  /** The raw label as supplied. */
  input: string
  /** Canonical/pending bucket label, or `UNCATEGORIZED`. */
  bucket: string
  status: SkillBucketStatus
  /** Reusable mainnet term_id when the bucket is canonical; otherwise null. */
  termId: string | null
}

/**
 * Map a (cleaned) skill label to its canonical bucket.
 * Rule: trim + case-insensitive EXACT match. Unknown labels are NOT dropped —
 * they map to `UNCATEGORIZED` and are surfaced. Junk detection is NOT this
 * function's job (see refineSkillTriples / skill-junk-filter).
 */
export function mapSkillToBucket(raw: string): SkillBucketMapping {
  const key = (raw ?? '').trim().toLowerCase()
  const bucket = key ? LOOKUP.get(key) : undefined
  if (!bucket) {
    return { input: raw, bucket: UNCATEGORIZED, status: 'uncategorized', termId: null }
  }
  const domain = BUCKET_BY_LABEL[bucket]
  return { input: raw, bucket, status: domain.status, termId: domain.termId }
}

export interface RefinedSkillTriples {
  /** Junk-free triples; case/duplicate skill atoms merged onto one skillId. */
  triples: DomainTripleData[]
  /** Distinct junk skill labels dropped (for the UI stat line). */
  junkCount: number
  /** The dropped labels themselves (cleaned), for debugging/reporting. */
  junkLabels: string[]
  /** Raw triple rows dropped as junk. */
  junkTripleCount: number
  /**
   * Folded-away skillId → representative skillId (non-identity entries only).
   * Folding merges, it must not lose: by-id consumers (getDomainAgents,
   * getSkillDetail) resolve incoming ids through this map so links to a
   * folded atom land on the merged leaderboard.
   */
  foldedSkillIds: ReadonlyMap<string, string>
}

/**
 * Refine the raw skill-triple stream — the single shared quality/structure
 * step applied at BOTH fetch boundaries (page + api-data) so every consumer
 * sees identical data:
 *  1. clean skill labels (cleanDomainName — strips Skill:/INTU: prefixes,
 *     " - description" tails)
 *  2. drop junk labels (TRANSITIONAL — see skill-junk-filter.ts)
 *  3. fold case-duplicates AND duplicate atoms sharing one label
 *     (philosophy/Philosophy; the two `TypeScript` atoms) onto a single
 *     representative skillId, so aggregation merges them into one domain.
 * Representative = variant with most triples; ties prefer an uppercase first
 * letter, then lowest term_id (deterministic).
 */
export function refineSkillTriples(triples: DomainTripleData[]): RefinedSkillTriples {
  const kept: DomainTripleData[] = []
  const junkLabelSet = new Set<string>()
  let junkTripleCount = 0

  for (const t of triples) {
    if (!t?.skillName) continue
    const cleaned = cleanDomainName(t.skillName)
    if (classifyJunk(cleaned)) {
      junkLabelSet.add(cleaned)
      junkTripleCount++
      continue
    }
    kept.push(cleaned === t.skillName ? t : { ...t, skillName: cleaned })
  }

  // Group surviving skill atoms by folded label, pick one representative per group.
  const groups = new Map<string, Map<string, { label: string; count: number }>>()
  for (const t of kept) {
    const foldKey = t.skillName.toLowerCase()
    const atoms = groups.get(foldKey) ?? new Map()
    const entry = atoms.get(t.skillId) ?? { label: t.skillName, count: 0 }
    entry.count++
    atoms.set(t.skillId, entry)
    groups.set(foldKey, atoms)
  }

  const representative = new Map<string, { skillId: string; skillName: string }>()
  const foldedSkillIds = new Map<string, string>()
  for (const [foldKey, atoms] of groups) {
    let best: { skillId: string; label: string; count: number } | null = null
    for (const [skillId, { label, count }] of atoms) {
      if (
        !best ||
        count > best.count ||
        (count === best.count && isUpperFirst(label) && !isUpperFirst(best.label)) ||
        (count === best.count && isUpperFirst(label) === isUpperFirst(best.label) && skillId < best.skillId)
      ) {
        best = { skillId, label, count }
      }
    }
    representative.set(foldKey, { skillId: best!.skillId, skillName: best!.label })
    for (const skillId of atoms.keys()) {
      if (skillId !== best!.skillId) foldedSkillIds.set(skillId, best!.skillId)
    }
  }

  const merged = kept.map((t) => {
    const rep = representative.get(t.skillName.toLowerCase())!
    return rep.skillId === t.skillId && rep.skillName === t.skillName
      ? t
      : { ...t, skillId: rep.skillId, skillName: rep.skillName }
  })

  const junkLabels = [...junkLabelSet].sort()
  return { triples: merged, junkCount: junkLabels.length, junkLabels, junkTripleCount, foldedSkillIds }
}

function isUpperFirst(label: string): boolean {
  const c = label.charAt(0)
  return c !== c.toLowerCase()
}
