/**
 * The last complete read of a few shared reads, kept where a deploy can't empty it (Etap 7c).
 *
 * `unstable_cache` keys include the minified callback's source, which changes with almost every
 * build: after a deploy the Data Cache has no entry for us, and a slow indexer then left /agents
 * without its AgentScore agents (production 2026-10-20). This store holds the last complete read
 * of each SERVER_CACHE_CEILING read under `<read name>:<schema version>`, outside the build.
 *
 * Upstash Redis through its REST API (plain fetch, no SDK), added to the project from the Vercel
 * Marketplace (free plan): it sets KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_*
 * pair). Without them the store is off and every read behaves as before. A store that fails or is
 * slow never fails a read: a get answers null, a set is dropped (both logged).
 */

/** Get/set of one JSON text under a key. */
export interface SnapshotStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
}

/** A snapshot call never holds a read up longer than this. */
export const SNAPSHOT_TIMEOUT_MS = 2_000

function upstashFromEnv(): SnapshotStore | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const base = url.replace(/\/$/, '')
  const call = async (command: (string | number)[]): Promise<unknown> => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      cache: 'no-store',
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`snapshot store HTTP ${res.status}`)
    const json = (await res.json()) as { result?: unknown; error?: string }
    if (json.error) throw new Error(`snapshot store: ${json.error}`)
    return json.result
  }
  return {
    get: async (key) => {
      const r = await call(['GET', key])
      return typeof r === 'string' ? r : null
    },
    set: async (key, value, ttlSeconds) => {
      await call(['SET', key, value, 'EX', Math.max(1, Math.round(ttlSeconds))])
    },
  }
}

let override: SnapshotStore | null | undefined

/** The configured store, or null (off). Read per call: env vars are per deployment. */
export function snapshotStore(): SnapshotStore | null {
  return override !== undefined ? override : upstashFromEnv()
}

/** Tests only: a store (in-memory or failing), null for off, undefined for the environment's. */
export function setSnapshotStoreForTests(store: SnapshotStore | null | undefined): void {
  override = store
}

/** An in-memory store for tests and scripts. */
export function memorySnapshotStore(): SnapshotStore & { data: Map<string, string>; sets: number } {
  const data = new Map<string, string>()
  const s = {
    data,
    sets: 0,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => { s.sets++; data.set(key, value) },
  }
  return s
}
