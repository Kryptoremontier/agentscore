/**
 * How often the trust gate is asked from outside (Etap 9 — `/api/v1/stats` `gateCalls7d`).
 *
 * One counter per UTC day in the Upstash store the snapshots use (lib/snapshot-store.ts): a REST
 * `GET /api/v1/agents/:id/gate` or an MCP `should_i_trust` call adds one, unless it says it is our
 * own (`X-AgentScore-Internal: 1` — the harness, the example capture, anything this repo runs).
 * The landing's §03 example never comes here: it calls the gate's function on the server, not the
 * endpoint.
 *
 * - No store configured → nothing is counted and the number is **unavailable** (null), never 0.
 * - A store that fails or is slow never fails or slows a gate answer: the add is dropped (logged)
 *   and capped at GATE_COUNT_TIMEOUT_MS; a failed read is `failed` (null), never 0.
 * - Only a count: no id, no policy, no caller is stored.
 */

import { upstashCommandFromEnv } from './snapshot-store'

export const INTERNAL_HEADER = 'x-agentscore-internal'
export const GATE_CALLS_WINDOW_DAYS = 7
/** A day's counter outlives the window by a few days, then expires by itself. */
const DAY_KEY_TTL_SECONDS = 10 * 86_400
/** The add runs beside the gate's own read and never holds the answer longer than this. */
export const GATE_COUNT_TIMEOUT_MS = 800

/** The counter's two operations. */
export interface GateCallStore {
  /** Add one to the key and (re)set its expiry. */
  incr(key: string, ttlSeconds: number): Promise<void>
  /** The keys' values, in order; null = no such key (nothing counted that day). */
  mget(keys: string[]): Promise<Array<string | null>>
}

function upstashFromEnv(): GateCallStore | null {
  const call = upstashCommandFromEnv()
  if (!call) return null
  return {
    incr: async (key, ttlSeconds) => {
      await call(['INCR', key], GATE_COUNT_TIMEOUT_MS)
      // The expiry is housekeeping: if it is lost the count stands and the next add sets it.
      await call(['EXPIRE', key, ttlSeconds], GATE_COUNT_TIMEOUT_MS).catch(() => {})
    },
    mget: async (keys) => {
      const r = await call(['MGET', ...keys])
      if (!Array.isArray(r) || r.length !== keys.length) throw new Error('gate-call counter: unexpected MGET answer')
      return r.map((v) => (v == null ? null : String(v)))
    },
  }
}

let override: GateCallStore | null | undefined

/** The configured counter, or null (off). Read per call: env vars are per deployment. */
export function gateCallStore(): GateCallStore | null {
  return override !== undefined ? override : upstashFromEnv()
}

/** Tests only: a store, null for off, undefined for the environment's. */
export function setGateCallStoreForTests(store: GateCallStore | null | undefined): void {
  override = store
}

/** An in-memory counter for tests. */
export function memoryGateCallStore(): GateCallStore & { data: Map<string, number> } {
  const data = new Map<string, number>()
  return {
    data,
    incr: async (key) => { data.set(key, (data.get(key) ?? 0) + 1) },
    mget: async (keys) => keys.map((k) => (data.has(k) ? String(data.get(k)) : null)),
  }
}

const PREFIX = `agentscore:${process.env.NEXT_PUBLIC_NETWORK || 'testnet'}:gate-calls:v1`
/** `…:gate-calls:v1:2026-11-18` — one key per UTC day, per network. */
export const gateCallDayKey = (at: number) => `${PREFIX}:${new Date(at).toISOString().slice(0, 10)}`

/** Is this request one of our own? Anything else is an outside call. */
export function isInternalCall(headers: Pick<Headers, 'get'> | null | undefined): boolean {
  const v = headers?.get(INTERNAL_HEADER)
  return v != null && v !== '' && v !== '0' && v.toLowerCase() !== 'false'
}

/** An MCP request's headers (a plain record, lowercase names) read like a Headers object. */
export function headersOfRecord(record: Record<string, string | string[] | undefined> | null | undefined): Pick<Headers, 'get'> | null {
  if (!record) return null
  return {
    get: (name: string) => {
      const v = record[name.toLowerCase()]
      return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
    },
  }
}

/**
 * Count one outside gate call. Never throws and never waits past the cap; a call marked internal,
 * or made while no store is configured, counts nothing.
 */
export async function recordGateCall(headers?: Pick<Headers, 'get'> | null, now: number = Date.now()): Promise<void> {
  if (isInternalCall(headers)) return
  const store = gateCallStore()
  if (!store) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      store.incr(gateCallDayKey(now), DAY_KEY_TTL_SECONDS),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, GATE_COUNT_TIMEOUT_MS) }),
    ])
  } catch (err) {
    console.warn('[gate-calls] count dropped:', err instanceof Error ? err.message : err)
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type GateCallsRead =
  | { status: 'ok'; value: number }
  /** No store configured: nothing was ever counted — not zero. */
  | { status: 'unavailable' }
  | { status: 'failed' }

/** Outside gate calls over the last 7 UTC days (today included). */
export async function readGateCalls7d(now: number = Date.now()): Promise<GateCallsRead> {
  const store = gateCallStore()
  if (!store) return { status: 'unavailable' }
  try {
    const keys = Array.from({ length: GATE_CALLS_WINDOW_DAYS }, (_, i) => gateCallDayKey(now - i * 86_400_000))
    const values = await store.mget(keys)
    let total = 0
    for (const v of values) {
      if (v == null) continue
      const n = Number(v)
      if (!Number.isSafeInteger(n) || n < 0) throw new Error(`gate-call counter: not a count (${v})`)
      total += n
    }
    return { status: 'ok', value: total }
  } catch (err) {
    console.warn('[gate-calls] unread:', err instanceof Error ? err.message : err)
    return { status: 'failed' }
  }
}
