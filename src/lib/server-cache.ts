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
 * 3. **A visitor never waits for a refill (Etap 7a).** Any complete entry younger than its hard
 *    ceiling (`hardCeilingSeconds`, default 1 h; 24 h for SERVER_CACHE_CEILING's keys) is served at once with its real age; once it is
 *    past its TTL `unstable_cache` refills it in the background (one read in flight per key —
 *    rule below). Before Etap 7a an entry past 2 × TTL made the visitor wait for a full live
 *    read — with little traffic, almost every visit (production: 6–12 s for /agents). Only with
 *    no entry at all, or one past the ceiling, does the caller wait for a live read; when that
 *    live read fails, the last complete read is served with its real age (Etap 4c: a page never
 *    goes blank while we hold good data). No entry at all and a failed read → the failure. A
 *    failed refill never replaces the entry: only complete reads are stored (rule 1).
 *    With no entry at all — after a deploy, since the keys change with the build — the read's
 *    last-good snapshot (option `snapshot`, lib/snapshot-store.ts; Etap 7c) is served at once
 *    with its real age, under the same ceiling, and one refill runs after the response.
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
// The store Next keeps per request and waits on after the response (its own background refills).
import { staticGenerationAsyncStorage } from 'next/dist/client/components/static-generation-async-storage.external'
import { encodeForCache, decodeFromCache } from './json-codec'
import { snapshotStore } from './snapshot-store'

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

interface AsyncStore<S> {
  run<R>(store: S | undefined, fn: () => R): R
  getStore(): S | undefined
}
type LedgerStore = AsyncStore<Ledger>

/**
 * AsyncLocalStorage without a static `node:async_hooks` import: client pages import api-data (for
 * shared helpers and types), and webpack can't bundle a `node:` URI for the browser — the build
 * failed on it. The Next server sets `globalThis.AsyncLocalStorage`; plain Node (tests, scripts)
 * has `process.getBuiltinModule`; in a browser bundle nothing is ledgered (a no-op store).
 */
function createAsyncStore<S>(): AsyncStore<S> {
  type Ctor = new () => AsyncStore<S>
  const fromGlobal = (globalThis as { AsyncLocalStorage?: Ctor }).AsyncLocalStorage
  const fromNode = typeof process !== 'undefined'
    ? (process as { getBuiltinModule?: (id: string) => { AsyncLocalStorage?: Ctor } | undefined }).getBuiltinModule?.('node:async_hooks')?.AsyncLocalStorage
    : undefined
  const Als = fromGlobal ?? fromNode
  if (Als) return new Als()
  return { run: (_store, fn) => fn(), getStore: () => undefined }
}

/** Created on first use (the Next server sets `globalThis.AsyncLocalStorage` before any request). */
function lazyAsyncStore<S>(): AsyncStore<S> {
  let instance: AsyncStore<S> | null = null
  return {
    run: (store, fn) => (instance ??= createAsyncStore<S>()).run(store, fn),
    getStore: () => (instance ??= createAsyncStore<S>()).getStore(),
  }
}

const ledgerStore: LedgerStore = lazyAsyncStore<Ledger>()

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

// ─── Last-good snapshot (Etap 7c) ─────────────────────────────────────────────

/**
 * The last complete read of a read, as the snapshot store keeps it (lib/snapshot-store.ts). The
 * Data Cache keys change with almost every build (they include the minified callback's source), so
 * after a deploy there is no entry; this copy outlives the build. `version` is the read's
 * SNAPSHOT_VERSION: a build whose stored shape differs bumps it and never reads the old shape.
 */
interface Snapshot { key: string; version: number; readAt: number; v: unknown }

/** Snapshot keys: per network (a mainnet build never reads testnet data), per read, per version. */
const SNAPSHOT_PREFIX = `agentscore:${process.env.NEXT_PUBLIC_NETWORK || 'testnet'}:snapshot`

/** A snapshot is written at most this often per read and instance (the store's free plan counts commands). */
export const SNAPSHOT_WRITE_INTERVAL_MS = 5 * 60_000

/** FNV-1a — a short, stable name for a read's arguments (cohort attestations: 264 term ids). */
function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function snapshotKeyFor(key: string, version: number, args: readonly unknown[] = []): string {
  const k = JSON.stringify(args)
  return `${SNAPSHOT_PREFIX}:${key}:${version}${k === '[]' ? '' : `:${fnv1a(k)}`}`
}

const SNAPSHOT_SERVE = Symbol.for('agentscore.server-cache.snapshot-serve')

/** Thrown from the cache callback on a miss when a snapshot can answer: nothing is stored. */
class SnapshotServe extends Error {
  readonly [SNAPSHOT_SERVE] = true
  constructor(readonly snapshot: Snapshot) {
    super(`served from the last-good snapshot: ${snapshot.key}`)
  }
}
const isSnapshotServe = (e: unknown): e is SnapshotServe =>
  !!e && typeof e === 'object' && (e as Record<symbol, unknown>)[SNAPSHOT_SERVE] === true

/** Is the caller still waiting on the cache callback? (see the callback in completeReadCache) */
interface CallerWait { settled: boolean }
const callerStore = lazyAsyncStore<CallerWait>()

const backgroundOutsideNext = new Set<Promise<void>>()

/**
 * Run `task` after the response: in a Next request it joins the store's `pendingRevalidates`,
 * which Next waits on (Vercel's waitUntil) — the same path its own background refills take.
 * Outside Next (tests, scripts) it just runs; `settleBackgroundForTests` waits for it.
 */
function afterResponse(id: string, task: () => Promise<unknown>): void {
  const p = task().then(() => undefined, (err) => console.warn(`[server-cache] ${id}:`, err instanceof Error ? err.message : err))
  const store = staticGenerationAsyncStorage.getStore()
  if (store) {
    store.pendingRevalidates ??= {}
    store.pendingRevalidates[id] = p
  } else {
    backgroundOutsideNext.add(p)
    void p.finally(() => backgroundOutsideNext.delete(p))
  }
}

/** Tests only: wait for work started outside a Next request (snapshot refills). */
export async function settleBackgroundForTests(): Promise<void> {
  while (backgroundOutsideNext.size) await Promise.all([...backgroundOutsideNext])
}

export interface CompleteReadCacheOptions<A extends unknown[]> {
  /** Seconds a complete read is served from the cache — each entry gets this ±10 % (jitteredTtl). */
  revalidate: number
  /** Tags for `revalidateTag` (per call, e.g. `agent:<termId>`). */
  tags: (...args: A) => string[]
  /**
   * Past this age the caller waits for a live read instead of being served the entry (and
   * refilling it in the background). Default HARD_CEILING_SECONDS (1 h).
   */
  hardCeilingSeconds?: number
  /**
   * Keep the last complete read in the snapshot store (lib/snapshot-store.ts) under this schema
   * version — SNAPSHOT_VERSION.<read>. With no Data Cache entry (after a deploy) the snapshot is
   * served at once with its real age, under the same hard ceiling, and one refill runs after the
   * response. Bump the version whenever the stored value's shape changes.
   */
  snapshot?: number
  cache?: CacheImpl
  now?: () => number
  /** Tests only: the draw behind each entry's jittered TTL. */
  random?: () => number
}

/** Past this age an entry is not served while the indexer answers (Etap 7a): the caller waits for a live read. */
export const HARD_CEILING_SECONDS = 3600

/** Entries whose TTL one completeReadCache remembers (per argument list) before forgetting the oldest. */
const TTL_MEMORY = 1000

export function completeReadCache<A extends unknown[], T>(
  key: string,
  read: (...args: A) => Promise<CompleteRead<T>>,
  options: CompleteReadCacheOptions<A>,
): (...args: A) => Promise<T> {
  // Late-bound: a clock captured at module load would outlive a swapped Date (fake timers).
  const now = options.now ?? (() => Date.now())
  const random = options.random ?? Math.random
  // Above any entry's jittered TTL (at most 1.1 ×), so a fresh entry is never past it.
  const ceilingMs = Math.max(options.hardCeilingSeconds ?? HARD_CEILING_SECONDS, options.revalidate * 2) * 1000

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

  // The last-good snapshot (Etap 7c): read on a miss, written after a complete read.
  const version = options.snapshot
  const lastSnapshotWrite = new Map<string, number>()
  const readSnapshot = async (args: A): Promise<Snapshot | null> => {
    const store = version != null ? snapshotStore() : null
    if (!store || version == null) return null
    try {
      const text = await store.get(snapshotKeyFor(key, version, args))
      if (!text) return null
      const snap = JSON.parse(text) as Partial<Snapshot>
      // Another build's shape (or another read's) is never served.
      if (snap.key !== key || snap.version !== version || typeof snap.readAt !== 'number' || !('v' in snap)) return null
      // Past the hard ceiling a snapshot is as stale as an entry would be: the caller reads live.
      if (now() - snap.readAt > ceilingMs) return null
      return snap as Snapshot
    } catch (err) {
      console.warn(`[server-cache] ${key}: snapshot unread:`, err instanceof Error ? err.message : err)
      return null
    }
  }
  const writeSnapshot = async (args: A, stamped: Stamped): Promise<void> => {
    const store = version != null ? snapshotStore() : null
    if (!store || version == null) return
    const sk = snapshotKeyFor(key, version, args)
    const last = lastSnapshotWrite.get(sk)
    if (last != null && now() - last < SNAPSHOT_WRITE_INTERVAL_MS) return
    lastSnapshotWrite.set(sk, now())
    const snap: Snapshot = { key, version, readAt: stamped.readAt, v: stamped.v }
    try {
      await store.set(sk, JSON.stringify(snap), (2 * ceilingMs) / 1000)
    } catch (err) {
      lastSnapshotWrite.delete(sk)
      console.warn(`[server-cache] ${key}: snapshot not written:`, err instanceof Error ? err.message : err)
    }
  }

  return async (...args: A): Promise<T> => {
    const k = JSON.stringify(args)
    const cached = (options.cache ?? defaultCache)(
      async (...a: A) => {
        const wait = version != null && snapshotStore() ? callerStore.getStore() : undefined
        if (wait) {
          // Called on a miss (the caller waits on this callback) or as the background refill of a
          // stale entry (started while the cached value is being returned)? One macrotask later only
          // the refill's caller has its value. On a miss a snapshot answers at once (thrown, so
          // nothing is stored: the caller serves it and starts the one refill after the response).
          await new Promise((r) => setTimeout(r, 0))
          if (!wait.settled) {
            const snap = await readSnapshot(a)
            if (snap) throw new SnapshotServe(snap)
          }
        }
        const { stamped, complete } = await readOnce(...a)
        if (!complete) throw new IncompleteRead(stamped, key)
        rememberTtl(JSON.stringify(a), stamped.ttl) // about to be stored: this is the entry's TTL now
        await writeSnapshot(a, stamped) // only a complete read is ever kept (rule 1)
        return stamped
      },
      [`agentscore:${key}`],
      { revalidate: ttlSeen.get(k) ?? options.revalidate, tags: [key, ...options.tags(...args)] },
    )
    let stamped: Stamped
    try {
      const wait: CallerWait = { settled: false }
      try {
        stamped = await callerStore.run(wait, () => cached(...args))
      } finally {
        wait.settled = true // before any macrotask: a stale entry's refill sees it (the callback above)
      }
      rememberTtl(k, stamped.ttl)
    } catch (e) {
      if (isSnapshotServe(e)) {
        // No Data Cache entry (a new build), a snapshot under the ceiling: served now, with its age.
        // One refill after the response, outside this caller (its own ledger: it shapes later answers).
        afterResponse(`agentscore:snapshot-refill:${key}:${k}`, () =>
          ledgerStore.run({ reads: [], parent: null }, () => callerStore.run(undefined, () => cached(...args))))
        record({ key, readAt: e.snapshot.readAt, cached: true, complete: true })
        return decodeFromCache<T>(e.snapshot.v)
      }
      if (!isIncomplete(e)) throw e
      record({ key, readAt: e.stamped.readAt, cached: false, complete: false })
      return decodeFromCache<T>(e.stamped.v)
    }
    const t = now()
    if (t - stamped.readAt > ceilingMs) {
      // Past the hard ceiling (a long quiet spell or a long outage): read live, returned as-is.
      // Under it, the entry was served below and `unstable_cache` refills it in the background.
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
    // Served at once, whatever its age under the ceiling, with that age (stale-while-revalidate:
    // past its TTL `unstable_cache` has already started the one background refill, through
    // readOnce). A value this request stored itself was read live (age ≈ 0); one read earlier is cached.
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

/**
 * Hard ceilings (seconds) where one is set per key (Etap 7a): under it a complete entry is served at
 * once with its age and refilled in the background; past it the caller waits for a live read. The
 * shared, slow-changing reads — the /agents list's three parts (the corpus, the cohort and its
 * attestations) and /stats' parts — get 24 h: every answer shows its age, and the warm-up job
 * (warm-cache.yml) is best-effort, so a visitor waits for a live read only when there is no entry.
 * Everything else keeps the default HARD_CEILING_SECONDS (1 h).
 */
export const SERVER_CACHE_CEILING = {
  agentCorpus: 86_400,
  erc8004Cohort: 86_400,
  cohortAttestations: 86_400,
  platformStats: 86_400,
  domains: 86_400,
  evaluatorLeaderboard: 86_400,
} as const

/**
 * Snapshot schema versions (Etap 7c) — one per read kept in the snapshot store, the same reads as
 * SERVER_CACHE_CEILING. Bump a read's version in the same change that alters what it stores (its
 * value's shape or meaning): a new build then ignores snapshots in the old shape.
 */
export const SNAPSHOT_VERSION = {
  agentCorpus: 1,
  erc8004Cohort: 1,
  cohortAttestations: 1,
  platformStats: 1,
  domains: 1,
  evaluatorLeaderboard: 1,
} as const
