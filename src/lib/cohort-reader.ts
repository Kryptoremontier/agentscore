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
 * Graceful degradation per repo convention: fetchCohortAgents() never throws;
 * on any transport/GraphQL error it returns `status: 'error'` (no agents,
 * unknown total) — distinct from an empty cohort, which is `status: 'ok'`.
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

export interface CohortFetchResult {
  agents: CohortAgent[]
  /**
   * Number of DISTINCT cohort agents (subjects) in the registry — the same unit
   * as `agents.length`. Exact when the fetch was not capped; otherwise from a
   * distinct-subject aggregate on the identical filter; null when that count is
   * unavailable at the cap (never guessed).
   */
  total: number | null
  /** True when some real cohort agents are not in `agents`; null = unknown.
   *  Thesis §6: never silently drop. Callers MUST surface this, not just render `agents`. */
  truncated: boolean | null
  /**
   * 'error' = the cohort could not be read (transport/GraphQL failure, or no
   * endpoint). Never collapse this into an empty cohort: callers must show the
   * feed as unavailable, not as "0 agents".
   */
  status: 'ok' | 'error'
}

// Hard cap on the identity query below. Testnet is at 264 live (2026-09-15) — dormant until the
// cohort grows past it. Recon 2026-09-15 found Deep3 Labs published ~28.7k ERC-8004 identity
// links to Intuition MAINNET (a separate, much larger dataset this app doesn't read — see
// project memory). Raising this cap is a deliberate decision, not a casual bump: the batched
// classification lookup below is chunked specifically so it survives a higher cap, but the
// unvirtualized /agents render is not — see the recon notes before ever raising this.
const COHORT_FETCH_LIMIT = 500

// Hasura's `_in` filter is interpolated as a literal id list in the query string (no query
// builder here) — an unbounded list scales the request body linearly with cohort size, well
// past what a single Hasura request should carry. Chunking bounds each request regardless of
// how large COHORT_FETCH_LIMIT ever becomes.
const CLASSIFICATION_CHUNK_SIZE = 200

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

function chunkIds(ids: readonly string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

/**
 * Batched classification lookup (`has tag` / `has category`), chunked at
 * CLASSIFICATION_CHUNK_SIZE subject ids per request so the query body stays
 * bounded regardless of cohort size — see COHORT_FETCH_LIMIT's file-header
 * note. Chunks fetch in parallel and merge; one chunk's failure degrades to
 * [] for that chunk only (graceful degradation, same convention as the rest
 * of this file), it doesn't drop the others.
 */
async function fetchClassification(predicateIds: readonly string[], termIds: readonly string[]): Promise<ClassificationRow[]> {
  if (termIds.length === 0) return []
  const predicateList = predicateIds.map((p) => `"${p}"`).join(', ')
  const results = await Promise.all(
    chunkIds(termIds, CLASSIFICATION_CHUNK_SIZE).map((idsChunk) => {
      const idList = idsChunk.map((id) => JSON.stringify(id)).join(', ')
      return gql<{ triples: ClassificationRow[] }>(`
        query GetCohortClassification {
          triples(
            where: {
              predicate_id: { _in: [${predicateList}] }
              subject_id: { _in: [${idList}] }
            }
            limit: 2000
          ) { subject_id object { term_id label } }
        }
      `).catch(() => ({ triples: [] }))
    })
  )
  return results.flatMap((r) => r?.triples ?? [])
}

/**
 * Fetch the ERC-8004 cohort: agents Intuition indexed as `same as` a CAIP
 * on-chain identity, filtered to the ERC-8004 registry contract pattern.
 * Dedups agents with >1 same-as CAIP triple (rare, seen live: 1/168).
 * Attaches declared OASF skills/domains via chunked batched queries.
 *
 * `total` counts distinct cohort agents — the unit `agents` is in. When the
 * fetch hit its cap, it comes from a distinct-subject aggregate on the
 * identical filter (cheap, no row fetch), so `truncated` reflects the real
 * underlying count rather than "did we get exactly COHORT_FETCH_LIMIT rows back".
 */
export async function fetchCohortAgents(): Promise<CohortFetchResult> {
  // Failure is its own state — `total: 0` would read as "the registry is empty".
  const failed: CohortFetchResult = { agents: [], total: null, truncated: null, status: 'error' }
  if (!APP_CONFIG.GRAPHQL_URL) return failed
  try {
    // ONE filter for the rows and the count (REPO_MAP §7 rule 1: "the SAME filter"). The
    // LIKE matches the registry-contract pattern the JS guard below checks (it used to be the
    // broader "%erc721:0x8004%", so the count included objects the list then dropped), and a
    // row with no subject can't become an agent, so it isn't counted either.
    const sameAsFilter = `
      predicate_id: { _eq: "${SAME_AS_PREDICATE_ID}" }
      object: { label: { _ilike: "%erc721:0x8004a169%" } }
      subject_id: { _is_null: false }
    `
    const [sameAsData, countData] = await Promise.all([
      gql<{ triples: SameAsRow[] }>(`
        query GetErc8004Cohort {
          triples(where: { ${sameAsFilter} } limit: ${COHORT_FETCH_LIMIT}) {
            created_at
            subject { term_id label }
            object { label }
          }
        }
      `),
      // Distinct SUBJECTS, not triples: an agent with 2 same-as triples is one agent
      // (the list dedups it), so the total must count it once too.
      gql<{ triples_aggregate: { aggregate: { count: number } } }>(`
        query GetErc8004CohortCount {
          triples_aggregate(where: { ${sameAsFilter} }) {
            aggregate { count(columns: [subject_id], distinct: true) }
          }
        }
      `).catch(() => null),
    ])

    const rawRows = sameAsData?.triples ?? []
    const rows = rawRows.filter(
      (r) => r.subject?.term_id && r.object?.label && ERC8004_CAIP_PATTERN.test(r.object.label)
    )
    // A fetch that returned fewer rows than its cap is complete: the deduped agent count
    // below IS the total. Only at the cap does the aggregate decide — and if it failed
    // there, total/truncated are unknown (null), never a substituted rows.length.
    const complete = rawRows.length < COHORT_FETCH_LIMIT
    const distinctTotal = countData?.triples_aggregate?.aggregate?.count
    const countedTotal = typeof distinctTotal === 'number' ? distinctTotal : null

    if (rows.length === 0) {
      return complete
        ? { agents: [], total: 0, truncated: false, status: 'ok' }
        : { agents: [], total: countedTotal, truncated: countedTotal == null ? null : countedTotal > 0, status: 'ok' }
    }

    // Dedup: keep the earliest same-as triple per subject.
    const bySubject = new Map<string, SameAsRow>()
    for (const r of rows) {
      const id = r.subject!.term_id
      const existing = bySubject.get(id)
      if (!existing || r.created_at < existing.created_at) bySubject.set(id, r)
    }

    const termIds = [...bySubject.keys()]

    const [tagRows, categoryRows] = await Promise.all([
      fetchClassification(HAS_TAG_PREDICATE_IDS, termIds),
      fetchClassification(HAS_CATEGORY_PREDICATE_IDS, termIds),
    ])

    const skillsBySubject = foldClassificationBySubject(tagRows)
    const domainsBySubject = foldClassificationBySubject(categoryRows)

    const agents = termIds
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

    const total = complete ? agents.length : countedTotal
    const truncated = complete ? false : countedTotal == null ? null : countedTotal > agents.length
    return { agents, total, truncated, status: 'ok' }
  } catch (err) {
    console.warn('[fetchCohortAgents] Network/GraphQL error:', err)
    return failed
  }
}
