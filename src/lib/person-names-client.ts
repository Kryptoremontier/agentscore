'use client'

/**
 * Client side of the names helper: every <PersonName> on a page asks here; requests made in the
 * same few milliseconds go out as one /api/names call (≤ 100 wallets each). Names are kept for the
 * session. Rendering never waits — the short hex shows until a name arrives (Etap 5b).
 */

import { NAMES_BATCH } from './person-names'

const names = new Map<string, string | null>()
const requested = new Set<string>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let version = 0
let timer: ReturnType<typeof setTimeout> | null = null

function notify() {
  version++
  for (const l of listeners) l()
}

function flush() {
  timer = null
  const batch = [...pending]
  pending.clear()
  for (let i = 0; i < batch.length; i += NAMES_BATCH) {
    const chunk = batch.slice(i, i + NAMES_BATCH)
    fetch(`/api/names?w=${chunk.join(',')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { names?: Record<string, string | null> }) => {
        for (const w of chunk) {
          if (body.names && w in body.names) names.set(w, body.names[w])
          else requested.delete(w) // unknown: a later mount asks again
        }
        notify()
      })
      .catch(() => { for (const w of chunk) requested.delete(w) })
  }
}

/** Ask for a wallet's name (once per session); the answer arrives through `subscribe`. */
export function requestPersonName(wallet: string) {
  const k = wallet.toLowerCase()
  if (names.has(k) || requested.has(k)) return
  requested.add(k)
  pending.add(k)
  if (!timer) timer = setTimeout(flush, 25)
}

/** undefined = not known yet; null = no ENS name. */
export function knownPersonName(wallet: string): string | null | undefined {
  return names.get(wallet.toLowerCase())
}

export function subscribePersonNames(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function personNamesVersion(): number {
  return version
}
