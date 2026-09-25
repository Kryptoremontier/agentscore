/**
 * Landing "Featured" badge totals — the corpus size behind each tab, never the
 * tab's own `limit: 8` row fetch (which the badge used to print as "8 indexed").
 *
 * - agents: /api/v1/agents meta.total — the post-junk corpus, the same
 *   loadAgentCorpus() read that /api/v1/stats and MCP platform_stats count
 *   (client components go through API routes, per CLAUDE.md).
 * - skills / claims: an aggregate count on the SAME `where` as the tab's rows
 *   (REPO_MAP §7 rule 1).
 * Unknown (failed read) → null → the badge shows no number at all.
 */

export type FeaturedTab = 'agents' | 'skills' | 'claims'

export interface FeaturedTotal {
  total: number
  /** The corpus read behind `total` hit its cap — `total` is a lower bound. */
  truncated: boolean
}

export async function fetchFeaturedTotal(
  tab: FeaturedTab,
  opts: { graphqlUrl: string; skillWhere: string; claimWhere: string; apiBase?: string },
): Promise<FeaturedTotal | null> {
  try {
    if (tab === 'agents') {
      const res = await fetch(`${opts.apiBase ?? ''}/api/v1/agents?limit=1`)
      const body = await res.json()
      const total = body?.meta?.total
      if (!body?.success || typeof total !== 'number') return null
      return { total, truncated: body.meta.truncated === true }
    }
    const query = tab === 'skills'
      ? `{ agg: atoms_aggregate(where: ${opts.skillWhere}) { aggregate { count } } }`
      : `{ agg: triples_aggregate(${opts.claimWhere}) { aggregate { count } } }`
    const res = await fetch(opts.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const json = await res.json()
    const count = json?.data?.agg?.aggregate?.count
    if (json?.errors || typeof count !== 'number') return null
    return { total: count, truncated: false }
  } catch {
    return null
  }
}

/** "9 indexed" / "500+ indexed" / null (no badge) — the badge text for a tab. */
export function featuredBadgeText(t: FeaturedTotal | null): string | null {
  if (!t) return null
  return `${t.total}${t.truncated ? '+' : ''} indexed`
}
