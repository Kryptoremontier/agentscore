/**
 * A poll that only spends the indexer budget while someone can see it (Etap 4b-cache).
 *
 * The modals refresh positions every 15 s to catch other wallets' trades; a modal left open in a
 * background tab kept doing that (8 requests a minute, docs/audit/rate-limit.md) against the
 * 75/min per-IP limit. Here a tick never fires while `document.hidden`; when the page becomes
 * visible again it refreshes once immediately and resumes the interval.
 *
 * `firstDelayMs` lets a modal that opened on data the list just read wait out the rest of the
 * interval instead of re-reading it at once (the data is never older than one interval).
 * Pure scheduling with injectable timers and document, so it is unit-tested without a DOM.
 */

export interface VisiblePollDeps {
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
}

export interface VisiblePollOptions {
  tick: () => void
  intervalMs: number
  /** Delay before the first tick. Default 0 (tick now, if visible). */
  firstDelayMs?: number
  deps?: VisiblePollDeps
}

function browserDeps(): VisiblePollDeps {
  return {
    doc: document,
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
  }
}

/** Start polling; returns stop(). */
export function startVisiblePoll(options: VisiblePollOptions): () => void {
  const deps = options.deps ?? browserDeps()
  let timer: unknown = null
  let stopped = false

  const schedule = (ms: number) => {
    if (timer !== null) deps.clearTimeout(timer)
    timer = deps.setTimeout(run, Math.max(0, ms))
  }
  function run() {
    timer = null
    if (stopped) return
    // Hidden: stop here. The visibility handler restarts the poll with a refresh.
    if (deps.doc.hidden) return
    options.tick()
    schedule(options.intervalMs)
  }
  const onVisibility = () => {
    if (stopped || deps.doc.hidden) return
    schedule(0)
  }

  deps.doc.addEventListener('visibilitychange', onVisibility)
  schedule(options.firstDelayMs ?? 0)
  return () => {
    stopped = true
    if (timer !== null) deps.clearTimeout(timer)
    deps.doc.removeEventListener('visibilitychange', onVisibility)
  }
}

/** Remaining wait before data read at `readAt` is one interval old (0 when it already is). */
export function firstDelayFor(readAt: number | null | undefined, intervalMs: number, now: number = Date.now()): number {
  if (readAt == null) return 0
  return Math.max(0, Math.min(intervalMs, intervalMs - (now - readAt)))
}
