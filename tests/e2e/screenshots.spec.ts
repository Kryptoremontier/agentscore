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
 * own loading states resolved first. Every wait is a concrete DOM condition
 * capped at WAIT_CAP; if one misses, the PNG is still written (so you can see
 * what was stuck) but the test is marked failed with the reason, never
 * silently passed.
 *
 * Never `waitForLoadState('networkidle')`: the agent modal polls positions
 * every 15 s (src/app/agents/page.tsx), so the network is never idle there.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'node:path'
import { AGENTS, ROUTES } from './shots-routes'

const REPO_ROOT = path.resolve(__dirname, '../..')
// Cap for each individual wait. Routes are pre-compiled by warmup.ts, so the
// cap measures the page's own data loading; a shot does at most ~5 waits,
// well inside the 180 s test timeout.
const WAIT_CAP = 10_000
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
  { name: 'landing', url: ROUTES.landing },
  { name: 'agents-list', url: ROUTES.agents, prepare: agentsListReady },
  {
    name: 'agents-list-erc8004',
    url: ROUTES.agents,
    prepare: async (page) => {
      await agentsListReady(page)
      const erc = page.locator('button[title^="Real agents from the ERC-8004"]')
      await erc.click()
      // The "All" results line already matches agentsListReady — wait for the filter itself:
      // the toggle is active and no AgentScore-origin card is left.
      await expect(erc).toHaveClass(/border-\[#C8963C\]\/50/, { timeout: WAIT_CAP })
      await expect(page.getByText('via AgentScore', { exact: true })).toHaveCount(0, { timeout: WAIT_CAP })
    },
  },
  ...(['dackie', 'luda', 'openclaw'] as const).map((key): Shot => ({
    name: `agent-modal-${key}`,
    url: `${ROUTES.agents}?open=${AGENTS[key]}`,
    prepare: modalReady,
    target: unfixModal,
  })),
  { name: 'agent-profile-dackie', url: ROUTES.agentProfile(AGENTS.dackie), prepare: profileReady },
  { name: 'domains', url: ROUTES.domains },
  { name: 'evaluators', url: ROUTES.evaluators },
  { name: 'leaderboard', url: ROUTES.leaderboard },
  { name: 'claims', url: ROUTES.claims },
  { name: 'skills', url: ROUTES.skills },
  { name: 'intuforge', url: ROUTES.intuforge },
]

for (const shot of SHOTS) {
  test(shot.name, async ({ page }, testInfo) => {
    const file = path.join(
      REPO_ROOT, 'screenshots', process.env.SHOTS_DATE!, testInfo.project.name, `${shot.name}.png`,
    )

    await page.goto(shot.url, { waitUntil: 'domcontentloaded' })

    // Each wait is capped at WAIT_CAP; the first one that misses is recorded and
    // the shot is still taken, so a PNG is always written.
    let unsettled: string | null = null
    try {
      await settle(page)
      await shot.prepare?.(page)
      await settle(page)
    } catch (e) {
      unsettled = (e as Error).message.split('\n')[0]
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
 * The page's own loading indicators are gone: no visible spinner, no skeleton
 * block (pulsing element > 24px — excludes the 8px live dots), no "Loading…"
 * copy. Deliberately not network-based (see file header).
 */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const spinner = [...document.querySelectorAll('.animate-spin')].some(shown)
    // .animate-pulse (most pages) and .shimmer (shared LoadingSkeleton, e.g. /agents/[id]).
    const skeleton = [...document.querySelectorAll('.animate-pulse, .shimmer')].some((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 24 && r.height > 24
    })
    const loadingCopy = /\bLoading\b/.test(document.body.innerText)
    return !spinner && !skeleton && !loadingCopy
  }, null, { timeout: WAIT_CAP, polling: 250 })
}

/** /agents renders its grid only after BOTH corpora (AgentScore + ERC-8004 cohort) resolved. */
async function agentsListReady(page: Page) {
  await page
    .getByText(/^\d+( of \d+)? agents?/)
    .or(page.getByText('No agents registered yet'))
    .or(page.getByText(/^Error:/))
    .first()
    .waitFor({ timeout: WAIT_CAP })
}

/**
 * Modal is open and its own "—" loading placeholders resolved: the four
 * primary stat boxes and the Backers line render "—" only while loading
 * (see the Etap 4b comments in src/app/agents/page.tsx), and the ATTESTED
 * section left its skeleton — either the "Attested Domains" heading (≥1
 * attestation) or the empty state (0 attestations, e.g. OPEN CLAW).
 */
async function modalReady(page: Page) {
  const modal = modalLocator(page)
  await modal.waitFor({ timeout: WAIT_CAP })
  await expect(modal.getByText(/^Backers: \d/)).toBeVisible({ timeout: WAIT_CAP })
  // The agent tier chip resolved: "Unverified · 1/3 attesters", "Trusted · 2/3 attesters" or
  // "Verified" (lib/agent-tier.ts). "—/3 attesters" (loading) and "Tier unavailable" don't match.
  await expect(modal.getByTestId('agent-tier-chip').getByText(/\d+\/\d+ attesters|Verified/).first()).toBeVisible({ timeout: WAIT_CAP })
  // The four primary stat boxes print "—" only while their data loads.
  await expect(modal.locator('p.text-lg.font-bold.text-white', { hasText: /^—$/ })).toHaveCount(0, { timeout: WAIT_CAP })
  await expect(
    modal.getByText('Attested Domains', { exact: true })
      .or(modal.getByText('Unverified — no attestations yet', { exact: true }))
      .first(),
  ).toBeVisible({ timeout: WAIT_CAP })
}

/**
 * /agents/[id] resolved: the ATTESTED section rendered (heading or empty
 * state) or the page's own not-found state.
 */
async function profileReady(page: Page) {
  await page
    .getByText('Attested Domains', { exact: true })
    .or(page.getByText('Unverified — no attestations yet', { exact: true }))
    .or(page.getByText('Agent Not Found', { exact: true }))
    .first()
    .waitFor({ timeout: WAIT_CAP })
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
