/**
 * Server-side in-memory LRU cache for qualityScore (4-pillar composite).
 *
 * Populated by getAgentTrustBreakdown() after computing calculateCompositeTrust().
 * Read by getAgentsWithScores() so agents that have been detail-fetched return
 * a real objectScore on subsequent list calls within the TTL window.
 *
 * Config:
 *   MAX_ENTRIES = 500  — avoids unbounded growth on busy servers
 *   TTL_MS      = 5min — matches on-chain-pricing.ts cache window
 */

const MAX_ENTRIES = 500
const TTL_MS = 5 * 60_000

interface Entry {
  qualityScore: number
  ts: number
}

// insertion-ordered Map gives LRU eviction when we delete oldest on overflow
const store = new Map<string, Entry>()

export function qualityCacheSet(termId: string, qualityScore: number): void {
  // Remove existing entry first so the size check below is accurate when
  // updating a key that is already in the cache (avoids evicting an unrelated
  // entry when the cache is at capacity but the key already exists).
  store.delete(termId)
  // Evict oldest entry when at capacity (Map iterates insertion order)
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value
    if (oldestKey !== undefined) store.delete(oldestKey)
  }
  store.set(termId, { qualityScore, ts: Date.now() })
}

export function qualityCacheGet(termId: string): number | null {
  const entry = store.get(termId)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(termId)
    return null
  }
  return entry.qualityScore
}

/** For testing only — resets cache to empty state. */
export function qualityCacheClear(): void {
  store.clear()
}

export function qualityCacheSize(): number {
  return store.size
}
