/**
 * Server: ENS names for wallets, from the indexer's account labels — one cached helper for every
 * surface that shows a person (who vouches, backers, reporters, leaderboard, evaluators). Served to
 * clients by /api/names; they render the short hex first and the name when it arrives.
 *
 * Cache: 10 min per wallet, names and "no name" alike (a label changes only when an ENS record
 * does). A failed read caches nothing — the next request asks again, and the page keeps its hex.
 */

import { getAddress, isAddress } from 'viem'
import { gqlRequest } from './gql-pager'
import { isEnsName, NAMES_BATCH } from './person-names'

const TTL_MS = 10 * 60_000
const MAX_ENTRIES = 5_000
const cache = new Map<string, { name: string | null; at: number }>()

/** Checksummed ids: Hasura stores addresses EIP-55 and `_in` never matches a lowercase one (CLAUDE.md). */
const ACCOUNTS = `query PersonNames($ids: [String!]!) { accounts(where: { id: { _in: $ids } }) { id label } }`

/**
 * `{ [lowercase wallet]: "name.eth" | null }` for every valid wallet asked about — null = no ENS
 * name. A wallet whose read failed is absent (unknown), never null.
 */
export async function resolvePersonNames(wallets: readonly string[], now = Date.now()): Promise<Record<string, string | null>> {
  const want = [...new Set(wallets.filter((w) => isAddress(w, { strict: false })).map((w) => w.toLowerCase()))]
  const out: Record<string, string | null> = {}
  const misses: string[] = []
  for (const w of want) {
    const hit = cache.get(w)
    if (hit && now - hit.at < TTL_MS) out[w] = hit.name
    else misses.push(w)
  }
  for (let i = 0; i < misses.length; i += NAMES_BATCH) {
    const chunk = misses.slice(i, i + NAMES_BATCH)
    try {
      const data = await gqlRequest<{ accounts: Array<{ id: string; label: string | null }> }>(ACCOUNTS, { ids: chunk.map((w) => getAddress(w)) })
      const labels = new Map(data.accounts.map((a) => [a.id.toLowerCase(), a.label]))
      for (const w of chunk) {
        const label = labels.get(w)
        const name = isEnsName(label) ? label.trim() : null
        out[w] = name
        cache.set(w, { name, at: now })
      }
    } catch {
      // Unknown: absent from the answer, not cached.
    }
  }
  if (cache.size > MAX_ENTRIES) {
    for (const k of [...cache.keys()].slice(0, cache.size - MAX_ENTRIES)) cache.delete(k)
  }
  return out
}

/** Tests only. */
export function clearPersonNamesCache() {
  cache.clear()
}
