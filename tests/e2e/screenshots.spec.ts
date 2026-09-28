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
  /** Capture only the first screen (what a visitor sees before scrolling), not the full page. */
  firstScreen?: boolean
  /**
   * Layout assertions, run after the PNG is written (so a failure still leaves the shot).
   * Receives the viewport's project name; a failure fails the test with its own message.
   */
  check?: (page: Page, project: string) => Promise<void>
}

const SHOTS: Shot[] = [
  { name: 'landing', url: ROUTES.landing, prepare: landingStatsReady },
  { name: 'agents-list', url: ROUTES.agents, prepare: agentsListReady },
  // The first screen, as a visitor sees it: at 390×844 the first card must be on it.
  { name: 'agents-list-fold', url: ROUTES.agents, prepare: agentsListReady, firstScreen: true, check: firstCardAboveFold },
  {
    name: 'agents-list-erc8004',
    url: ROUTES.agents,
    prepare: async (page) => {
      await agentsListReady(page)
      const erc = page.getByRole('tab', { name: /^ERC-8004/ })
      await erc.click()
      // The "All" results line already matches agentsListReady — wait for the filter itself:
      // the tab is selected, the URL carries it, and no AgentScore-origin card is left.
      await expect(erc).toHaveAttribute('aria-selected', 'true', { timeout: WAIT_CAP })
      await expect(page).toHaveURL(/[?&]origin=erc8004\b/, { timeout: WAIT_CAP })
      await expect(page.getByText('via AgentScore', { exact: true })).toHaveCount(0, { timeout: WAIT_CAP })
    },
    check: originTabsMatchHeader,
  },
  {
    // A shared filtered view: the URL alone sets the origin tab and the quality filter.
    name: 'agents-list-erc8004-unrated',
    url: `${ROUTES.agents}?origin=erc8004&quality=unrated`,
    prepare: async (page) => {
      await agentsListReady(page)
      await expect(page.getByRole('tab', { name: /^ERC-8004/ })).toHaveAttribute('aria-selected', 'true', { timeout: WAIT_CAP })
      await expect(page.getByRole('combobox', { name: 'Quality' })).toHaveValue('unrated', { timeout: WAIT_CAP })
      await expect(page.getByTestId('results-line')).toContainText('Unrated', { timeout: WAIT_CAP })
    },
    check: qualityDropdownListsEveryBucket,
  },
  {
    name: 'agents-list-listview',
    url: ROUTES.agents,
    prepare: async (page) => {
      await agentsListReady(page)
      await page.getByRole('button', { name: 'List', exact: true }).click()
      await expect(page.locator('[data-card]')).toHaveCount(0, { timeout: WAIT_CAP })
    },
    check: gridListParity,
  },
  ...(['dackie', 'luda', 'openclaw'] as const).map((key): Shot => ({
    name: `agent-modal-${key}`,
    url: `${ROUTES.agents}?open=${AGENTS[key]}`,
    prepare: modalReady,
    target: unfixModal,
    check: modalFitsPhone,
  })),
  ...(['dackie', 'luda', 'openclaw'] as const).map((key): Shot => ({
    name: `agent-profile-${key}`,
    url: ROUTES.agentProfile(AGENTS[key]),
    prepare: profileReady,
  })),
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
      await page.screenshot({ path: file, fullPage: !shot.firstScreen })
    }

    testInfo.annotations.push({ type: 'screenshot', description: path.relative(REPO_ROOT, file) })
    expect.soft(unsettled, `${shot.name}: page never settled — screenshot shows a loading state`).toBeNull()

    if (shot.check) {
      let broken: string | null = null
      try {
        await shot.check(page, testInfo.project.name)
      } catch (e) {
        broken = (e as Error).message.split('\n').slice(0, 6).join('\n')
      }
      expect.soft(broken, `${shot.name}: layout check failed`).toBeNull()
    }
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

/**
 * /agents renders its grid only after BOTH corpora (AgentScore + ERC-8004 cohort) resolved;
 * then the cards' attester lines leave their loading skeleton once the bulk attestation read answers
 * (data-state "some" / "none", or "unread" when it failed — lib/agent-list.ts cardAttesterLine).
 */
async function agentsListReady(page: Page) {
  await page
    .getByText(/^\d+( of \d+)? agents?/)
    .or(page.getByText('No agents registered yet'))
    .or(page.getByText(/^Error:/))
    .first()
    .waitFor({ timeout: WAIT_CAP })
  await expect(page.locator('[data-testid="card-attester-line"][data-state="loading"]')).toHaveCount(0, { timeout: WAIT_CAP })
}

/** Landing Hero/Stats tiles print "—" while /api/v1/stats loads (lib/landing-stats.ts); wait for the answer. */
async function landingStatsReady(page: Page) {
  await expect(page.locator('[data-testid="landing-stat"][data-state="loading"]')).toHaveCount(0, { timeout: WAIT_CAP })
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
 * /agents/[id] resolved: the agent tier chip left its loading state and the
 * ATTESTED section rendered (heading or empty state). The reference agents all
 * exist — ERC-8004 ones included — so "Agent Not Found" is a failure here, not
 * a settled page.
 */
async function profileReady(page: Page) {
  await expect(page.getByText('Agent Not Found', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('agent-tier-chip').getByText(/\d+\/\d+ attesters|Verified/).first()).toBeVisible({ timeout: WAIT_CAP })
  await expect(
    page.getByText('Attested Domains', { exact: true })
      .or(page.getByText('Unverified — no attestations yet', { exact: true }))
      .first(),
  ).toBeVisible({ timeout: WAIT_CAP })
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

/**
 * Elements inside `root` that reach past the viewport's left or right edge (a phone
 * would clip them or scroll sideways). Only the outermost offender of a subtree is
 * listed. `[]` = everything fits.
 */
async function pastViewportEdges(root: Locator): Promise<string[]> {
  return root.evaluate((el) => {
    const w = window.innerWidth
    const over = (r: DOMRect) => r.width > 0 && (r.left < -0.5 || r.right > w + 0.5)
    const out: string[] = []
    for (const node of el.querySelectorAll('*')) {
      const r = node.getBoundingClientRect()
      if (!over(r)) continue
      const parent = node.parentElement
      if (parent && parent !== el && over(parent.getBoundingClientRect())) continue
      out.push(`<${node.tagName.toLowerCase()}> ${Math.round(r.left)}..${Math.round(r.right)} px "${(node.textContent ?? '').trim().slice(0, 40)}"`)
    }
    return out.slice(0, 8)
  })
}

/**
 * Phones only (4b-list §6 #1, #5): every modal tab is on screen, at least 44 px tall and
 * clickable (clicking selects it), and on every tab no element reaches past the viewport.
 */
async function modalFitsPhone(page: Page, project: string) {
  if (project !== 'mobile') return
  const modal = modalLocator(page)
  const width = page.viewportSize()!.width
  const tabs = modal.getByRole('tab')
  await expect(tabs).toHaveCount(4)
  for (const tab of await tabs.all()) {
    const name = (await tab.textContent())?.trim()
    await tab.scrollIntoViewIfNeeded()
    await expect(tab, `tab "${name}" visible`).toBeVisible()
    const box = (await tab.boundingBox())!
    expect(box.x, `tab "${name}" starts on screen`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `tab "${name}" ends on screen`).toBeLessThanOrEqual(width)
    expect(box.height, `tab "${name}" is a ≥44 px target`).toBeGreaterThanOrEqual(44)
    await tab.click()
    await expect(tab, `tab "${name}" selected after a click`).toHaveAttribute('aria-selected', 'true')
    await settle(page).catch(() => {}) // measure the tab's loaded content where it loads in time
    expect(await pastViewportEdges(modal), `tab "${name}": elements past the ${width} px viewport`).toEqual([])
  }
}

/**
 * The list view carries the grid card's information (Etap 4b-finish commit 4): for Dackie,
 * Luda and OPEN CLAW the list row and the grid card print the same attester line, and the
 * list row shows the whole name inside the viewport (it used to collapse to one character).
 * Runs in list view (the shot's state), then switches to the grid.
 */
async function gridListParity(page: Page, _project: string) {
  const ids = Object.values(AGENTS)
  const lines = (sel: string) => page.evaluate(({ ids, sel }) => ids.map((id) => {
    const row = document.querySelector(`${sel}[data-term-id="${id}"]`)
    const line = row?.querySelector('[data-testid="card-attester-line"]') as HTMLElement | null
    return line ? `${line.dataset.state}: ${line.innerText.trim()}` : 'no row / no attester line'
  }), { ids, sel })

  const inList = await lines('[data-row="list"]')
  const names = await page.evaluate((ids) => ids.map((id) => {
    const p = document.querySelector(`[data-row="list"][data-term-id="${id}"] p`) as HTMLElement | null
    if (!p) return 'no row'
    const r = p.getBoundingClientRect()
    return p.scrollWidth <= p.clientWidth + 1 && r.left >= 0 && r.right <= window.innerWidth ? 'whole' : `cut: ${Math.round(r.width)} px wide, text ${p.scrollWidth} px`
  }), ids)
  expect(names, 'list rows show the whole name').toEqual(ids.map(() => 'whole'))

  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await expect(page.locator('[data-row="list"]')).toHaveCount(0)
  const inGrid = await lines('[data-card]')
  expect(inList, 'list row line = grid card line').toEqual(inGrid)
  for (const l of inList) expect(l, 'a read answer, not the loading state').not.toMatch(/^(loading|no row)/)
}

/**
 * The first card is on the first screen (Etap 4b-finish commit 5; 4b-list §6 #4): with the page
 * scrolled to the top, the first card's name ends above the fold — the viewport's bottom, or
 * the top of a fixed bar covering it (the phone's bottom nav).
 */
async function firstCardAboveFold(page: Page, _project: string) {
  const r = await page.evaluate(() => {
    window.scrollTo(0, 0)
    const card = document.querySelector('[data-card], [data-row="list"]')
    const name = card?.querySelector('h3, p')
    if (!card || !name) return null
    const bars = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el)
      const b = el.getBoundingClientRect()
      return cs.position === 'fixed' && b.height > 0 && b.height < 200 && b.bottom >= window.innerHeight - 1 && b.top > window.innerHeight / 2
    })
    const fold = Math.min(window.innerHeight, ...bars.map((el) => el.getBoundingClientRect().top))
    return { cardTop: Math.round(card.getBoundingClientRect().top), nameBottom: Math.round(name.getBoundingClientRect().bottom), fold: Math.round(fold) }
  })
  expect(r, 'a first card exists').not.toBeNull()
  expect(r!.cardTop, `first card starts on screen (fold at ${r!.fold} px)`).toBeGreaterThanOrEqual(0)
  expect(r!.nameBottom, `first card's name above the fold at ${r!.fold} px`).toBeLessThanOrEqual(r!.fold)
}

/** Origin tab counts are the header line's corpus totals (one source, lib/agent-list.ts corpusTotals). */
async function originTabsMatchHeader(page: Page, _project: string) {
  const header = await page.getByText(/\d+ AgentScore · \d+ ERC-8004/).first().innerText()
  const [, a, e] = header.match(/(\d+) AgentScore · (\d+) ERC-8004/)!
  const count = async (name: RegExp) => (await page.getByRole('tab', { name }).innerText()).match(/(\d+)\s*$/)?.[1]
  expect(await count(/^AgentScore/), 'AgentScore tab = header').toBe(a)
  expect(await count(/^ERC-8004/), 'ERC-8004 tab = header').toBe(e)
  expect(await count(/^All/), 'All tab = AgentScore + ERC-8004').toBe(String(Number(a) + Number(e)))
}

/**
 * The quality dropdown lists "All" and all six buckets, always; a bucket with no rows is
 * disabled and shows its 0 — never hidden.
 */
async function qualityDropdownListsEveryBucket(page: Page, _project: string) {
  const options = await page.getByRole('combobox', { name: 'Quality' }).locator('option').evaluateAll((els) =>
    els.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent ?? '', disabled: (o as HTMLOptionElement).disabled })))
  expect(options.map((o) => o.value)).toEqual(['all', 'excellent', 'good', 'moderate', 'low', 'critical', 'unrated'])
  for (const o of options) {
    const n = Number(o.text.match(/\((\d+)\)$/)?.[1])
    expect(Number.isInteger(n), `"${o.text}" shows its count`).toBe(true)
    expect(o.disabled, `"${o.text}" disabled exactly when empty`).toBe(o.value !== 'all' && n === 0)
  }
}
