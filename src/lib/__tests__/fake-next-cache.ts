/**
 * Test double for `unstable_cache` (next 14.2 unstable-cache.js): a miss runs the callback and
 * stores its result only if it resolves; a fresh hit returns the stored JSON; a stale hit returns
 * the stored JSON and revalidates in the background (a rejection stores nothing).
 * Not a test file (no `.test.ts`), so vitest doesn't collect it.
 */
import type { CacheImpl } from '../server-cache'

export function fakeNextCache(clock: { t: number }) {
  const store = new Map<string, { body: string; storedAt: number }>()
  const background: Promise<unknown>[] = []
  const impl: CacheImpl = (cb, keyParts, { revalidate }) => async (...args) => {
    const key = `${keyParts.join(',')}-${JSON.stringify(args)}`
    const hit = store.get(key)
    if (hit) {
      if (clock.t - hit.storedAt > revalidate * 1000) {
        background.push(cb(...args).then((r) => store.set(key, { body: JSON.stringify(r), storedAt: clock.t }), () => {}))
      }
      return JSON.parse(hit.body)
    }
    const result = await cb(...args)
    store.set(key, { body: JSON.stringify(result), storedAt: clock.t })
    return result
  }
  return { impl, store, settle: () => Promise.all(background) }
}
