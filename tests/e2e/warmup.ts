/**
 * Playwright globalSetup for the screenshot harness: visit every route once in
 * a real browser so `next dev` compiles it — including the API routes and
 * lazy chunks the page only requests client-side (e.g. /agents/[id] calls
 * /api/v1/agents/:id) — BEFORE any shot starts. Without this, the first shot
 * of a route spends its 10 s readiness cap on compilation, not on the page's
 * own data loading: a false "never settled". Runs after `webServer` is up
 * (Playwright starts webServer before globalSetup).
 */
import { chromium, type FullConfig } from '@playwright/test'
import { WARMUP_PATHS } from './shots-routes'

// Long enough for the page's own client-side requests to reach the dev server
// and trigger their compiles; the warm-up doesn't judge readiness.
const DWELL_MS = 4_000

export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) return
  const browser = await chromium.launch()
  const page = await browser.newPage()
  try {
    for (const p of WARMUP_PATHS) {
      const started = Date.now()
      try {
        const res = await page.goto(new URL(p, baseURL).toString(), { waitUntil: 'load', timeout: 180_000 })
        await page.waitForTimeout(DWELL_MS)
        console.log(`[warmup] ${res?.status() ?? '—'} ${p} (${Date.now() - started} ms)`)
      } catch (e) {
        // A route that fails to compile is reported by its shot, not here.
        console.log(`[warmup] failed ${p}: ${(e as Error).message.split('\n')[0]}`)
      }
    }
  } finally {
    await browser.close()
  }
}
