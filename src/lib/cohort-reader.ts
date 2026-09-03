/**
 * Cohort Reader — Etap 2c. Reads the ERC-8004 agent cohort: real agents
 * Intuition itself indexed as canonical Atoms (`same as` -> CAIP identity),
 * separate from and with ZERO overlap against our own registered corpus
 * (verified live 2026-09-03: 0/168 cohort subjects match `Agent:%` atoms or
 * `is skilled in` subjects — see project memory `erc8004-oasf-recon`).
 *
 * Predicate term_ids below were re-verified live on testnet 2026-09-03, not
 * copied from documentation — per thesis §7 mine #4, testnet canon is
 * fragmented and every predicate here has 1-2 unused duplicate atoms
 * sharing its label. Filter by term_id, never by label.
 *
 * Classification edges (`has tag` for OASF skills, `has category` for OASF
 * domains) are read from ALL live duplicate predicate atoms for each kind —
 * recon found BOTH duplicates of `has category` and BOTH active `has tag`
 * atoms carrying real, non-identical cohort edges (not one canonical + one
 * noise atom, contrary to the July 2026 recon on a smaller corpus). Skipping
 * either would silently drop real declared classifications.
 *
 * Graceful degradation per repo convention: fetchCohortAgents() returns []
 * on any transport/GraphQL error, never throws.
 */

import { APP_CONFIG } from './app-config'
import { foldDuplicateAtoms } from './atom-fold'

// `same as` predicate atom actually used for identity links on testnet
// (2 sibling duplicate "same as" atoms exist, 0-1 unrelated triples each).
const SAME_AS_PREDICATE_ID = '0xbeebfb7d177cbd96ffc239d2196c72ec346efe81f39dc595773f13d83506f5f0'

// ERC-8004 registry contract, CAIP-10/19-shaped object label:
// eip155:<chainId>/erc721:0x8004A169.../<tokenId>
const ERC8004_CAIP_PATTERN = /erc721:0x8004a169/i

/** Does a `same as` object label match the ERC-8004 registry contract's CAIP pattern? */
export function isErc8004Caip(label: string | null | undefined): boolean {
  return !!label && ERC8004_CAIP_PATTERN.test(label)
}

// Both live `has tag` (OASF skills) duplicate atoms carrying cohort edges.
const HAS_TAG_PREDICATE_IDS = [
  '0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd',
  '0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5',
]

// Both `has category` (OASF domains) duplicate atoms carrying cohort edges.
const HAS_CATEGORY_PREDICATE_IDS = [
  '0xddde1d94d102098bbe59c521e5f2aa1a958611cec579923584410f2a5f29b0f2',
  '0x96c20ddd7f83034666e200aa976cbe2249946bf76a7c66333212be82f284ad4b',
]

export interface CohortAgent {
  termId: string
  label: string
  /** The CAIP identity string this agent resolved `same as`, e.g. eip155:8453/erc721:0x8004.../16850 */
  caipIdentity: string
  /** OASF skill tags this agent declares (`has tag`), duplicate atoms folded to one representative label. */
  declaredSkills: string[]
  /** OASF domain categories this agent declares (`has category`), duplicate atoms folded to one representative label. */
  declaredDomains: string[]
  createdAt: string
}

interface SameAsRow {
  created_at: string
  subject: { term_id: string; label: string | null } | null
  object: { label: string | null } | null
}

export interface ClassificationRow {
  subject_id: string
  object: { term_id: string; label: string }
}

async function gql<T>(query: string): Promise<T> {
  const res = await fetch(APP_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data as T
}

/**
 * Fold classification edges (skills or domains) for one subject group: dedup
 * duplicate-labeled atoms across all supplied predicate ids onto one
 * representative label per subject, then return subject -> sorted label list.
 */
export function foldClassificationBySubject(rows: readonly ClassificationRow[]): Map<string, string[]> {
  const { representatives } = foldDuplicateAtoms(
    rows.map((r) => ({ id: r.object.term_id, label: r.object.label }))
  )
  const bySubject = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.subject_id || !r.object?.label) continue
    const rep = representatives.get(r.object.label.toLowerCase())
    const label = rep?.label ?? r.object.label
    const set = bySubject.get(r.subject_id) ?? new Set<string>()
    set.add(label)
    bySubject.set(r.subject_id, set)
  }
  const out = new Map<string, string[]>()
  for (const [subjectId, labels] of bySubject) out.set(subjectId, [...labels].sort())
  return out
}

/**
 * Fetch the ERC-8004 cohort: agents Intuition indexed as `same as` a CAIP
 * on-chain identity, filtered to the ERC-8004 registry contract pattern.
 * Dedups agents with >1 same-as CAIP triple (rare, seen live: 1/168).
 * Attaches declared OASF skills/domains via a second batched query.
 */
export async function fetchCohortAgents(): Promise<CohortAgent[]> {
  if (!APP_CONFIG.GRAPHQL_URL) return []
  try {
    const sameAsData = await gql<{ triples: SameAsRow[] }>(`
      query GetErc8004Cohort {
        triples(
          where: {
            predicate_id: { _eq: "${SAME_AS_PREDICATE_ID}" }
            object: { label: { _ilike: "%erc721:0x8004%" } }
          }
          limit: 500
        ) {
          created_at
          subject { term_id label }
          object { label }
        }
      }
    `)

    const rows = (sameAsData?.triples ?? []).filter(
      (r) => r.subject?.term_id && r.object?.label && ERC8004_CAIP_PATTERN.test(r.object.label)
    )
    if (rows.length === 0) return []

    // Dedup: keep the earliest same-as triple per subject.
    const bySubject = new Map<string, SameAsRow>()
    for (const r of rows) {
      const id = r.subject!.term_id
      const existing = bySubject.get(id)
      if (!existing || r.created_at < existing.created_at) bySubject.set(id, r)
    }

    const termIds = [...bySubject.keys()]
    const idList = termIds.map((id) => JSON.stringify(id)).join(', ')

    const [tagData, categoryData] = await Promise.all([
      gql<{ triples: ClassificationRow[] }>(`
        query GetCohortSkillTags {
          triples(
            where: {
              predicate_id: { _in: [${HAS_TAG_PREDICATE_IDS.map((p) => `"${p}"`).join(', ')}] }
              subject_id: { _in: [${idList}] }
            }
            limit: 2000
          ) { subject_id object { term_id label } }
        }
      `).catch(() => ({ triples: [] })),
      gql<{ triples: ClassificationRow[] }>(`
        query GetCohortDomainCategories {
          triples(
            where: {
              predicate_id: { _in: [${HAS_CATEGORY_PREDICATE_IDS.map((p) => `"${p}"`).join(', ')}] }
              subject_id: { _in: [${idList}] }
            }
            limit: 2000
          ) { subject_id object { term_id label } }
        }
      `).catch(() => ({ triples: [] })),
    ])

    const skillsBySubject = foldClassificationBySubject(tagData?.triples ?? [])
    const domainsBySubject = foldClassificationBySubject(categoryData?.triples ?? [])

    return termIds
      .map((termId) => {
        const row = bySubject.get(termId)!
        return {
          termId,
          label: row.subject?.label ?? 'Unknown',
          caipIdentity: row.object?.label ?? '',
          declaredSkills: skillsBySubject.get(termId) ?? [],
          declaredDomains: domainsBySubject.get(termId) ?? [],
          createdAt: row.created_at,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  } catch (err) {
    console.warn('[fetchCohortAgents] Network/GraphQL error:', err)
    return []
  }
}
