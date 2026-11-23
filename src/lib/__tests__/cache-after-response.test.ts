/**
 * Etap 9d — refills finish on Vercel. A promise left running after a serverless response is not
 * guaranteed to finish: every background refill in completeReadCache is handed to the platform hook
 * (Vercel's waitUntil), which keeps the function alive until the refill has stored its entry.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  completeReadCache,
  currentFreshness,
  runWithReadLedger,
  setPlatformWaitUntilForTests,
  setRefreshWriteGraceForTests,
  afterResponse,
} from '../server-cache'
import { fakeNextCache } from './fake-next-cache'

const clock = { t: 9_000_000 }
const now = () => clock.t
let handed: Promise<unknown>[] = []

beforeEach(() => {
  clock.t = 9_000_000
  handed = []
  setPlatformWaitUntilForTests((p) => { handed.push(p) })
  setRefreshWriteGraceForTests(0)
})
afterEach(() => {
  setPlatformWaitUntilForTests(null)
  setRefreshWriteGraceForTests(1_500)
})

/** A read whose answers the test releases one at a time (and can make incomplete or fail). */
function gatedRead() {
  let n = 0
  const gates: Array<(mode?: 'ok' | 'incomplete' | 'throw') => void> = []
  const read = vi.fn(() => new Promise<{ value: number; complete: boolean }>((resolve, reject) => {
    const v = ++n
    gates.push((mode = 'ok') => (mode === 'throw' ? reject(new Error('indexer down')) : resolve({ value: v, complete: mode === 'ok' })))
  }))
  return { read, release: (mode?: 'ok' | 'incomplete' | 'throw') => gates.shift()?.(mode) }
}

describe('fix(cache): refills finish on Vercel', () => {
  it('a stale entry\'s refill, started after the response, is awaited through the platform hook', async () => {
    const cache = fakeNextCache(clock)
    const { read, release } = gatedRead()
    const get = completeReadCache('k', read, { revalidate: 300, tags: () => [], cache: cache.impl, now })
    const fill = get(); release(); await fill
    clock.t += 400_000 // stale

    handed = []
    const answer = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(answer).toMatchObject({ v: 1, f: { dataAgeSeconds: 400 } }) // served at once, with its age
    expect(read).toHaveBeenCalledTimes(2) // the background refill started
    expect(handed).toHaveLength(1) // ...and was handed to the platform hook

    // The hook's promise settles only once the refill has finished (the response was long sent).
    let settled = false
    void handed[0].then(() => { settled = true })
    await new Promise((r) => setTimeout(r, 5))
    expect(settled).toBe(false)
    release()
    await handed[0]
    expect(settled).toBe(true)
    await cache.settle()
    clock.t += 1_000
    expect(await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))).toMatchObject({ v: 2, f: { dataAgeSeconds: 1 } })
  })

  it('one read in flight per key is kept: three stale hits, one refill, one hook registration per refill run', async () => {
    const cache = fakeNextCache(clock)
    const { read, release } = gatedRead()
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: cache.impl, now })
    const fill = get(); release(); await fill
    clock.t += 120_000
    handed = []
    for (let i = 0; i < 3; i++) await get()
    expect(read).toHaveBeenCalledTimes(2)
    release(); await Promise.all(handed); await cache.settle()
  })

  it('afterResponse work is handed to the hook too (the snapshot refill path)', async () => {
    let done = false
    afterResponse('t', async () => { await new Promise((r) => setTimeout(r, 5)); done = true })
    expect(handed).toHaveLength(1)
    await handed[0]
    expect(done).toBe(true)
  })

  it('the hook is Vercel\'s waitUntil (@vercel/functions), a no-op outside a request', async () => {
    setPlatformWaitUntilForTests(null)
    const cache = fakeNextCache(clock)
    const get = completeReadCache('k', async () => ({ value: 1, complete: true }), { revalidate: 60, tags: () => [], cache: cache.impl, now })
    await expect(get()).resolves.toBe(1) // no request context: nothing to extend, nothing throws
  })
})
