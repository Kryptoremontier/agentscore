/**
 * Playwright config for the screenshot harness (`npm run shots`).
 *
 * Deliberately NOT part of `npm test` — vitest only picks up `src/**` and CI
 * never invokes Playwright, so CI stays fast and never downloads a browser.
 * One-time local setup: `npx playwright install chromium`.
 *
 * Runs against `next dev` on localhost with whatever `.env.local` is present
 * (testnet config) — no Vercel, no SSO. If a dev server is already running on
 * :3000 it is reused, not restarted (and its `.next` cache is left alone).
 */
import { defineConfig } from '@playwright/test'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../..')

// One date folder per run, shared by every worker (workers inherit process.env).
process.env.SHOTS_DATE ??= new Date().toISOString().slice(0, 10)

const PORT = Number(process.env.SHOTS_PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshots.spec.ts',
  // Pre-compiles every route so the per-wait 10 s caps measure data, not `next dev` compilation.
  globalSetup: path.join(__dirname, 'warmup.ts'),
  outputDir: path.join(REPO_ROOT, 'test-results'),
  // `next dev` compiles each route on first hit — cold routes routinely take 20–40s.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Plain `next dev`, not `npm run dev` — the npm script wipes `.next` first.
    command: `npx next dev -p ${PORT}`,
    cwd: REPO_ROOT,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
