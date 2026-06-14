/**
 * Domain Data — read-only fetch of the live mainnet `has category` graph.
 * ──────────────────────────────────────────────────────────────────────────
 * Thin, isolated fetch for the domain-score PoC. Pulls `has category` triples
 * from mainnet Hasura and groups them by subject (the entity), shaped ready
 * for domain-score.ts.
 *
 * READ ONLY. Zero chain writes. Uses the mainnet GraphQL URL from constants.ts
 * (API.graphql.mainnet — fixed to the working `.sh` endpoint). We do NOT reuse
 * graphql-client.ts here because it resolves its endpoint from
 * NEXT_PUBLIC_NETWORK; this PoC must hit mainnet regardless of app network mode,
 * so a small isolated fetch keeps the experiment self-contained.
 */

import { API } from './constants'
import type { CategoryAttestation } from './domain-score'

/** The live `has category` predicate on mainnet (77 triples at recon time). */
export const HAS_CATEGORY_PREDICATE_ID =
  '0x96c20ddd7f83034666e200aa976cbe2249946bf76a7c66333212be82f284ad4b'

export interface EntityCategories {
  /** Subject atom label (the entity being categorized). */
  entity: string
  /** Subject atom term_id (stable key). */
  entityTermId: string
  /** Raw category attestations for this entity, ready for scoreDomains(). */
  categories: CategoryAttestation[]
}

const QUERY = `query HasCategoryGraph($pred: String!, $limit: Int!) {
  triples(where: { predicate_id: { _eq: $pred } }, limit: $limit) {
    subject { label term_id }
    object { label }
    creator { id }
  }
}`

interface RawTriple {
  subject: { label: string | null; term_id: string | null } | null
  object: { label: string | null } | null
  creator: { id: string | null } | null
}

/**
 * Fetch the mainnet `has category` graph and group triples by entity.
 * Read-only. Throws on transport/GraphQL error so the caller can show a state.
 */
export async function fetchDomainCategoryGraph(limit = 200): Promise<EntityCategories[]> {
  const res = await fetch(API.graphql.mainnet, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { pred: HAS_CATEGORY_PREDICATE_ID, limit } }),
    // PoC: always fetch fresh mainnet data, no Next cache.
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`mainnet GraphQL request failed: ${res.status} ${res.statusText}`)

  const json = (await res.json()) as { data?: { triples?: RawTriple[] }; errors?: { message?: string }[] }
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? 'GraphQL error')

  const triples = json.data?.triples ?? []
  const byEntity = new Map<string, EntityCategories>()

  for (const t of triples) {
    const entityTermId = t.subject?.term_id ?? t.subject?.label ?? 'unknown'
    const entity = t.subject?.label ?? '(unnamed)'
    let e = byEntity.get(entityTermId)
    if (!e) {
      e = { entity, entityTermId, categories: [] }
      byEntity.set(entityTermId, e)
    }
    e.categories.push({
      category: t.object?.label ?? '',
      attester: t.creator?.id ?? '',
    })
  }

  return [...byEntity.values()]
}
