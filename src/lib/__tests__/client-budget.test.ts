import { describe, it, expect, vi, afterEach } from 'vitest'
import { startVisiblePoll, firstDelayFor, type VisiblePollDeps } from '../visible-poll'
import { fetchAgentListCorpus, listOpposeWei, listTrustTriple, listVaultSnapshot, type AgentListAtom } from '../agent-list'
import { installFakeHasura } from './fake-hasura'

/**
 * Etap 4b-cache commit 2 — one user can't exhaust the indexer's 75/min per-IP budget.
 * Recon (docs/audit/rate-limit.md, production build): cold /agents 23 requests, a modal open 15,
 * +8/min while open (a poll tick = 2), so /agents + 3 modals in a minute = 76.
 */

// ─── Visible poll ─────────────────────────────────────────────────────────────

function fakeDeps() {
  let now = 0
  let hidden = false
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const listeners = new Set<() => void>()
  const deps: VisiblePollDeps = {
    doc: {
      get hidden() { return hidden },
      addEventListener: (_: string, fn: () => void) => { listeners.add(fn) },
      removeEventListener: (_: string, fn: () => void) => { listeners.delete(fn) },
    } as unknown as VisiblePollDeps['doc'],
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id },
    clearTimeout: (id) => { timers.delete(id as number) },
  }
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > end) break
      timers.delete(next[0])
      now = next[1].at
      next[1].fn()
    }
    now = end
  }
  const setHidden = (h: boolean) => { hidden = h; for (const l of listeners) l() }
  return { deps, advance, setHidden, listeners, timers }
}

describe('startVisiblePoll — no ticks while the tab is hidden', () => {
  it('ticks every interval while visible', () => {
    const f = fakeDeps()
    const tick = vi.fn()
    startVisiblePoll({ tick, intervalMs: 15_000, deps: f.deps })
    f.advance(0)
    f.advance(60_000)
    expect(tick).toHaveBeenCalledTimes(5) // at 0, 15, 30, 45, 60 s
  })

  it('hidden → no requests at all; visible again → one immediate refresh, then the interval', () => {
    const f = fakeDeps()
    const tick = vi.fn()
    startVisiblePoll({ tick, intervalMs: 15_000, firstDelayMs: 15_000, deps: f.deps })
    f.setHidden(true)
    f.advance(5 * 60_000)
    expect(tick).not.toHaveBeenCalled()
    f.setHidden(false)
    f.advance(0)
    expect(tick).toHaveBeenCalledTimes(1)
    f.advance(15_000)
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('stop() ends the poll and removes the visibility listener', () => {
    const f = fakeDeps()
    const tick = vi.fn()
    const stop = startVisiblePoll({ tick, intervalMs: 15_000, deps: f.deps })
    stop()
    f.advance(60_000)
    f.setHidden(false)
    expect(tick).not.toHaveBeenCalled()
    expect(f.listeners.size).toBe(0)
  })

  it('firstDelayFor: data read 5 s ago waits 10 s more; unknown or older → now', () => {
    expect(firstDelayFor(1_000, 15_000, 6_000)).toBe(10_000)
    expect(firstDelayFor(1_000, 15_000, 60_000)).toBe(0)
    expect(firstDelayFor(null, 15_000, 60_000)).toBe(0)
  })
})

// ─── The modal reuses what the list read ─────────────────────────────────────

afterEach(() => vi.unstubAllGlobals())

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const TRIPLE = '0xtrust'
const COUNTER = '0xcounter'
const W = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const atom = (term_id: string, triples: Array<{ term_id: string; counter_term_id: string }>) => ({
  term_id, label: term_id === LUDA ? 'Luda' : 'OPEN CLAW', type: 'Thing', created_at: '2026-03-01T00:00:00Z',
  positions_aggregate: { aggregate: { sum: { shares: '1000' } } }, as_subject_triples: triples,
})

describe('the /agents list reads what the modal needs, once', () => {
  it('trust triple, positions (with meta) and oppose come with the row — the modal needs no request for them', async () => {
    const fake = installFakeHasura({
      tables: [
        { match: (q) => q.includes('AgentListCorpus'), field: 'atoms', rows: [atom(LUDA, []), atom(OPEN_CLAW, [{ term_id: TRIPLE, counter_term_id: COUNTER }])] },
        {
          match: (q) => q.includes('VaultPositions'), field: 'positions',
          rows: [
            { id: `${OPEN_CLAW}-1-${W}`, term_id: OPEN_CLAW, account_id: W, shares: '1000', created_at: '2026-03-02T00:00:00Z', updated_at: '2026-03-02T00:00:00Z', account: { label: 'w' } },
            { id: `${COUNTER}-1-${W}`, term_id: COUNTER, account_id: W, shares: '400', created_at: '2026-03-03T00:00:00Z', updated_at: '2026-03-03T00:00:00Z', account: { label: 'w' } },
          ],
        },
      ],
    })
    const { rows } = await fetchAgentListCorpus()
    const claw = rows.find((r) => r.term_id === OPEN_CLAW)!
    const luda = rows.find((r) => r.term_id === LUDA)!

    expect(listTrustTriple(claw)).toEqual({ termId: TRIPLE, counterTermId: COUNTER })
    expect(listTrustTriple(luda)).toEqual({ termId: null, counterTermId: null }) // read: no trust triple
    expect(listVaultSnapshot(claw)?.positions.map((p) => p.term_id).sort()).toEqual([COUNTER, OPEN_CLAW].sort())
    expect(listVaultSnapshot(claw)?.positions[0]).toHaveProperty('created_at')
    expect(listOpposeWei(claw)).toBe(400n)
    expect(listOpposeWei(luda)).toBe(0n)
    expect(fake.calls.find((c) => c.query.includes('AgentListCorpus'))!.query).toMatch(/as_subject_triples[\s\S]*\{ term_id counter_term_id \}/)
    expect(fake.calls.find((c) => c.query.includes('VaultPositions'))!.query).toContain('created_at')
  })

  it('a failed list positions read is not reused — the modal reads them itself', async () => {
    installFakeHasura({
      tables: [{ match: (q) => q.includes('AgentListCorpus'), field: 'atoms', rows: [atom(OPEN_CLAW, [{ term_id: TRIPLE, counter_term_id: COUNTER }])] }],
      fail: (q) => (q.includes('VaultPositions') ? 'throw' : undefined),
    })
    const { rows } = await fetchAgentListCorpus()
    expect(listVaultSnapshot(rows[0])).toBeNull()
    expect(listOpposeWei(rows[0])).toBeUndefined()
    expect(listTrustTriple(rows[0])).toEqual({ termId: TRIPLE, counterTermId: COUNTER }) // the row itself read fine
  })

  it('a cohort row (never read the vaults or the triple) → the modal looks them up', () => {
    const cohort: AgentListAtom = { term_id: '0xdackie', label: 'Captain Dackie', type: 'Thing', created_at: '' }
    expect(listTrustTriple(cohort)).toBeUndefined()
    expect(listVaultSnapshot(cohort)).toBeNull()
    expect(listOpposeWei(cohort)).toBeUndefined()
  })
})
