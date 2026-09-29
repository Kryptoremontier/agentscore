/**
 * Shared server cache for COMPLETE reads (Etap 4b-cache).
 *
 * The indexer allows 75 requests per minute per IP, and every server-side read (REST, MCP,
 * the landing's API calls) shares Vercel's egress (docs/audit/rate-limit.md). This wraps a
 * read in `unstable_cache` (the Vercel Data Cache, shared across function instances) so that
 * repeated calls within a TTL cost nothing — under three rules:
 *
 * 1. **Only complete reads are stored.** A read reports `{ value, complete }`. A read that
 *    threw, stopped at a row cap, or settled a sub-read as unknown (`null`) is returned to its
 *    caller as-is and never stored: the next caller reads again (REPO_MAP §7 rule 5 — a
 *    failure pinned for a whole TTL would be served as if it were the data).
 * 2. **Every cached answer says how old it is.** Each read records when it hit the indexer
 *    into the request's read ledger (`runWithReadLedger`); `currentFreshness()` gives the
 *    answer's `dataAgeSeconds` (oldest read behind it; 0 when everything was read live) and
 *    `complete` (false → the response must not be cached downstream either).
 * 3. **Past twice its TTL a cached value is not served — unless the indexer is down.**
 *    `unstable_cache` serves a stale entry while it revalidates in the background; after a
 *    quiet hour that entry is an hour old. Past `maxStaleSeconds` (default 2 × TTL) the read
 *    runs live instead; when that live read fails, the last complete read is served with its
 *    real age (Etap 4c: a page never goes blank while we hold good data). No entry at all and
 *    a failed read → the failure.
 * 4. **Each entry's TTL is the configured one ±10 %,** drawn when the entry is read, so entries
 *    filled together don't refill together every TTL (`jitteredTtl`).
 *
 * Don't nest: Next bypasses `unstable_cache` for a cached function called inside another's
 * callback (it re-reads live). Compose cached reads outside — `getPlatformStats` and the agent
 * detail do — so each keeps its own entry and age.
 *
 * Wallet-specific reads (the user's own position, an evaluator's positions) are never wrapped.
 */

import { unstable_cache } from 'next/cache'
import { encodeForCache, decodeFromCache } from './json-codec'

// ─── Read ledger (per request) ────────────────────────────────────────────────

export interface ReadRecord {
  key: string
  /** Epoch ms at which the data hit the indexer. */
  readAt: number
  /** Served from the cache (true) or read live for this request (false). */
  cached: boolean
  complete: boolean
}

interface Ledger {
  reads: ReadRecord[]
  parent: Ledger | null
}

interface LedgerStore {
  run<R>(store: Ledger, fn: () => R): R
  getStore(): Ledger | undefined
}

/**
 * AsyncLocalStorage without a static `node:async_hooks` import: client pages import api-data (for
 * shared helpers and types), and webpack can't bundle a `node:` URI for the browser — the build
 * failed on it. The Next server sets `globalThis.AsyncLocalStorage`; plain Node (tests, scripts)
 * has `process.getBuiltinModule`; in a browser bundle nothing is ledgered (a no-op store).
 */
function createLedgerStore(): LedgerStore {
  type Ctor = new () => LedgerStore
  const fromGlobal = (globalThis as { AsyncLocalStorage?: Ctor }).AsyncLocalStorage
  const fromNode = typeof process !== 'undefined'
    ? (process as { getBuiltinModule?: (id: string) => { AsyncLocalStorage?: Ctor } | undefined }).getBuiltinModule?.('node:async_hooks')?.AsyncLocalStorage
    : undefined
  const Als = fromGlobal ?? fromNode
  if (Als) return new Als()
  return { run: (_store, fn) => fn(), getStore: () => undefined }
}

let ledgerStoreInstance: LedgerStore | null = null
const ledgerStore: LedgerStore = {
  run: (store, fn) => (ledgerStoreInstance ??= createLedgerStore()).run(store, fn),
  getStore: () => (ledgerStoreInstance ??= createLedgerStore()).getStore(),
}

/** Run `fn` with a fresh read ledger (one per REST request / MCP tool call). */
export function runWithReadLedger<T>(fn: () => T): T {
  return ledgerStore.run({ reads: [], parent: null }, fn)
}

function record(entry: ReadRecord): void {
  for (let l = ledgerStore.getStore() ?? null; l; l = l.parent) l.reads.push(entry)
}

/** Run `fn` in a child ledger that still reports to its parent; returns what `fn` read. */
async function collect<T>(fn: () => Promise<T>): Promise<{ value: T; reads: ReadRecord[] }> {
  const child: Ledger = { reads: [], parent: ledgerStore.getStore() ?? null }
  const value = await ledgerStore.run(child, fn)
  return { value, reads: child.reads }
}

/**
 * One part of an answer with its own age: `fn` runs in a child ledger (its reads still count
 * for the whole answer) and the part's freshness is what `fn` alone read. For answers made of
 * independently cached parts (the /agents page: corpus, cohort, attestations).
 */
export async function readWithFreshness<T>(fn: () => Promise<T>, now: () => number = Date.now): Promise<{ value: T; freshness: Freshness }> {
  const { value, reads } = await collect(fn)
  return { value, freshness: freshnessOf(reads, now()) }
}

export interface Freshness {
  /** Whole seconds since the oldest read behind this answer hit the indexer. 0 = read live. */
  dataAgeSeconds: number
  /** ISO-8601 time of that oldest read — absolute, so a CDN hop can't hide it. */
  dataReadAt: string
  /** false = some read behind this answer was incomplete: it must not be cached anywhere. */
  complete: boolean
}

export function freshnessOf(reads: readonly ReadRecord[], now: number = Date.now()): Freshness {
  const oldest = reads.reduce((min, r) => Math.min(min, r.readAt), now)
  return {
    dataAgeSeconds: Math.max(0, Math.floor((now - oldest) / 1000)),
    dataReadAt: new Date(oldest).toISOString(),
    complete: reads.every((r) => r.complete),
  }
}

/**
 * Record an uncached read that shapes this answer — e.g. an on-chain price that fell back, or a
 * cached sub-read that failed and was settled to `null` — so the answer is marked incomplete.
 */
export function recordLiveRead(key: string, complete: boolean, readAt: number = Date.now()): void {
  record({ key, readAt, cached: false, complete })
}

/** A read whose failure the caller settles to `null` (unknown, never 0): recorded as incomplete. */
export function unknownOnFailure<T>(key: string, read: Promise<T>): Promise<T | null> {
  return read.catch((err) => {
    console.warn(`[server-cache] ${key} unread:`, err instanceof Error ? err.message : err)
    recordLiveRead(key, false)
    return null
  })
}

/** Freshness of everything read so far in this request (live answer outside a ledger). */
export function currentFreshness(now: number = Date.now()): Freshness {
  return freshnessOf(ledgerStore.getStore()?.reads ?? [], now)
}

// ─── JSON codec (unstable_cache stores JSON) ─────────────────────────────────

// In lib/json-codec.ts so the browser can decode an API answer without importing this module.
export { encodeForCache, decodeFromCache } from './json-codec'

// ─── The cache ────────────────────────────────────────────────────────────────

/** What a wrapped read returns: its value and whether that value is complete. */
export interface CompleteRead<T> {
  value: T
  complete: boolean
}

/** A stored entry: the encoded value, when it hit the indexer, and its own TTL (seconds). */
type Stamped = { v: unknown; readAt: number; ttl?: number }

/** Each entry's TTL: the configured one ±10 %. */
export const TTL_JITTER = 0.1

/** `seconds` ±TTL_JITTER, drawn from `random()` ∈ [0, 1); whole seconds, at least 1. */
export function jitteredTtl(seconds: number, random: () => number = Math.random): number {
  return Math.max(1, Math.round(seconds * (1 - TTL_JITTER + 2 * TTL_JITTER * random())))
}

/** The subset of `unstable_cache` this module uses — injectable for tests. */
export type CacheImpl = <A extends unknown[]>(
  cb: (...args: A) => Promise<Stamped>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
) => (...args: A) => Promise<Stamped>

/**
 * `unstable_cache`, or — outside a Next server (scripts, unit tests), where it has no
 * incremental cache and throws before running the read — the read itself, uncached.
 */
const nextCache: CacheImpl = (cb, keyParts, options) => {
  const cached = unstable_cache(cb, keyParts, options)
  return async (...args) => {
    try {
      return await cached(...args)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Invariant: incrementalCache missing')) return cb(...args)
      throw e
    }
  }
}

let defaultCache: CacheImpl = nextCache

/** Tests only: swap the cache behind every completeReadCache that didn't pass its own. */
export function setDefaultCacheImplForTests(impl: CacheImpl | null): void {
  defaultCache = impl ?? nextCache
}

const INCOMPLETE = Symbol.for('agentscore.server-cache.incomplete')

/** Thrown inside the cache callback so `unstable_cache` stores nothing; caught outside. */
class IncompleteRead extends Error {
  readonly [INCOMPLETE] = true
  constructor(readonly stamped: Stamped, key: string) {
    super(`incomplete read not cached: ${key}`)
  }
}
const isIncomplete = (e: unknown): e is IncompleteRead =>
  !!e && typeof e === 'object' && (e as Record<symbol, unknown>)[INCOMPLETE] === true

export interface CompleteReadCacheOptions<A extends unknown[]> {
  /** Seconds a complete read is served from the cache — each entry gets this ±10 % (jitteredTtl). */
  revalidate: number
  /** Tags for `revalidateTag` (per call, e.g. `agent:<termId>`). */
  tags: (...args: A) => string[]
  /** Past this age a cached value is not served; the read runs live. Default 2 × revalidate. */
  maxStaleSeconds?: number
  cache?: CacheImpl
  now?: () => number
  /** Tests only: the draw behind each entry's jittered TTL. */
  random?: () => number
}

/** Entries whose TTL one completeReadCache remembers (per argument list) before forgetting the oldest. */
const TTL_MEMORY = 1000

export function completeReadCache<A extends unknown[], T>(
  key: string,
  read: (...args: A) => Promise<CompleteRead<T>>,
  options: CompleteReadCacheOptions<A>,
): (...args: A) => Promise<T> {
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  // 2 × the configured TTL — above any entry's jittered TTL (at most 1.1 ×).
  const maxStaleMs = (options.maxStaleSeconds ?? options.revalidate * 2) * 1000

  // A read and everything it read in turn: complete only if all of it was; as old as its oldest part.
  const readFresh = async (...args: A): Promise<{ stamped: Stamped; complete: boolean }> => {
    const { value: r, reads } = await collect(() => read(...args))
    // As of when the read answered (a live answer is age 0, however long its pages took).
    const readAt = reads.reduce((min, x) => Math.min(min, x.readAt), now())
    return {
      stamped: { v: encodeForCache(r.value), readAt, ttl: jitteredTtl(options.revalidate, random) },
      complete: r.complete && reads.every((x) => x.complete),
    }
  }

  // Each entry keeps its own TTL, drawn when it was read (Etap 4b-finish): entries filled together
  // at start-up refilled together every 300 s — 37 indexer requests that minute against a typical
  // 15–17. `unstable_cache` judges an entry stale by the `revalidate` of the call, not of the entry,
  // so each call passes the TTL of the entry it last saw (or stored) under these arguments. A fresh
  // draw per call would not spread anything: under steady traffic the first caller with a short
  // draw would refill every entry at ~0.9 × TTL, together again.
  const ttlSeen = new Map<string, number>()
  const rememberTtl = (k: string, ttl: number | undefined) => {
    if (ttl == null) return
    if (!ttlSeen.has(k) && ttlSeen.size >= TTL_MEMORY) ttlSeen.delete(ttlSeen.keys().next().value as string)
    ttlSeen.set(k, ttl)
  }

  // One read in flight per key and arguments on this instance (Etap 4b-finish). Without it, every
  // caller that missed while a read was still running started its own — and Next starts one
  // background refill per request that hits a stale entry — so a slow indexer (60 s 504s, seen under
  // load) multiplied the requests exactly when it could least take them. Concurrent callers share
  // the one read, its result and its completeness; nothing is kept once it settles.
  const inflight = new Map<string, Promise<{ stamped: Stamped; complete: boolean }>>()
  const readOnce = (...args: A): Promise<{ stamped: Stamped; complete: boolean }> => {
    const k = JSON.stringify(args)
    let p = inflight.get(k)
    if (!p) {
      p = readFresh(...args).finally(() => inflight.delete(k))
      inflight.set(k, p)
    }
    return p
  }

  return async (...args: A): Promise<T> => {
    const k = JSON.stringify(args)
    const cached = (options.cache ?? defaultCache)(
      async (...a: A) => {
        const { stamped, complete } = await readOnce(...a)
        if (!complete) throw new IncompleteRead(stamped, key)
        rememberTtl(JSON.stringify(a), stamped.ttl) // about to be stored: this is the entry's TTL now
        return stamped
      },
      [`agentscore:${key}`],
      { revalidate: ttlSeen.get(k) ?? options.revalidate, tags: [key, ...options.tags(...args)] },
    )
    let stamped: Stamped
    try {
      stamped = await cached(...args)
      rememberTtl(k, stamped.ttl)
    } catch (e) {
      if (!isIncomplete(e)) throw e
      record({ key, readAt: e.stamped.readAt, cached: false, complete: false })
      return decodeFromCache<T>(e.stamped.v)
    }
    const t = now()
    if (t - stamped.readAt > maxStaleMs) {
      // Too old to serve (a quiet spell): read live, returned as-is. The cache refreshes itself.
      let live: { stamped: Stamped; complete: boolean }
      try {
        live = await readOnce(...args)
      } catch (err) {
        // The indexer can't be read: the last complete read, with its real age — never an error
        // while we hold good data, never data passed off as fresh (REPO_MAP §7 rule 6).
        console.warn(`[server-cache] ${key}: live read failed, serving the last complete read (${Math.round((t - stamped.readAt) / 1000)} s old):`, err instanceof Error ? err.message : err)
        record({ key, readAt: stamped.readAt, cached: true, complete: true })
        return decodeFromCache<T>(stamped.v)
      }
      record({ key, readAt: live.stamped.readAt, cached: false, complete: live.complete })
      return decodeFromCache<T>(live.stamped.v)
    }
    // A value this request stored itself was read live (age ≈ 0); one read earlier is cached.
    record({ key, readAt: stamped.readAt, cached: t - stamped.readAt >= 1000, complete: true })
    return decodeFromCache<T>(stamped.v)
  }
}

/** The TTLs (seconds) — one place, quoted by REPO_MAP §3 and llms.txt. */
export const SERVER_CACHE_TTL = {
  agentCorpus: 60,
  platformStats: 300,
  domains: 60,
  agentDetail: 30,
  evaluatorLeaderboard: 300,
  /** /leaderboard (contributors) — was its own unstable_cache at the same 300 s. */
  contributorLeaderboard: 300,
  /** The ERC-8004 cohort (identity links + declarations) behind the cohort agent detail. */
  erc8004Cohort: 300,
  /** Attestations on every ERC-8004 cohort agent — the /agents attester lines (AgentScore rows' come with the corpus). */
  cohortAttestations: 60,
} as const
