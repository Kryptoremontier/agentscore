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
const modal = (page: Page) => page.locator('div.fixed.inset-0.overflow-y-auto').filter({ has: page.getByTestId('agent-details') }).first()

/**
 * Etap 9d — a failed read is not "not found". On a fresh server (nothing cached, no snapshot store)
 * with the indexer dead from the start, every agent surface says "couldn't read" with the time and
 * "Try again", and REST answers 503 read_failed — never "not found" / 404. Runs first: it needs the
 * cold cache the warm test below fills.
 */
test('dead indexer, cold cache: an agent that can\'t be read says so, never "not found"', async ({ browser, request }) => {
  test.skip(!FLAG, 'needs DEAD_INDEXER_FLAG and a server started with tests/e2e/dead-indexer.cjs')
  writeFileSync(FLAG!, 'dead')
  try {
    const rest = await request.get(`/api/v1/agents/${AGENTS.luda}`, { timeout: 120_000 })
    expect(rest.status(), 'REST: a failed read').toBe(503)
    expect(await rest.json()).toMatchObject({ success: false, error: 'read_failed' })

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile', colorScheme: 'dark' })
      const page = await ctx.newPage()
      // The browser can't reach the indexer either (the profile resolves its atom from the browser).
      await page.route('**/v1/graphql', (route) => route.abort())

      const shoot = async (file: string) => {
        const panel = page.getByTestId('agent-unread').first()
        await expect(panel).toContainText('We couldn’t read this agent from Intuition right now. This is our read failing, not the agent missing.', { timeout: 120_000 })
        await expect(panel.getByTestId('agent-unread-retry')).toHaveText(/Try again/)
        await expect(panel.getByTestId('agent-unread-at')).toHaveText(/^Tried at \d\d:\d\d:\d\d UTC$/)
        await expect(page.getByText(/not found/i)).toHaveCount(0)
        await page.waitForTimeout(800)
        await page.screenshot({ path: path.join(OUT, name, file) })
      }

      await page.goto(ROUTES.checkCard(AGENTS.luda))
      await shoot('agent-unread-check.png')
      await page.goto(`${ROUTES.agents}?open=${AGENTS.luda}`)
      await shoot('agent-unread-modal-link.png')
      await page.goto(ROUTES.agentProfile(AGENTS.luda))
      await shoot('agent-unread-profile.png')
      await ctx.close()
    }
  } finally {
    rmSync(FLAG!, { force: true })
  }
})

test('dead indexer, warm cache: /agents looks normal apart from its age line', async ({ browser }) => {
  test.skip(!FLAG, 'needs DEAD_INDEXER_FLAG and a server started with tests/e2e/dead-indexer.cjs')
  rmSync(FLAG!, { force: true })

  // 1. Warm: the list and the three reference modals read once through the server cache.
  const warm = await browser.newPage()
  await warm.goto(ROUTES.agents)
  await listReady(warm)
  for (const id of Object.values(AGENTS)) {
    await warm.goto(`${ROUTES.agents}?open=${id}`)
    await expect(modal(warm).getByTestId('backers-line').filter({ hasText: /^(Backed with \d|No tTRUST backing yet)/ })).toBeVisible({ timeout: 60_000 })
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
      await expect(page.getByTestId('agents-status')).toHaveAttribute('data-fresh', 'stale')
      await expect(page.getByTestId('agents-status')).toContainText(/, updated \d+ min ago$/)
      await expect(page.locator('[data-card]').first()).toBeVisible()
      await expect(page.locator('[data-testid="card-attester-line"][data-state="some"]').first()).toBeVisible()
      await page.screenshot({ path: path.join(OUT, name, 'agents-list.png') })

      await page.goto(`${ROUTES.agents}?open=${AGENTS.openclaw}`)
      await expect(modal(page).getByTestId('backers-line').filter({ hasText: /^(Backed with \d|No tTRUST backing yet)/ })).toBeVisible({ timeout: 30_000 })
      await expect(modal(page).getByTestId('agent-tier-chip').getByText(/\d+ of \d+ people needed to verify|Verified/).first()).toBeVisible()
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
