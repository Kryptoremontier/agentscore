/**
 * The dead-indexer shot (Etap 4c): with a warm cache and the indexer unreachable, /agents must look
 * normal apart from its age lines (the header's, the modal's) — no error box, cards, attester lines,
 * a working modal — and the browser must not need the indexer at all (its requests to it are
 * blocked and counted).
 *
 * Production 29.09 05:37 UTC: the page showed "Error: Load failed" while our server held a complete
 * read 110 s old. Run against a production server with the dead-indexer preload (dead-indexer.cjs);
 * PNGs go to screenshots/<SHOTS_DATE>-dead-indexer/<desktop|mobile>/.
 */
import { test, expect, type Page } from '@playwright/test'
import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AGENTS, ROUTES } from './shots-routes'

const FLAG = process.env.DEAD_INDEXER_FLAG
const OUT = path.resolve(__dirname, '../../screenshots', `${process.env.SHOTS_DATE ?? new Date().toISOString().slice(0, 10)}-dead-indexer`)
/** Past the corpus part's stale bound: 2 × its 60 s TTL + the 45 s CDN window (lib/agents-page-data.ts). */
const OUTAGE_MS = 170_000
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const

async function listReady(page: Page) {
  await page.getByText(/^\d+( of \d+)? agents?/).or(page.getByTestId('feed-unreachable')).first().waitFor({ timeout: 60_000 })
  await expect(page.locator('[data-testid="card-attester-line"][data-state="loading"]')).toHaveCount(0, { timeout: 30_000 })
}
const modal = (page: Page) => page.locator('div.fixed.inset-0.overflow-y-auto').filter({ hasText: 'Atom ID:' }).first()

test('dead indexer, warm cache: /agents looks normal apart from its age line', async ({ browser }) => {
  test.skip(!FLAG, 'needs DEAD_INDEXER_FLAG and a server started with tests/e2e/dead-indexer.cjs')
  rmSync(FLAG!, { force: true })

  // 1. Warm: the list and the three reference modals read once through the server cache.
  const warm = await browser.newPage()
  await warm.goto(ROUTES.agents)
  await listReady(warm)
  for (const id of Object.values(AGENTS)) {
    await warm.goto(`${ROUTES.agents}?open=${id}`)
    await expect(modal(warm).getByText(/^Backers: \d/)).toBeVisible({ timeout: 60_000 })
  }
  await warm.close()

  // 2. The indexer goes dead for the server — and the browser may not reach it either (below).
  writeFileSync(FLAG!, 'dead')
  try {
    // 3. Long enough that the list's corpus is past what the cache serves while the indexer answers.
    await new Promise((r) => setTimeout(r, OUTAGE_MS))

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile', colorScheme: 'dark' })
      const page = await ctx.newPage()
      let indexerRequests = 0
      await page.route('**/v1/graphql', (route) => { indexerRequests++; return route.abort() })

      await page.goto(ROUTES.agents)
      await listReady(page)
      await expect(page.getByTestId('feed-unreachable')).toHaveCount(0)
      await expect(page.getByText(/Updated \d+ min ago/).first()).toBeVisible()
      await expect(page.getByText('GraphQL live feed')).toHaveCount(0)
      await expect(page.locator('[data-card]').first()).toBeVisible()
      await expect(page.locator('[data-testid="card-attester-line"][data-state="some"]').first()).toBeVisible()
      await page.screenshot({ path: path.join(OUT, name, 'agents-list.png') })

      await page.goto(`${ROUTES.agents}?open=${AGENTS.openclaw}`)
      await expect(modal(page).getByText(/^Backers: \d/)).toBeVisible({ timeout: 30_000 })
      await expect(modal(page).getByTestId('agent-tier-chip').getByText(/\d+\/\d+ attesters|Verified/).first()).toBeVisible()
      // The modal covers the header on a phone: it says the age itself.
      await expect(modal(page).getByTestId('modal-age')).toHaveText(/^Updated \d+ min ago$/)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(OUT, name, 'agent-modal-openclaw.png') })

      expect(indexerRequests, 'browser → indexer requests').toBe(0)
      await ctx.close()
    }
  } finally {
    rmSync(FLAG!, { force: true })
  }
})
