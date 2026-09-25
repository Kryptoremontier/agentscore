/**
 * Screenshot harness — `npm run shots`.
 *
 * Captures every route/state below as a full-page PNG at both viewports
 * (desktop 1440×900, mobile 390×844, see playwright.config.ts) into
 * `screenshots/<date>/<viewport>/<name>.png` (gitignored).
 *
 * Wallet state: disconnected only. The repo has no connected-wallet fixture
 * and this harness deliberately doesn't invent wallet mocking.
 *
 * Honesty rule for the harness itself: a shot is only "clean" if the page's
 * own loading states resolved first. If they don't within SETTLE_TIMEOUT the
 * PNG is still written (so you can see what was stuck) but the test is marked
 * failed with the reason, never silently passed.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'node:path'

// Term ids of the three reference agents used across the Etap 3/4b work
// (same ids as src/lib/__tests__/agent-profile.test.ts; OPEN CLAW from
// /api/v1/agents). `/agents?open=<id>` is the page's own deep-link.
const AGENTS = {
  dackie: '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb',
  luda: '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a',
  openclaw: '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d',
} as const

const REPO_ROOT = path.resolve(__dirname, '../..')
const SETTLE_TIMEOUT = 60_000
// Total wait per shot (settle + prepare + settle) — must stay below the 180s test timeout.
const SETTLE_BUDGET = 90_000
// framer-motion entrance animations are JS-driven (not stopped by `animations: 'disabled'`).
const ANIMATION_GRACE_MS = 1_200

interface Shot {
  name: string
  url: string
  /** Extra steps after the page settles (clicks, page-specific ready markers). */
  prepare?: (page: Page) => Promise<void>
  /** Capture a specific element at its full height instead of the page. */
  target?: (page: Page) => Promise<Locator>
}

const SHOTS: Shot[] = [
  { name: 'landing', url: '/' },
  { name: 'agents-list', url: '/agents', prepare: agentsListReady },
  {
    name: 'agents-list-erc8004',
    url: '/agents',
    prepare: async (page) => {
      await agentsListReady(page)
      await page.locator('button[title^="Real agents from the ERC-8004"]').click()
      await agentsListReady(page)
    },
  },
  ...(['dackie', 'luda', 'openclaw'] as const).map((key): Shot => ({
    name: `agent-modal-${key}`,
    url: `/agents?open=${AGENTS[key]}`,
    prepare: modalReady,
    target: unfixModal,
  })),
  { name: 'agent-profile-dackie', url: `/agents/${AGENTS.dackie}` },
  { name: 'domains', url: '/domains' },
  { name: 'evaluators', url: '/evaluators' },
  { name: 'leaderboard', url: '/leaderboard' },
  { name: 'claims', url: '/claims' },
  { name: 'skills', url: '/skills' },
  { name: 'intuforge', url: '/explore/intuforge' },
]

for (const shot of SHOTS) {
  test(shot.name, async ({ page }, testInfo) => {
    const file = path.join(
      REPO_ROOT, 'screenshots', process.env.SHOTS_DATE!, testInfo.project.name, `${shot.name}.png`,
    )

    await page.goto(shot.url, { waitUntil: 'domcontentloaded' })

    // One budget for all waiting, well inside the test timeout, so a PNG is always written.
    let unsettled: string | null = null
    let budgetTimer: ReturnType<typeof setTimeout> | undefined
    const waited = (async () => {
      await settle(page)
      await shot.prepare?.(page)
      await settle(page)
    })()
    waited.catch(() => {}) // may still reject after the budget wins the race
    try {
      await Promise.race([
        waited,
        new Promise((_, reject) => {
          budgetTimer = setTimeout(() => reject(new Error(`not settled within ${SETTLE_BUDGET / 1000}s`)), SETTLE_BUDGET)
        }),
      ])
    } catch (e) {
      unsettled = (e as Error).message.split('\n')[0]
    } finally {
      clearTimeout(budgetTimer)
    }
    await page.waitForTimeout(ANIMATION_GRACE_MS)

    if (shot.target) {
      const el = await shot.target(page).catch(() => null)
      if (el) await el.screenshot({ path: file })
      else await page.screenshot({ path: file, fullPage: true })
    } else {
      await page.screenshot({ path: file, fullPage: true })
    }

    testInfo.annotations.push({ type: 'screenshot', description: path.relative(REPO_ROOT, file) })
    expect.soft(unsettled, `${shot.name}: page never settled — screenshot shows a loading state`).toBeNull()
  })
}

/**
 * Network idle, then the page's own loading indicators gone: no visible
 * spinner, no skeleton block (pulsing element > 24px — excludes the 8px live
 * dots), no "Loading…" copy.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT }).catch(() => {})
  await page.waitForFunction(() => {
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const spinner = [...document.querySelectorAll('.animate-spin')].some(shown)
    const skeleton = [...document.querySelectorAll('.animate-pulse')].some((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 24 && r.height > 24
    })
    const loadingCopy = /\bLoading\b/.test(document.body.innerText)
    return !spinner && !skeleton && !loadingCopy
  }, null, { timeout: SETTLE_TIMEOUT, polling: 250 })
}

/** /agents renders its grid only after BOTH corpora (AgentScore + ERC-8004 cohort) resolved. */
async function agentsListReady(page: Page) {
  await page
    .getByText(/^\d+( of \d+)? agents/)
    .or(page.getByText('No agents registered yet'))
    .or(page.getByText(/^Error:/))
    .first()
    .waitFor({ timeout: SETTLE_TIMEOUT })
}

/**
 * Modal is open and its own "—" loading placeholders resolved: the four
 * primary stat boxes and the Backers line render "—" only while loading
 * (see the Etap 4b comments in src/app/agents/page.tsx).
 */
async function modalReady(page: Page) {
  const modal = modalLocator(page)
  await modal.waitFor({ timeout: SETTLE_TIMEOUT })
  await expect(modal.getByText(/^Backers: \d/)).toBeVisible({ timeout: SETTLE_TIMEOUT })
  await expect(modal.getByText(/\d+\/\d+ attesters/)).toBeVisible({ timeout: SETTLE_TIMEOUT })
}

function modalLocator(page: Page) {
  return page.locator('div.fixed.inset-0.overflow-y-auto').filter({ hasText: 'Atom ID:' }).first()
}

/**
 * The modal is a fixed, internally-scrolling overlay — a page screenshot only
 * gets its first screen. Un-fix it (test-side styling only) so the element
 * screenshot has the modal's full height.
 */
async function unfixModal(page: Page): Promise<Locator> {
  const modal = modalLocator(page)
  if ((await modal.count()) === 0) throw new Error('modal not open')
  await modal.evaluate((el: HTMLElement) => {
    Object.assign(el.style, {
      position: 'absolute', inset: 'auto', top: getComputedStyle(el).top, left: '0', width: '100%',
      height: 'auto', overflow: 'visible', backgroundAttachment: 'scroll',
    })
    document.body.style.overflow = ''
    window.scrollTo(0, 0)
  })
  return modal
}
