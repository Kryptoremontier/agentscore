/**
 * A per-key sliding-window limit (Etap 9d: POST /api/v1/refresh, per IP). In memory, per server
 * instance: on Vercel each instance counts on its own, so the limit is per instance. It bounds what
 * one caller can make one instance read; the refresh's own once-per-key-per-minute rule
 * (lib/server-cache.ts REFRESH_MIN_INTERVAL_MS) bounds the indexer load whoever calls.
 */

export interface RateLimiter {
  /** Count one request for `key`: ok, or how many seconds until the next one is allowed. */
  take(key: string): { ok: true } | { ok: false; retryAfterSeconds: number }
}

/** Keys remembered before the oldest are forgotten (memory stays bounded under many callers). */
const MAX_KEYS = 5_000

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? (() => Date.now())
  const hits = new Map<string, number[]>()
  return {
    take(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((x) => t - x < opts.windowMs)
      if (recent.length >= opts.limit) {
        hits.set(key, recent)
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + opts.windowMs - t) / 1000)) }
      }
      recent.push(t)
      hits.delete(key) // re-insert: the map's order is least recently used first
      hits.set(key, recent)
      if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value as string)
      return { ok: true }
    },
  }
}

/** The caller's IP as Vercel passes it (first x-forwarded-for hop), else x-real-ip, else "unknown". */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim() || 'unknown'
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
