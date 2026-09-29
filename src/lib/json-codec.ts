/**
 * JSON codec for values that carry bigint and Map (JSON.stringify(bigint) throws; a Map
 * stringifies to {}). The shared server cache stores values through it (lib/server-cache.ts),
 * and the /agents page's API answers use it so exact wei and per-subject maps survive the
 * trip to the browser (app/api/v1/agents/page).
 */

/** bigint and Map survive the Data Cache's JSON round trip (JSON.stringify(bigint) throws). */
export function encodeForCache(value: unknown): unknown {
  if (typeof value === 'bigint') return { $bigint: value.toString() }
  if (value instanceof Map) return { $map: [...value.entries()].map(([k, v]) => [encodeForCache(k), encodeForCache(v)]) }
  if (Array.isArray(value)) return value.map(encodeForCache)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = encodeForCache(v)
    return out
  }
  return value
}

export function decodeFromCache<T>(value: unknown): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.$bigint === 'string' && Object.keys(o).length === 1) return BigInt(o.$bigint)
      if (Array.isArray(o.$map) && Object.keys(o).length === 1) {
        return new Map((o.$map as Array<[unknown, unknown]>).map(([k, val]) => [walk(k), walk(val)]))
      }
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(o)) out[k] = walk(val)
      return out
    }
    return v
  }
  return walk(value) as T
}
