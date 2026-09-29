/**
 * Playwright config for the dead-indexer shot (`npm run shots:dead-indexer`). Needs a production
 * server started with the tests/e2e/dead-indexer.cjs preload and the same DEAD_INDEXER_FLAG (see
 * that file); the spec toggles the flag. Not part of `npm test` or CI.
 */
import { defineConfig } from '@playwright/test'
import path from 'node:path'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'resilience.spec.ts',
  globalSetup: undefined,
  webServer: undefined,
  timeout: 10 * 60_000,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  outputDir: path.join(__dirname, '../../test-results'),
})
