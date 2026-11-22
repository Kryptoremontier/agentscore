/**
 * The agent modal never loops on its own data (found in Etap 9; the defect was older).
 *
 * The modal's answer is merged into one state object with an updater: `setModalData((prev) =>
 * ({ ...prev, ...d }))`. While an earlier update on that state is still pending at a lower
 * priority — a `?open=<id>` link opened during hydration — React re-runs the updater on every
 * render, so the merged object is new each time. Effects that depended on the whole object re-ran
 * on every render, each set fresh state, and the page re-rendered until React stopped it with
 * "Maximum update depth exceeded" (the error page, on ~3% of modal opens in a production build).
 *
 * The rule: everything reads a part and depends on that part. The parts keep their identity
 * through a re-run (they come from the answer), and so does the one "failed" placeholder.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const client = readFileSync(path.join(__dirname, '..', '..', 'app/agents/agents-client.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the modal\'s parts keep their identity', () => {
  it('no hook depends on the merged modalData object — only on the part it reads', () => {
    const deps = [...client.matchAll(/\}, \[([^\]\n]*)\]\)/g)].map((m) => m[1]).concat([...client.matchAll(/^\s+\[([^\]\n]*)\],\n\s+\)/gm)].map((m) => m[1]))
    expect(deps.length).toBeGreaterThan(30) // the scan sees the component's hooks
    const whole = deps.filter((d) => d.split(',').map((x) => x.trim()).includes('modalData'))
    expect(whole).toEqual([])
    for (const part of ['modalVault', 'modalSignals', 'modalReports', 'modalSkillTriples', 'modalStakerWeights']) {
      expect(client).toMatch(new RegExp(`const ${part} = modalData\\?\\.\\w+\\n`))
      expect(deps.some((d) => d.split(',').map((x) => x.trim()).includes(part)), `${part} is a dependency`).toBe(true)
    }
    expect(deps).toContain('modalData?.identity')
  })

  it('a part that never answered is one shared object, not a new one per re-run of the updater', () => {
    expect(client).toMatch(/const FAILED_MODAL_PART = \{ status: 'failed' as const \}/)
    expect(client).toMatch(/\.map\(\(p\) => \[p, FAILED_MODAL_PART\]\)/)
    expect(client).not.toMatch(/\[p, \{ status: 'failed'/)
  })

  it('re-running the merge gives a new object with the same parts inside', () => {
    // What React does on a rebase: the same updater, the same answer, applied again.
    const answer = { vault: { status: 'ok' as const, value: 1 }, reports: { status: 'ok' as const, value: [] } }
    const merge = (prev: Record<string, unknown> | null) => ({ ...(prev ?? {}), ...answer })
    const first = merge(null)
    const second = merge(null)
    expect(second).not.toBe(first)          // why depending on the whole object looped
    expect(second.vault).toBe(first.vault)  // why depending on the part does not
    expect(second.reports).toBe(first.reports)
  })
})
