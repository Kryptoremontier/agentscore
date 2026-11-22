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
 * every 15 s (src/app/agents/agents-client.tsx), so the network is never idle there.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'node:path'
import { AGENTS, ROUTES } from './shots-routes'
import { installMockWallet, type MockWalletOptions } from './mock-wallet'

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
  /** Etap 8b: shoot at this viewport instead of the project's — desktop project only (e.g. laptop 1280). */
  viewport?: { width: number; height: number }
}

// Etap 8b: the landing's numbered sections, each shot on its own (desktop, phone, and laptop 1280).
const LANDING_SECTIONS = ['hero', 'how-it-works', 'trust-over-time', 'agents-ask-first', 'trust-contexts', 'closing'] as const
const LAPTOP = { width: 1280, height: 800 }

const SHOTS: Shot[] = [
  { name: 'landing', url: ROUTES.landing, prepare: landingReady, check: landingChecks },
  { name: 'landing-first-screen', url: ROUTES.landing, prepare: landingReady, firstScreen: true, check: landingFirstScreen },
  ...LANDING_SECTIONS.map((id): Shot => ({ name: `landing-section-${id}`, url: ROUTES.landing, prepare: landingReady, target: (page) => landingSection(page, id) })),
  { name: 'landing-laptop', url: ROUTES.landing, prepare: landingReady, viewport: LAPTOP, check: landingChecks },
  ...LANDING_SECTIONS.map((id): Shot => ({ name: `landing-laptop-section-${id}`, url: ROUTES.landing, prepare: landingReady, viewport: LAPTOP, target: (page) => landingSection(page, id) })),
  // Etap 7 Run B: "Check an agent" — the box, and one agent's card at its permalink.
  { name: 'check', url: ROUTES.check, prepare: async (page) => { await page.getByTestId('check-form').waitFor({ timeout: WAIT_CAP }) }, check: pageFitsViewport },
  { name: 'check-dackie', url: ROUTES.checkCard(AGENTS.dackie), prepare: checkCardReady, check: checkCardChecks },
  { name: 'check-luda', url: ROUTES.checkCard(AGENTS.luda), prepare: checkCardReady, check: checkCardChecks },
  // Etap 9b: the trust dialog with a harness wallet (tests/e2e/mock-wallet.ts — no key, signs nothing):
  // the default amount with the live fee, below the default with its warning, and the fee read failed.
  { name: 'trust-dialog-default', url: `${ROUTES.checkCard(AGENTS.luda)}?for=social`, prepare: (page) => openTrustDialog(page), target: trustDialog, check: trustDialogDefault },
  { name: 'trust-dialog-below-default', url: `${ROUTES.checkCard(AGENTS.luda)}?for=social`, prepare: async (page) => { await openTrustDialog(page); await belowDefault(page) }, target: trustDialog, check: trustDialogBelowDefault },
  { name: 'trust-dialog-fee-unread', url: `${ROUTES.checkCard(AGENTS.luda)}?for=social`, prepare: (page) => openTrustDialog(page, { feeReadFails: true }), target: trustDialog, check: trustDialogFeeUnread },
  // Etap 9c: "Your trust" — the harness wallet presents the owner's test wallet (read-only: it signs
  // nothing), which trusts Luda for Social. The block, the withdraw step with the contract's preview,
  // the preview read failed, and the block on Luda's profile.
  { name: 'your-trust-check-luda', url: ROUTES.checkCard(AGENTS.luda), prepare: (page) => showYourTrust(page, checkCardReady), target: yourTrustBlock, check: yourTrustRows },
  { name: 'your-trust-withdraw-preview', url: ROUTES.checkCard(AGENTS.luda), prepare: async (page) => { await showYourTrust(page, checkCardReady); await openWithdraw(page, 'ok') }, target: yourTrustBlock, check: withdrawPreviewRead },
  { name: 'your-trust-preview-failed', url: ROUTES.checkCard(AGENTS.luda), prepare: async (page) => { await showYourTrust(page, checkCardReady, { failSelectors: [PREVIEW_REDEEM] }); await openWithdraw(page, 'failed') }, target: yourTrustBlock, check: withdrawPreviewFailed },
  { name: 'your-trust-profile-luda', url: ROUTES.agentProfile(AGENTS.luda), prepare: (page) => showYourTrust(page, async (p) => { await p.getByRole('heading', { level: 1 }).first().waitFor({ timeout: WAIT_CAP }) }), target: yourTrustBlock, check: yourTrustRows },
  // Etap 9c: /admin/fees, with the harness wallet presenting the admin wallet (read-only: it signs nothing).
  { name: 'admin-fees', url: ROUTES.adminFees, prepare: (page) => showAdminFees(page), check: adminFeesChecks },
  { name: 'admin-fees-unread', url: ROUTES.adminFees, prepare: (page) => showAdminFees(page, { feeReadFails: true }), check: adminFeesUnread },
  // Etap 9: the builder's door — /check in builder mode, Luda's card opened from a trust link, and the README badge.
  { name: 'check-builder', url: ROUTES.checkBuilder, prepare: async (page) => { await page.getByTestId('check-builder-note').waitFor({ timeout: WAIT_CAP }) }, check: pageFitsViewport },
  { name: 'check-luda-builder', url: `${ROUTES.checkCard(AGENTS.luda)}?for=social#builder`, prepare: checkCardReady, check: builderDoorChecks },
  { name: 'check-luda-builder-block', url: `${ROUTES.checkCard(AGENTS.luda)}?for=social#builder`, prepare: checkCardReady, target: async (page) => page.getByTestId('builder-door') },
  { name: 'badge-luda', url: ROUTES.check, prepare: (page) => showBadge(page, ROUTES.badge(AGENTS.luda)), target: async (page) => page.getByTestId('shot-badge'), check: (page) => badgeSays(page, ROUTES.badge(AGENTS.luda), /^AgentScore · (Unverified|Established|Verified) · \d+ (person trusts it|people trust it) · as of \d{4}-\d\d-\d\d \d\d:\d\d UTC$/, 'public, max-age=300') },
  { name: 'badge-unknown-id', url: ROUTES.check, prepare: (page) => showBadge(page, ROUTES.badge('no-such-agent-anywhere')), target: async (page) => page.getByTestId('shot-badge'), check: (page) => badgeSays(page, ROUTES.badge('no-such-agent-anywhere'), /^AgentScore · not found$/, 'public, max-age=60') },
  // Etap 9c: the nav — Start (the three jobs) and a closed "More"; the phone's bottom nav (first screen).
  { name: 'nav', url: ROUTES.landing, prepare: navReady, target: navTarget, firstScreen: true, check: navWords },
  // Etap 9c: "More" opened — the sidebar's list (remembered across a reload), the phone's sheet.
  { name: 'nav-more-open', url: ROUTES.landing, prepare: async (page) => { await navReady(page); await openMore(page) }, target: navMoreTarget, firstScreen: true, check: navMoreOpen },
  // Etap 9: everything that left the nav — the footer group, on every page.
  { name: 'footer-more', url: ROUTES.check, prepare: async (page) => { await page.getByTestId('check-form').waitFor({ timeout: WAIT_CAP }) }, target: footerTarget },
  { name: 'agents-list', url: ROUTES.agents, prepare: agentsListReady, check: async (page) => { await mostVouchedFirst(page); await twoSections(page) } },
  // Etap 9: the second section opened — every agent is still one click away.
  { name: 'agents-list-untrusted-open', url: ROUTES.agents, prepare: async (page) => { await agentsListReady(page); await openUntrusted(page) }, check: untrustedOpened },
  // The first screen, as a visitor sees it: at 390×844 the first card must be on it.
  { name: 'agents-list-fold', url: ROUTES.agents, prepare: agentsListReady, firstScreen: true, check: firstCardAboveFold },
  {
    name: 'agents-list-erc8004',
    url: ROUTES.agents,
    prepare: async (page) => {
      await agentsListReady(page)
      const erc = page.getByRole('tab', { name: /^ERC-8004/ })
      await clickUntil(erc, () => expect(erc).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 }))
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
      await expect(page.getByRole('combobox', { name: 'Backing level' })).toHaveValue('unrated', { timeout: WAIT_CAP })
      await expect(page.getByTestId('results-line')).toContainText('Unrated', { timeout: WAIT_CAP })
    },
    check: qualityDropdownListsEveryBucket,
  },
  {
    name: 'agents-list-listview',
    url: ROUTES.agents,
    prepare: async (page) => {
      await agentsListReady(page)
      await openUntrusted(page) // OPEN CLAW: nobody trusts it yet, so its row is in the second section
      await clickUntil(page.getByRole('button', { name: 'List', exact: true }), () => expect(page.locator('[data-card]')).toHaveCount(0, { timeout: 2_000 }))
    },
    check: gridListParity,
  },
  ...(['dackie', 'luda', 'openclaw'] as const).map((key): Shot => ({
    name: `agent-modal-${key}`,
    url: `${ROUTES.agents}?open=${AGENTS[key]}`,
    prepare: modalReady,
    target: unfixModal,
    check: async (page, project) => {
      await oneAttestCta(page)
      await modalFitsPhone(page, project)
    },
  })),
  {
    // Etap 9: the list is short now (the second section is collapsed), so the footer is near. A card
    // opened with the page scrolled to its end: the modal covers the footer, never the other way round.
    name: 'agent-modal-over-footer',
    url: ROUTES.agents,
    prepare: async (page) => {
      await agentsListReady(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await clickUntil(page.locator('[data-term-id]').first(), () => expect(modalLocator(page)).toBeVisible({ timeout: 3_000 }))
      await modalReady(page)
    },
    firstScreen: true,
    check: modalCoversFooter,
  },
  {
    // Etap 5a: the modal as it opens, at normal scroll — its title clears the fixed site header
    // (the overlap in the full-height modal PNGs was a capture artifact; see unfixModal).
    name: 'agent-modal-dackie-first-screen',
    url: `${ROUTES.agents}?open=${AGENTS.dackie}`,
    prepare: modalReady,
    firstScreen: true,
    check: modalTitleClearsHeader,
  },
  {
    // Etap 5a: a newcomer clicks Attest with no wallet → the app's wallet-connect modal (never a
    // browser dialog). The first screen, as they see it.
    name: 'attest-disconnected-click',
    url: `${ROUTES.agents}?open=${AGENTS.luda}`,
    prepare: attestClickOpensConnectModal,
    firstScreen: true,
  },
  ...(['dackie', 'luda', 'openclaw'] as const).map((key): Shot => ({
    name: `agent-profile-${key}`,
    url: ROUTES.agentProfile(AGENTS[key]),
    prepare: profileReady,
    check: async (page, project) => {
      await oneAttestCta(page)
      await profileFitsPhone(page, project)
      await statRowMatchesModal(page, key)
    },
  })),
  // Etap 8b Run B: the overview (the landing's contexts grid, then what was there) and one context's ranked list.
  { name: 'domains', url: ROUTES.domains, prepare: domainsGridReady, check: domainsGridChecks },
  { name: 'domains-context-crypto-onchain', url: `${ROUTES.domains}?context=crypto-onchain`, prepare: contextRankingReady, check: contextRankingChecks },
  { name: 'evaluators', url: ROUTES.evaluators },
  { name: 'leaderboard', url: ROUTES.leaderboard },
  { name: 'claims', url: ROUTES.claims },
  { name: 'skills', url: ROUTES.skills },
  { name: 'intuforge', url: ROUTES.intuforge },
]

for (const shot of SHOTS) {
  test(shot.name, async ({ page }, testInfo) => {
    test.skip(!!shot.viewport && testInfo.project.name !== 'desktop', 'a fixed viewport: shot once, from the desktop project')
    if (shot.viewport) await page.setViewportSize(shot.viewport)
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
      else await page.screenshot({ path: file, fullPage: !shot.firstScreen })
    } else {
      await page.screenshot({ path: file, fullPage: !shot.firstScreen })
    }

    // A target may hide fixed chrome for its capture (unfixModal); put it back before the checks.
    await page.evaluate(() => (window as unknown as { __restoreShotChrome?: () => void }).__restoreShotChrome?.())

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
 * Etap 8a: the card a shared link previews as — the Open Graph image, from the same read as the
 * page, never cached (desktop run only: the image doesn't depend on the viewport).
 */
test('og-dackie', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one image, not per viewport')
  const res = await request.get(`${ROUTES.checkCard(AGENTS.dackie)}/og`, { timeout: 60_000 })
  const file = path.join(REPO_ROOT, 'screenshots', process.env.SHOTS_DATE!, testInfo.project.name, 'og-dackie.png')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, await res.body())
  testInfo.annotations.push({ type: 'screenshot', description: path.relative(REPO_ROOT, file) })
  expect(res.headers()['content-type']).toBe('image/png')
  expect(res.headers()['cache-control']).toBe('no-store')
})

/** The landing settled; on a phone, the More sheet is open (the nav's second level). */
async function navReady(page: Page) {
  await landingReady(page)
}

/** Desktop: the sidebar alone. Phone: the first screen (the bottom nav under the hero). */
async function navTarget(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 0) < 1024) throw new Error('phone: first screen')
  return page.locator('aside').first()
}

/**
 * Etap 9c: the nav — "Start": Check an agent · Trust an agent · For developers, then a closed
 * "More" (the sidebar) or a "More" tab (the phone). The footer group "More from AgentScore" stays,
 * and its links all go somewhere.
 */
const FOOTER_MORE_LINKS = [
  'How it works', 'Trust contexts', 'Skills', 'Claims', 'Evaluators', 'Leaderboard', 'IntuForge', 'Register an agent', 'Register a skill', 'Create claim',
]
const MORE_LINKS = ['Trust contexts', 'Skills', 'Claims', 'Evaluators', 'Leaderboard', 'IntuForge', 'Register an agent', 'Register a skill', 'Create claim']
async function navWords(page: Page, project: string) {
  const nav = project === 'mobile' ? page.locator('nav.fixed.bottom-0') : page.locator('aside').first()
  const links = (await nav.locator('a').allInnerTexts()).map((t) => t.trim()).filter((t) => !/^0x/.test(t))
  expect(links, 'the nav: three places, in order').toEqual(['Check an agent', 'Trust an agent', 'For developers'])
  for (const label of links) await expect(nav.getByText(label, { exact: true }).first(), label).toBeVisible()
  const moreButton = project === 'mobile' ? page.getByTestId('bottom-nav-more') : page.getByTestId('nav-more')
  await expect(moreButton, 'the "More" control').toBeVisible()
  await expect(moreButton).toHaveText('More')
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false')
  if (project !== 'mobile') await expect(nav.getByText('Start', { exact: true }), 'the "Start" group').toBeVisible()
  await expect(nav.getByText(/^Vouch$/), 'the old "Vouch"').toHaveCount(0)
  const more = page.getByTestId('footer-more')
  await expect(more.locator('h4')).toHaveText('More from AgentScore')
  const footerLinks = (await more.locator('a').allInnerTexts()).map((t) => t.trim())
  expect(footerLinks, 'the footer group').toEqual(FOOTER_MORE_LINKS)
  await expect(more.getByTestId('report-bug')).toHaveText('Report a bug')
  // The group is inside the page (no sideways scroll), each link a full tap target apart from the next.
  const box = await more.boundingBox()
  expect(box && box.x >= 0 && box.x + box.width <= (page.viewportSize()?.width ?? 0) + 1, 'the footer group fits the viewport').toBe(true)
}

async function openMore(page: Page) {
  const phone = (page.viewportSize()?.width ?? 0) < 768
  await clickUntil(page.getByTestId(phone ? 'bottom-nav-more' : 'nav-more'), () => expect(page.getByTestId(phone ? 'more-sheet' : 'nav-more-items')).toBeVisible({ timeout: 2_000 }))
  await page.waitForTimeout(ANIMATION_GRACE_MS) // the sheet slides up
}
async function navMoreTarget(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 0) < 1024) throw new Error('phone: first screen')
  return page.locator('aside').first()
}
/** "More" opened: the same list on both; the sidebar remembers it across a reload (this browser). */
async function navMoreOpen(page: Page, project: string) {
  if (project === 'mobile') {
    const sheet = page.getByTestId('more-sheet')
    expect((await sheet.locator('a').allInnerTexts()).map((t) => t.trim()), 'the sheet').toEqual(MORE_LINKS)
    const box = await sheet.boundingBox()
    expect(box && box.x >= 0 && box.x + box.width <= (page.viewportSize()?.width ?? 0) + 1, 'the sheet fits the viewport').toBe(true)
    return
  }
  const items = page.getByTestId('nav-more-items')
  expect((await items.locator('a').allInnerTexts()).map((t) => t.trim()), 'More, in order').toEqual(MORE_LINKS)
  await expect(page.getByTestId('nav-more')).toHaveAttribute('aria-expanded', 'true')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('nav-more-items'), 'remembered after a reload').toBeVisible({ timeout: WAIT_CAP })
}

/** The footer, scrolled to: where "More from AgentScore" lives. */
async function footerTarget(page: Page): Promise<Locator> {
  const footer = page.getByTestId('site-footer')
  await footer.scrollIntoViewIfNeeded()
  return footer
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
    .or(page.getByTestId('feed-unreachable'))
    .first()
    .waitFor({ timeout: WAIT_CAP })
  await expect(page.locator('[data-testid="card-attester-line"][data-state="loading"]')).toHaveCount(0, { timeout: WAIT_CAP })
}

/**
 * The landing is rendered on the server (Etap 8b): every section is in the HTML. Ready when all six
 * are there and the live parts answered one way or the other — the card, the gate and the contexts
 * each either show data (with its age) or say their read failed; nothing is left loading.
 */
async function landingReady(page: Page) {
  for (const id of LANDING_SECTIONS) await page.locator(`[data-section="${id}"]`).waitFor({ timeout: WAIT_CAP })
  for (const id of ['trust-over-time', 'gate-example', 'trust-contexts']) {
    await page.getByTestId(id).first().waitFor({ timeout: WAIT_CAP })
  }
}

/**
 * One landing section, with the fixed chrome (header, bottom nav, scroll-to-top) hidden for the
 * capture — an element shot otherwise shows the header over the section it scrolled to. The page's
 * background stays. Restored before the checks (__restoreShotChrome).
 */
async function landingSection(page: Page, id: string): Promise<Locator> {
  const section = page.locator(`[data-section="${id}"]`)
  await section.evaluate((el: HTMLElement) => {
    const hidden: HTMLElement[] = []
    for (const node of document.body.querySelectorAll<HTMLElement>('*')) {
      if (el.contains(node) || node.contains(el)) continue
      if (getComputedStyle(node).position !== 'fixed') continue
      if (node.getBoundingClientRect().height >= window.innerHeight - 1) continue // the page background layers
      node.setAttribute('data-shot-hidden', '')
      hidden.push(node)
    }
    const style = document.createElement('style')
    style.textContent = '[data-shot-hidden], [data-shot-hidden] * { visibility: hidden !important; transition: none !important; }'
    document.head.appendChild(style)
    ;(window as unknown as { __restoreShotChrome?: () => void }).__restoreShotChrome = () => {
      style.remove()
      for (const n of hidden) n.removeAttribute('data-shot-hidden')
    }
  })
  return section
}

/** Each section has its eyebrow; every live part shows its age or its honest error — never a bare card. */
async function landingChecks(page: Page) {
  await expect(page.getByTestId('story-eyebrow'), 'hero + 4 numbered eyebrows').toHaveCount(5)
  await expect(page.getByTestId('story-eyebrow').nth(1)).toHaveText(/01 \/ How it works/i)
  const card = page.getByTestId('trust-over-time').first()
  if ((await card.getAttribute('data-state')) == null) {
    await expect(card.getByTestId('data-age'), 'the card says how old its data is').toHaveText(/^Updated /)
    await expect(card.getByTestId('people-number')).toHaveText(/^\d+ (person trusts it|people trust it)$/)
    const events = Number(await card.getAttribute('data-events'))
    // Never a curve through fewer than 3 events.
    await expect(card.getByTestId('trust-curve')).toHaveCount(events >= 3 ? 1 : 0)
    await expect(card.getByTestId('trust-event')).toHaveCount(Math.min(events, 5))
  }
  const gate = page.getByTestId('gate-example')
  if ((await gate.getAttribute('data-state')) === 'ok') {
    await expect(gate.locator('pre'), 'the answer carries its age').toContainText('"dataAgeSeconds"')
    await expect(gate.locator('pre')).toContainText('should_i_trust({ agentId:')
  }
  if ((await page.getByTestId('trust-contexts').getAttribute('data-state')) === 'ok') {
    // Etap 9, honest emptiness: only the contexts someone trusts an agent for, then one line for the rest.
    const grid = page.getByTestId('context-grid')
    const shown = Number(await grid.getAttribute('data-shown'))
    const open = Number(await grid.getAttribute('data-open'))
    expect(shown + open, 'shown + open = all 8 trust contexts').toBe(8)
    await expect(page.getByTestId('context-tile'), 'one tile per context someone trusts an agent for').toHaveCount(shown)
    await expect(page.locator('[data-testid="context-tile"][data-people="0"]'), 'no empty tile on the landing').toHaveCount(0)
    if (open > 0) {
      await expect(page.getByTestId('contexts-open')).toHaveText(new RegExp(`^${open}( more)? trust contexts? (is|are) open\\. Be the first\\.$`))
      await expect(page.getByTestId('contexts-open').locator('a')).toHaveAttribute('href', '/domains')
    }
  }
  // Etap 9: the second door, under the hero's buttons.
  await expect(page.getByTestId('story-builder-door')).toHaveText('Built an agent? Get your trust link')
  await expect(page.getByTestId('story-builder-door')).toHaveAttribute('href', '/check?builder=1')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0)
}

/** Etap 8b: on a phone, the first screen shows the headline and the Check an agent button (above the bottom nav). */
async function landingFirstScreen(page: Page, project: string) {
  if (project !== 'mobile') return
  const parts = await page.evaluate(() => {
    window.scrollTo(0, 0)
    const nav = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null
    const floor = nav ? nav.getBoundingClientRect().top : window.innerHeight
    return ['story-headline', 'story-check'].map((id) => {
      const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
      return { id, fits: r.top >= 0 && r.bottom <= floor, bottom: Math.round(r.bottom), floor: Math.round(floor) }
    })
  })
  expect(parts.filter((p) => !p.fits), 'below the first screen').toEqual([])
}

// Etap 5b copy (lib/people-copy.ts), spelled out here so the harness checks the words a person reads.
const WHO_VOUCHES = 'Who trusts it, and for what'
const NOBODY_VOUCHES = 'Unverified — nobody trusts it yet'
const TIER_READ = /\d+ of \d+ people needed to verify|Verified/
/** The backing line once read: an amount and wallets, or nobody — never "Backed with — by —". */
const BACKING_READ = /^(Backed with \d|No tTRUST backing yet)/

/**
 * Modal is open and its own "—" loading placeholders resolved: the four
 * primary stat boxes and the backing line render "—" only while loading
 * (see the Etap 4b comments in src/app/agents/agents-client.tsx), and the "Who trusts it"
 * section left its skeleton — either its heading (≥1 person) or the empty
 * state (nobody trusts it, e.g. OPEN CLAW). Copy: lib/people-copy.ts (Etap 5b, 8a).
 */
async function modalReady(page: Page) {
  const modal = modalLocator(page)
  await modal.waitFor({ timeout: WAIT_CAP })
  await expect(modal.getByTestId('backers-line')).toHaveText(BACKING_READ, { timeout: WAIT_CAP })
  // The agent tier chip resolved: Unverified / Established with "1 of 3 people needed to verify", or
  // "Verified". "— of 3 people…" (loading) and "Tier unavailable" don't match.
  await expect(modal.getByTestId('agent-tier-chip').getByText(TIER_READ).first()).toBeVisible({ timeout: WAIT_CAP })
  // The four primary stat boxes print "—" only while their data loads.
  await expect(modal.locator('p.text-lg.font-bold.text-white', { hasText: /^—$/ })).toHaveCount(0, { timeout: WAIT_CAP })
  await expect(
    modal.getByText(WHO_VOUCHES, { exact: true })
      .or(modal.getByText(NOBODY_VOUCHES, { exact: true }))
      .first(),
  ).toBeVisible({ timeout: WAIT_CAP })
  await trustCardSettled(page)
}

/**
 * /agents/[id] resolved: the agent tier chip left its loading state, the
 * "Who trusts it" section rendered (heading or empty state) and the stat row answered. The reference agents all
 * exist — ERC-8004 ones included — so "Agent Not Found" is a failure here, not
 * a settled page.
 */
async function profileReady(page: Page) {
  await expect(page.getByText('Agent Not Found', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('agent-tier-chip').getByText(TIER_READ).first()).toBeVisible({ timeout: WAIT_CAP })
  await expect(
    page.getByText(WHO_VOUCHES, { exact: true })
      .or(page.getByText(NOBODY_VOUCHES, { exact: true }))
      .first(),
  ).toBeVisible({ timeout: WAIT_CAP })
  // The header's stat row (the modal's, Etap 5a) answered: no "—" box, a backing read.
  await expect(page.getByTestId('backers-line')).toHaveText(BACKING_READ, { timeout: WAIT_CAP })
  await expect(page.locator('[data-testid="stat-box"] p', { hasText: /^—$/ })).toHaveCount(0, { timeout: WAIT_CAP })
  await trustCardSettled(page)
}

/**
 * Etap 8b Run B: the agent's trust-over-time card left its loading box — the card (with its age, and
 * no curve under 3 events), "nobody trusts it yet", or its honest error.
 */
async function trustCardSettled(page: Page) {
  const card = page.getByTestId('trust-over-time').first()
  await card.waitFor({ timeout: WAIT_CAP })
  await expect(page.locator('[data-testid="trust-over-time"][data-state="loading"]')).toHaveCount(0, { timeout: WAIT_CAP })
  if ((await card.getAttribute('data-state')) == null) {
    await expect(card.getByTestId('data-age')).toHaveText(/^Updated /)
    const events = Number(await card.getAttribute('data-events'))
    await expect(card.getByTestId('trust-curve')).toHaveCount(events >= 3 ? 1 : 0)
  }
}

/** /domains: the server-rendered contexts grid is there, all 8 tiles (or its honest error). */
async function domainsGridReady(page: Page) {
  await page.getByTestId('trust-contexts').waitFor({ timeout: WAIT_CAP })
}
async function domainsGridChecks(page: Page) {
  if ((await page.getByTestId('trust-contexts').getAttribute('data-state')) === 'ok') {
    await expect(page.getByTestId('context-tile')).toHaveCount(8)
    await expect(page.locator('a[data-testid="context-tile"][href="/domains?context=crypto-onchain"]')).toHaveCount(1)
  }
  await pageFitsViewport(page)
}

/** /domains?context=…: the header and the list (or its empty / failed state) are there. */
async function contextRankingReady(page: Page) {
  await page.getByTestId('context-headline').waitFor({ timeout: WAIT_CAP })
  await page.getByTestId('context-ranking').waitFor({ timeout: WAIT_CAP })
}
async function contextRankingChecks(page: Page) {
  await expect(page.getByTestId('context-headline')).toHaveText(/Agents people trust for Crypto \/ Onchain\./)
  const state = await page.getByTestId('context-ranking').getAttribute('data-state')
  if (state !== 'failed') await expect(page.getByTestId('context-stats')).toHaveText(/^\d+ agents? · \d+ (person|people) · Updated /)
  if (state === 'ok') {
    const people = await page.getByTestId('context-agent').evaluateAll((rows) => rows.map((r) => Number((r.textContent ?? '').match(/(\d+) (person|people) trust/)?.[1] ?? 0)))
    expect(people, 'distinct people first').toEqual([...people].sort((a, b) => b - a))
  }
  await pageFitsViewport(page)
}

/**
 * Etap 5a: exactly one attest CTA in the DOM (not one visible and one hidden): inline in the
 * Attested section on desktop, the sticky bar on a phone — and it is visible.
 */
/** Etap 7 Run B: the /check card answered — who trusts it, the seals, how old the data is. */
async function checkCardReady(page: Page) {
  const card = page.getByTestId('check-result')
  await card.waitFor({ timeout: WAIT_CAP })
  await expect(card.getByTestId('check-people')).toHaveText(/trusts? it/i, { timeout: WAIT_CAP })
  await expect(card.getByTestId('check-age')).toHaveText(/^Updated /, { timeout: WAIT_CAP })
  // Etap 8b Run B: the compact trust-over-time card under it (server-rendered).
  await trustCardSettled(page)
}

/** Nothing on the page reaches past the viewport (no sideways scroll). */
async function pageFitsViewport(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page wider than the viewport').toBeLessThanOrEqual(0)
}

/** The card: one trust action, the share row, and it fits the viewport. */
async function checkCardChecks(page: Page) {
  await oneAttestCta(page)
  await expect(page.getByTestId('share-x'), 'Share on X').toBeVisible()
  // Etap 9: Backing is under a closed "Details" — one headline number on the card.
  await expect(page.getByTestId('check-details')).not.toHaveAttribute('open', /.*/)
  await expect(page.getByTestId('check-result').getByTestId('backing-score')).toBeHidden()
  await expect(page.getByTestId('builder-door')).toBeVisible()
  await pageFitsViewport(page)
}

/**
 * Etap 9, the builder's door: opened from a trust link (`?for=social`) the card says what the link
 * asks; the block hands out that link for the same context, the line about three people, and the
 * README badge — drawn, with both snippets.
 */
async function builderDoorChecks(page: Page) {
  await expect(page.getByTestId('trust-ask')).toHaveAttribute('data-context', 'social')
  const door = page.getByTestId('builder-door')
  await expect(door).toContainText('Built this agent? Get its trust link')
  await expect(door).toHaveAttribute('data-context', 'social')
  await expect(door.getByTestId('builder-link')).toHaveValue(new RegExp(`/check/${AGENTS.luda}\\?for=social$`))
  await expect(door.getByTestId('builder-send')).toHaveText('Send this to 3 people who have used it. Two people make it Established. Three make it Verified.')
  await expect(door.getByTestId('builder-context').locator('option')).toHaveCount(8)
  await expect(door.getByTestId('badge-markdown')).toHaveValue(/^\[!\[AgentScore\]\(https:\/\/[^)]+\/badge\/0x[0-9a-f]{64}\.svg\)\]\(https:\/\/[^)]+\/check\/0x[0-9a-f]{64}\)$/)
  await expect(door.getByTestId('badge-html')).toHaveValue(/^<a href="[^"]+"><img src="[^"]+\.svg" alt="AgentScore" height="20"><\/a>$/)
  const drawn = await door.getByTestId('badge-preview').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
  expect(drawn, 'the badge image loaded').toBe(true)
  // Picking another context changes the link; nothing else on the page claims who built the agent.
  await door.getByTestId('builder-context').selectOption('crypto-onchain')
  await expect(door.getByTestId('builder-link')).toHaveValue(/\?for=crypto-onchain$/)
  await expect(page.getByText(/owner verified|verified owner/i)).toHaveCount(0)
  await pageFitsViewport(page)
}

/**
 * Etap 9b: open the trust dialog on Luda's card from a trust link (?for=social), with the harness
 * wallet. The routes must be installed before the page loads: the test reloads after installing.
 */
async function openTrustDialog(page: Page, opts: { feeReadFails?: boolean } = {}) {
  await installMockWallet(page, opts)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await checkCardReady(page)
  const modal = page.getByTestId('connect-wallet-modal')
  await clickUntil(page.getByTestId('attest-cta').first(), () => expect(modal).toBeVisible({ timeout: 2_000 }))
  await modal.getByRole('button', { name: /Browser Wallet/ }).first().click()
  await (await trustDialog(page)).waitFor({ timeout: WAIT_CAP })
  await expect(page.getByTestId('trust-cost').or(page.getByTestId('fee-unread')).first()).toBeVisible({ timeout: 20_000 })
}
async function trustDialog(page: Page): Promise<Locator> {
  return page.locator('.glass-card').filter({ hasText: 'Trust Luda' }).first()
}
async function belowDefault(page: Page) {
  const before = await page.getByTestId('trust-cost-line').innerText()
  await page.getByTestId('trust-amount').fill('0.02')
  await expect(page.getByTestId('trust-cost-line')).not.toHaveText(before, { timeout: 20_000 })
}
/** The confirm button: "Trust it for <context>" (the dialog's only btn-primary). */
const signButton = (page: Page) => page.locator('.glass-card').filter({ hasText: 'Trust Luda' }).first().locator('button.btn-primary')

async function trustDialogDefault(page: Page) {
  await expect(page.getByTestId('trust-amount')).toHaveValue('0.04')
  // The fee is read live from the FeeProxy: whatever it is, the line is whole.
  const line = await page.getByTestId('trust-cost-line').innerText()
  expect(line, 'the cost line').toMatch(/^0\.04 tTRUST behind it · fee [\d.]+ tTRUST · total [\d.]+ tTRUST, plus gas$/)
  console.log(`trust dialog, default trust: ${line}`)
  await expect(page.getByTestId('trust-below-default')).toHaveCount(0)
  await expect(signButton(page)).toBeEnabled()
  await expect(signButton(page)).toHaveText(/Trust it for Social/)
}
async function trustDialogBelowDefault(page: Page) {
  await expect(page.getByTestId('trust-below-default')).toHaveText('Below 0.04, three people may not reach Verified.')
  await expect(page.getByTestId('trust-cost-line')).toHaveText(/^0\.02 tTRUST behind it · fee [\d.]+ tTRUST · total [\d.]+ tTRUST, plus gas$/)
  await expect(signButton(page)).toBeEnabled() // the person may still choose less
}
async function trustDialogFeeUnread(page: Page) {
  await expect(page.getByTestId('fee-unread')).toContainText('Can’t read the fee right now. Try again in a minute.')
  await expect(page.getByTestId('trust-cost')).toHaveCount(0) // no guessed fee on screen
  await expect(signButton(page)).toBeDisabled()
}

/**
 * Click until the page answers. `next dev` can take a while to hydrate in a slow container, and a
 * click before hydration does nothing (seen on main too, Etap 9c): click again until `answered`
 * holds, never more than WAIT_CAP. Only for clicks that are idempotent once answered.
 */
async function clickUntil(target: Locator, answered: () => Promise<void>) {
  await expect(async () => {
    await target.click({ timeout: 3_000 })
    await answered()
  }).toPass({ timeout: WAIT_CAP * 2 })
}

/** The owner's own test wallet (Etap 9c brief): it trusts Luda for Social. Public; no key here. */
const OWNER_TEST_WALLET = '0xCCA0592b0bf23C10aFc58f65d28eE8C0E78aA21C'
/** The FeeProxy admin wallet (lib/constants ADMIN_WALLET). Public; no key here. */
const ADMIN_WALLET = '0x139219107C1eBE569f543C581b3B807Cf6740006'
/** MultiVault previewRedeem(bytes32,uint256,uint256). */
const PREVIEW_REDEEM = '0x2db27075'

/** Connect the harness wallet from the top bar's "Connect Wallet". */
async function connectFromTopBar(page: Page) {
  const modal = page.getByTestId('connect-wallet-modal')
  const connected = page.getByTestId('wallet-button').first()
  // The whole step again if the wallet didn't take (a click in a modal still mounting is lost).
  await expect(async () => {
    if (await connected.isVisible()) return
    if (!(await modal.isVisible())) {
      await page.getByRole('button', { name: /Connect Wallet/ }).first().click({ timeout: 3_000 })
      await expect(modal).toBeVisible({ timeout: 3_000 })
    }
    await modal.getByRole('button', { name: /Browser Wallet/ }).first().click({ timeout: 3_000 })
    await expect(connected).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: WAIT_CAP * 3 })
}
async function showYourTrust(page: Page, ready: (page: Page) => Promise<void>, opts: Omit<MockWalletOptions, 'account'> = {}) {
  await installMockWallet(page, { account: OWNER_TEST_WALLET, ...opts })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await ready(page)
  await connectFromTopBar(page)
  await page.getByTestId('your-trust-row').first().waitFor({ timeout: 20_000 })
  await page.getByTestId('your-trust').scrollIntoViewIfNeeded()
}
async function yourTrustBlock(page: Page): Promise<Locator> {
  const block = page.getByTestId('your-trust').first()
  await block.waitFor({ timeout: WAIT_CAP }) // a miss: the page is shot instead, and the check says why
  return block
}
async function openWithdraw(page: Page, state: 'ok' | 'failed') {
  await page.getByTestId('your-trust-row').filter({ hasText: 'Social' }).getByTestId('withdraw-open').click()
  await expect(page.getByTestId('withdraw-preview')).toHaveAttribute('data-state', state, { timeout: 20_000 })
}
async function yourTrustRows(page: Page) {
  const block = page.getByTestId('your-trust')
  await expect(block.locator('p.eyebrow')).toHaveText('Your trust')
  await expect(page.getByTestId('your-trust-note')).toHaveText('Changed your mind? You can take your trust back at any time.')
  const social = page.getByTestId('your-trust-row').filter({ hasText: 'Social' })
  await expect(social).toHaveCount(1)
  await expect(social.getByTestId('your-trust-amount')).toHaveText(/^\d+\.\d+ tTRUST behind it$/)
  await expect(social.getByTestId('withdraw-open')).toHaveText('Withdraw')
  const text = await block.innerText()
  expect(text, 'no market words in the block').not.toMatch(/\bstake|\bsell|bonding curve/i)
  console.log(`your trust (${OWNER_TEST_WALLET} on Luda): ${(await social.innerText()).replace(/\s+/g, ' ')}`)
  await pageFitsViewport(page)
}
async function withdrawPreviewRead(page: Page) {
  await expect(page.getByTestId('withdraw-preview')).toHaveText(/^You get back \d+\.\d+ tTRUST, plus gas\.$/)
  await expect(page.getByTestId('withdraw-sign')).toBeEnabled()
  await expect(page.getByTestId('withdraw-sign')).toHaveText('Withdraw my trust for Social')
  console.log(`withdraw preview: ${await page.getByTestId('withdraw-preview').innerText()}`)
}
async function withdrawPreviewFailed(page: Page) {
  await expect(page.getByTestId('withdraw-preview')).toContainText('Can’t read what comes back right now.')
  await expect(page.getByTestId('withdraw-confirm')).not.toContainText('You get back')
  await expect(page.getByTestId('withdraw-sign')).toBeDisabled()
}

async function showAdminFees(page: Page, opts: Omit<MockWalletOptions, 'account'> = {}) {
  await installMockWallet(page, { account: ADMIN_WALLET, ...opts })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await connectFromTopBar(page)
  if (opts.feeReadFails) {
    await page.getByTestId('fees-unread').waitFor({ timeout: 20_000 })
    return
  }
  await page.getByTestId('fee-fixed').waitFor({ timeout: 20_000 })
  await page.getByTestId('fees-admin').first().waitFor({ timeout: 20_000 })
  await page.getByTestId('fee-input').fill('0')
  await expect(page.getByTestId('fee-sign')).toBeEnabled({ timeout: 20_000 }) // the on-chain admin check
}
async function adminFeesChecks(page: Page) {
  const fixed = await page.getByTestId('fee-fixed').innerText()
  expect(fixed, 'the fixed fee, read live').toMatch(/^\d+(\.\d+)? tTRUST$/)
  await expect(page.getByTestId('fee-percent')).toHaveText(/^\d+(\.\d+)?%$/)
  await expect(page.getByTestId('fees-admin')).toHaveCount(2)
  await expect(page.getByTestId('fees-admins')).toContainText(ADMIN_WALLET)
  await expect(page.getByTestId('fee-new')).toHaveText('0 tTRUST')
  await expect(page.getByTestId('fee-undo')).toContainText(`Undo: set it back to ${fixed}`)
  await expect(page.getByTestId('fee-calldata')).toContainText('data 0xf48371c0' + '0'.repeat(64))
  await expect(page.getByTestId('fee-sign')).toBeEnabled()
  console.log(`admin fees: fixed ${fixed}, ${await page.getByTestId('fee-percent').innerText()}; admins ${(await page.getByTestId('fees-admin').allInnerTexts()).join(' | ')}`)
  await pageFitsViewport(page)
}
async function adminFeesUnread(page: Page) {
  await expect(page.getByTestId('fees-unread')).toContainText('Can’t read the fee right now.')
  await expect(page.getByTestId('fee-fixed')).toHaveCount(0)
  await expect(page.getByTestId('fee-sign')).toBeDisabled()
}

/**
 * The badge as a README shows it: an <img>, drawn large on a plain ground (test-side only — the
 * harness shoots pages, and the badge is an image).
 */
async function showBadge(page: Page, src: string) {
  await page.getByTestId('check-form').waitFor({ timeout: WAIT_CAP })
  await page.evaluate((src) => {
    const box = document.createElement('div')
    box.setAttribute('data-testid', 'shot-badge')
    box.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;padding:24px;background:#0d1117;'
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    img.style.cssText = 'display:block;height:40px;max-width:calc(100vw - 48px);'
    box.appendChild(img)
    document.body.appendChild(box)
  }, src)
  await expect.poll(() => page.locator('[data-testid="shot-badge"] img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: WAIT_CAP }).toBe(true)
}

/** The badge route answers an SVG image whose words are its accessible name, with the cache it promises. */
async function badgeSays(page: Page, src: string, words: RegExp, cacheControl: string) {
  const res = await page.request.get(src)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/svg+xml; charset=utf-8')
  expect(res.headers()['cache-control']).toBe(cacheControl)
  const label = (await res.text()).match(/aria-label="([^"]*)"/)?.[1] ?? ''
  expect(label, 'the badge\'s words').toMatch(words)
}

/** No footer link or button is the top element anywhere on screen while the agent modal is open. */
async function modalCoversFooter(page: Page) {
  const onTop = await page.evaluate(() => {
    const footer = document.querySelector('[data-testid="site-footer"]')
    if (!footer) return ['no footer']
    return [...footer.querySelectorAll('a, button')].filter((el) => {
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.bottom <= 0 || b.top >= window.innerHeight) return false
      const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
      return top === el || el.contains(top)
    }).map((el) => (el.textContent ?? '').trim())
  })
  expect(onTop, 'footer links painted over the open modal').toEqual([])
}

/** Etap 9: open "Not trusted yet" if the list is in two sections and it is closed. */
async function openUntrusted(page: Page) {
  const toggle = page.getByTestId('agents-untrusted-toggle')
  if ((await toggle.count()) === 0) return
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await clickUntil(toggle, () => expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 }))
  }
}

/**
 * Etap 9: /agents in two sections — "People trust these (N)" with N cards, every one of them
 * trusted, then "Not trusted yet (M)" collapsed. The header's counts stay the full totals:
 * N + M = the results line's count.
 */
async function twoSections(page: Page) {
  const trusted = page.getByTestId('agents-trusted')
  if ((await trusted.count()) === 0) return // who trusts some row wasn't read: one list, no claim
  const n = Number(await trusted.getAttribute('data-count'))
  await expect(trusted.locator('h2')).toHaveText(`People trust these (${n})`)
  await expect(trusted.locator('[data-term-id]')).toHaveCount(n)
  const lines = await trusted.locator('[data-testid="card-attester-line"]').allInnerTexts()
  for (const l of lines) expect(l, 'a trusted card says who trusts it').toMatch(/trusts? it/)
  const untrusted = page.getByTestId('agents-untrusted')
  const m = (await untrusted.count()) ? Number(await untrusted.getAttribute('data-count')) : 0
  if (m > 0) {
    await expect(page.getByTestId('agents-untrusted-toggle')).toHaveText(`Not trusted yet (${m})`)
    await expect(page.getByTestId('agents-untrusted-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(untrusted.locator('[data-term-id]'), 'collapsed').toHaveCount(0)
  }
  const shown = Number((await page.getByTestId('results-line').innerText()).match(/^(\d+)/)?.[1])
  expect(n + m, 'the two sections are the whole list').toBe(shown)
  const total = Number(await page.getByTestId('agents-status').getAttribute('data-total'))
  expect(shown, 'the header keeps the full total').toBe(total)
  // The card's headline is the people: Backing sits in its Details row, not beside the name.
  const stray = await page.locator('[data-card="full"]').evaluateAll((cards) => cards.filter((c) => {
    const b = c.querySelector('[data-testid="backing-score"]')
    return !!b && !b.closest('[data-testid="card-details"]')
  }).length)
  expect(stray, 'a backing score outside a card\'s Details row').toBe(0)
}

/** The second section, opened: its rows are there, none of them trusted. */
async function untrustedOpened(page: Page) {
  const untrusted = page.getByTestId('agents-untrusted')
  if ((await untrusted.count()) === 0) return
  const m = Number(await untrusted.getAttribute('data-count'))
  await expect(untrusted.locator('[data-term-id]')).toHaveCount(Math.min(m, 48))
  const lines = await untrusted.locator('[data-testid="card-attester-line"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state))
  expect(lines.every((s) => s === 'none'), 'every row there: nobody trusts it yet').toBe(true)
}

async function oneAttestCta(page: Page) {
  const ctas = page.locator('[data-testid="attest-cta"]')
  await expect(ctas, 'attest CTAs in the DOM').toHaveCount(1)
  await expect(ctas.first(), 'the one attest CTA is visible').toBeVisible()
}

/**
 * Etap 5a: the profile tells the modal's story — its stat row (attesters, domains, tTRUST attested,
 * reports) and Backers line read exactly as the /agents modal's for the same agent. Runs on the
 * profile, then opens the modal in the same page.
 */
async function statRowMatchesModal(page: Page, key: keyof typeof AGENTS) {
  const rowOf = async (root: Locator) => {
    await expect(root.getByTestId('backers-line')).toHaveText(BACKING_READ, { timeout: WAIT_CAP })
    await expect(root.locator('[data-testid="stat-box"] p', { hasText: /^—$/ })).toHaveCount(0, { timeout: WAIT_CAP })
    const boxes = (await root.getByTestId('stat-box').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
    return { boxes, backers: (await root.getByTestId('backers-line').innerText()).trim() }
  }
  const profile = await rowOf(page.getByTestId('stat-row'))
  await page.goto(`${ROUTES.agents}?open=${AGENTS[key]}`, { waitUntil: 'domcontentloaded' })
  await modalReady(page)
  const modal = await rowOf(modalLocator(page).getByTestId('stat-row'))
  expect(profile, `${key}: the profile's stat row = the modal's`).toEqual(modal)
}

/**
 * Etap 5b: the list opens on "Most trusted" (`?sort=vouched`) — people first. The first cards are the
 * agents people trust, most people first; the top five are logged for the report.
 */
async function mostVouchedFirst(page: Page) {
  await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('vouched')
  const top = await page.locator('[data-term-id]').evaluateAll((cards) => cards.slice(0, 5).map((c) => ({
    name: (c.querySelector('h3, p.font-semibold') as HTMLElement | null)?.innerText.trim() ?? '',
    line: (c.querySelector('[data-testid="card-attester-line"]') as HTMLElement | null)?.innerText.trim() ?? '',
  })))
  console.log(`most trusted, top 5: ${JSON.stringify(top)}`)
  // Whoever people trust comes before anyone nobody trusts.
  const trusted = top.map((t) => /trusts? it for /.test(t.line))
  expect(trusted.indexOf(false) === -1 || !trusted.slice(trusted.indexOf(false)).includes(true), 'a trusted agent after an untrusted one').toBe(true)
}

/** Wallet disconnected: the visible Attest CTA opens the connect modal; no native dialog fires. */
async function attestClickOpensConnectModal(page: Page) {
  await modalReady(page)
  const dialogs: string[] = []
  page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss() })
  await page.locator('[data-testid="attest-cta"]').filter({ visible: true }).first().click()
  await expect(page.getByTestId('connect-wallet-modal')).toBeVisible({ timeout: WAIT_CAP })
  await expect(page.getByTestId('connect-wallet-modal')).toContainText('Connect a wallet to trust Luda.')
  expect(dialogs, 'no native browser dialog').toEqual([])
}

function modalLocator(page: Page) {
  return page.locator('div.fixed.inset-0.overflow-y-auto').filter({ has: page.getByTestId('agent-details') }).first()
}

/**
 * The modal is a fixed, internally-scrolling overlay — a page screenshot only
 * gets its first screen. Un-fix it (test-side styling only) so the element
 * screenshot has the modal's full height.
 *
 * Fixed chrome outside the modal (site header, bottom nav, the attest sticky bar) is hidden for
 * this capture and restored after it (window.__restoreShotChrome): Playwright scrolls a tall
 * element to the viewport top, where the fixed header painted over the modal's first 80 px — the
 * "header over the modal title" in earlier PNGs was that, not the page (Etap 5a; at normal scroll
 * the modal's scroll container starts below the header — modalTitleClearsHeader).
 */
async function unfixModal(page: Page): Promise<Locator> {
  const modal = modalLocator(page)
  if ((await modal.count()) === 0) throw new Error('modal not open')
  await modal.evaluate((el: HTMLElement) => {
    const hidden: HTMLElement[] = []
    for (const node of document.body.querySelectorAll<HTMLElement>('*')) {
      if (el.contains(node) || node.contains(el)) continue
      const pos = getComputedStyle(node).position
      if (pos === 'fixed' || pos === 'sticky') {
        node.setAttribute('data-shot-hidden', '')
        hidden.push(node)
      }
    }
    // !important on the element AND its descendants, transitions off: `transition-all` (the navbar,
    // the sticky bar's button) would otherwise keep them visible through the capture.
    const style = document.createElement('style')
    style.textContent = '[data-shot-hidden], [data-shot-hidden] * { visibility: hidden !important; transition: none !important; }'
    document.head.appendChild(style)
    ;(window as unknown as { __restoreShotChrome?: () => void }).__restoreShotChrome = () => {
      style.remove()
      for (const n of hidden) n.removeAttribute('data-shot-hidden')
    }
  })
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
 * Etap 5a: at normal scroll the open modal's title sits below the fixed site header — nothing of
 * the header covers it.
 */
async function modalTitleClearsHeader(page: Page) {
  const title = modalLocator(page).locator('h2, h3').first()
  const titleBox = (await title.boundingBox())!
  const headerBottom = await page.evaluate(() => {
    const nav = [...document.querySelectorAll<HTMLElement>('nav')].find((n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().top <= 0)
    return nav ? nav.getBoundingClientRect().bottom : 0
  })
  expect(titleBox.y, `modal title (top ${Math.round(titleBox.y)} px) below the header (bottom ${Math.round(headerBottom)} px)`).toBeGreaterThanOrEqual(headerBottom)
}

/**
 * Etap 5a, phones: inside the ATTESTED section no text overlaps other text (the domain icon ran
 * into the attester count: "⛓1attester"), and every domain name shows — not truncated to nothing.
 */
async function attestedTextNoOverlap(scope: Locator) {
  const section = scope.getByTestId('attested-section')
  if ((await section.count()) === 0) return // no attestations: the empty state
  const problems = await section.first().evaluate((root) => {
    const boxes: Array<{ t: string; r: DOMRect }> = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim()
      if (!text) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) boxes.push({ t: text.slice(0, 24), r })
    }
    const out: string[] = []
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ox > 1 && oy > 1) out.push(`"${boxes[i].t}" overlaps "${boxes[j].t}"`)
      }
    }
    for (const row of root.querySelectorAll('[data-testid="attested-row"]')) {
      const name = row.querySelector<HTMLElement>('span.font-semibold')
      if (!name || name.getBoundingClientRect().width < 20 || name.scrollWidth > name.clientWidth + 1) out.push(`domain name cut: "${name?.textContent ?? ''}"`)
    }
    return out.slice(0, 8)
  })
  expect(problems, 'ATTESTED section: overlapping or cut text').toEqual([])
}

/** Etap 5a, phones: the profile never scrolls sideways, nothing in it reaches past the viewport, ATTESTED reads clean. */
async function profileFitsPhone(page: Page, project: string) {
  if (project !== 'mobile') return
  const width = page.viewportSize()!.width
  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the page scrolls sideways').toBeLessThanOrEqual(width)
  // Past the edge AND visible: overflow a clipping ancestor hides (the footer's decorative glow) is not seen.
  const visiblyPast = await page.evaluate(() => {
    const w = window.innerWidth
    const past = (r: DOMRect) => r.width > 0 && (r.left < -0.5 || r.right > w + 0.5)
    const clipped = (el: Element) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX
        if ((ox === 'hidden' || ox === 'clip') && !past(a.getBoundingClientRect())) return true
      }
      return false
    }
    const out: string[] = []
    for (const node of document.body.querySelectorAll('*')) {
      const r = node.getBoundingClientRect()
      if (!past(r) || clipped(node)) continue
      const p = node.parentElement
      if (p && past(p.getBoundingClientRect()) && !clipped(p)) continue
      out.push(`<${node.tagName.toLowerCase()}> ${Math.round(r.left)}..${Math.round(r.right)} px "${(node.textContent ?? '').trim().slice(0, 40)}"`)
    }
    return out.slice(0, 8)
  })
  expect(visiblyPast, `elements past the ${width} px viewport`).toEqual([])
  await attestedTextNoOverlap(page.locator('main'))
}

/**
 * Phones only (4b-list §6 #1, #5): every modal tab is on screen, at least 44 px tall and
 * clickable (clicking selects it), and on every tab no element reaches past the viewport.
 */
async function modalFitsPhone(page: Page, project: string) {
  if (project !== 'mobile') return
  const modal = modalLocator(page)
  await attestedTextNoOverlap(modal)
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

/**
 * Origin tab counts are the status line's corpus totals (one source, lib/agent-list.ts corpusTotals).
 * Etap 6: the line prints the total ("272 agents, live"); its per-origin counts ride on data-*.
 */
async function originTabsMatchHeader(page: Page, _project: string) {
  const status = page.getByTestId('agents-status')
  const a = await status.getAttribute('data-agentscore')
  const e = await status.getAttribute('data-erc8004')
  expect(await status.getAttribute('data-total'), 'status line total = AgentScore + ERC-8004').toBe(String(Number(a) + Number(e)))
  expect(await status.innerText()).toMatch(new RegExp(`^${Number(a) + Number(e)} agents, `))
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
  const options = await page.getByRole('combobox', { name: 'Backing level' }).locator('option').evaluateAll((els) =>
    els.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent ?? '', disabled: (o as HTMLOptionElement).disabled })))
  expect(options.map((o) => o.value)).toEqual(['all', 'excellent', 'good', 'moderate', 'low', 'critical', 'unrated'])
  for (const o of options) {
    const n = Number(o.text.match(/\((\d+)\)$/)?.[1])
    expect(Number.isInteger(n), `"${o.text}" shows its count`).toBe(true)
    expect(o.disabled, `"${o.text}" disabled exactly when empty`).toBe(o.value !== 'all' && n === 0)
  }
}
