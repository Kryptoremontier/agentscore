/**
 * /agents fixture tool — render-cost measurement + synthetic screenshots.
 * Test-only; not part of `npm test` or `npm run shots`. Produced the numbers
 * in docs/audit/4b-list-findings.md §5.
 *
 * Serves the page's browser-side Hasura calls from a synthetic fixture
 * (page.route) and aborts every other external request, so what's measured is
 * the app's own render cost at a chosen cohort size — independent of live
 * testnet data volume or latency. Fixture shape: the 9 live AgentScore rows
 * (stake/staker counts as returned by /api/v1/agents on 2026-09-24) + N
 * synthetic ERC-8004 cohort rows.
 *
 * Needs a running app (production build recommended — dev-mode React is
 * several times slower and not what users get):
 *   npm run build && npx next start -p 3100
 * then:
 *   node tests/e2e/agents-fixture.js measure [rows=264] [cpuThrottle=1] [runs=5] [baseUrl]
 *   node tests/e2e/agents-fixture.js shots   [rows=264] [baseUrl]
 * Shots go to screenshots/<date>/synthetic/<viewport>/ (gitignored) — they are
 * FIXTURE renders, never evidence of live data.
 */
const { chromium } = require('@playwright/test')
const path = require('node:path')

const [, , MODE = 'measure', ...rest] = process.argv
const N = Number(rest[0] ?? 264)
const THROTTLE = MODE === 'measure' ? Number(rest[1] ?? 1) : 1
const RUNS = MODE === 'measure' ? Number(rest[2] ?? 5) : 1
const BASE = (MODE === 'measure' ? rest[3] : rest[1]) ?? 'http://localhost:3100'

// ── Fixture ──────────────────────────────────────────────────────────────────
const AS_ROWS = [
  ['OPEN CLAW', '335061000000000000', 1], ['Code Helper AI', '224900000000000000', 3],
  ['AGI Tracker', '117600000000000000', 1], ['AgentScore Sorting Agent', '99960000000000000', 2],
  ['CodeBuddy', '98980000000000000', 2], ['Talaria', '49980000000000000', 1],
  ['Luda', '980000000000000', 1], ['On-Chain Data Analyzer', '0', 1], ['Agent Avatar Coder', '0', 1],
].map(([name, shares, count], i) => ({
  term_id: '0xa9e0' + (i + 1).toString(16).padStart(60, '0'),
  label: `Agent: ${name}`, data: null, type: 'Thing', emoji: null,
  created_at: new Date(Date.UTC(2026, 1, 1 + i)).toISOString(),
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { count, sum: { shares } } },
  as_subject_triples: [],
}))

// Zero-padded after a fixed prefix — padding with a hex digit would collide ids.
const cohortId = (i) => '0xc0de' + (i + 1).toString(16).padStart(60, '0')
const COHORT = Array.from({ length: N }, (_, i) => ({
  created_at: new Date(Date.UTC(2026, 6, 1) + i * 60000).toISOString(),
  subject: { term_id: cohortId(i), label: `Cohort Agent ${String(i).padStart(3, '0')}` },
  object: { label: `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${1000 + i}` },
}))
const CLASSIFICATION = COHORT.flatMap((c, i) => [
  { subject_id: c.subject.term_id, object: { term_id: '0xt' + (i % 7), label: `skill_${i % 7}` } },
  { subject_id: c.subject.term_id, object: { term_id: '0xd' + (i % 5), label: `domain_${i % 5}` } },
])

function answer(query) {
  if (query.includes('GetErc8004CohortCount')) return { triples_aggregate: { aggregate: { count: N } } }
  if (query.includes('GetErc8004Cohort')) return { triples: COHORT }
  if (query.includes('GetCohortClassification')) return { triples: CLASSIFICATION }
  if (query.includes('atoms(')) return { atoms: AS_ROWS }
  if (query.includes('positions_aggregate')) return { positions_aggregate: { aggregate: { count: 0, sum: { shares: null } } } }
  if (query.includes('positions(')) return { positions: [] }
  if (query.includes('signals')) return { signals: [], signals_aggregate: { aggregate: { count: 0 } } }
  if (query.includes('triples')) return { triples: [], triples_aggregate: { aggregate: { count: 0 } } }
  return {}
}

async function newFixturePage(browser, contextOptions) {
  const ctx = await browser.newContext(contextOptions)
  await ctx.route('**/*', (route) => {
    const req = route.request()
    const url = req.url()
    if (url.startsWith(BASE)) return route.continue()
    if (url.includes('/v1/graphql')) {
      // Cross-origin JSON POST → preflight; fulfilled responses need CORS headers.
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      let q = ''
      try { q = JSON.parse(req.postData() || '{}').query || '' } catch {}
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ data: answer(q) }) })
    }
    return route.abort() // RPC, WalletConnect, analytics — not part of the page's render cost
  })
  return { ctx, page: await ctx.newPage() }
}

const CARD = 'div.rounded-2xl.p-5.cursor-pointer'

// ── measure ──────────────────────────────────────────────────────────────────
async function measureOnce() {
  const browser = await chromium.launch()
  const { ctx, page } = await newFixturePage(browser, { viewport: { width: 1440, height: 900 } })
  await page.addInitScript(() => {
    window.__lt = []; window.__ev = []
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]) })
      .observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push([e.name, e.startTime, e.duration]) })
      .observe({ type: 'event', buffered: true, durationThreshold: 16 })
  })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })

  const total = N + AS_ROWS.length
  await page.goto(BASE + '/agents', { waitUntil: 'commit' })
  // listMs: navigation start → all `total` cards in the DOM.
  const listMs = await page.waitForFunction((total) => {
    const cards = document.querySelectorAll('div.rounded-2xl.p-5.cursor-pointer').length
    return cards >= total ? performance.now() : false
  }, total, { timeout: 120000, polling: 16 }).then((h) => h.jsonValue())
  await page.waitForTimeout(6000) // quiet window for the TTI heuristic
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    return { dcl: n.domContentLoadedEventEnd, fcp: fcp ? fcp.startTime : null, nodes: document.querySelectorAll('*').length,
      heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, lt: window.__lt }
  })
  // TTI (Lighthouse-style heuristic): the later of list-rendered, DCL, and the end of
  // the last long task (≥50ms) before a ≥5s quiet window. TBT: Σ(longtask − 50ms) FCP→TTI.
  const lastLongEnd = nav.lt.reduce((m, [s, d]) => Math.max(m, s + d), 0)
  const tti = Math.max(listMs, nav.dcl, lastLongEnd)
  const tbt = nav.lt.filter(([s]) => s >= (nav.fcp ?? 0) && s < tti).reduce((a, [, d]) => a + Math.max(0, d - 50), 0)

  // Interaction latency — Event Timing duration = input delay + handlers + render to next paint.
  const eventMax = async (fn, settleMs = 1500) => {
    await page.evaluate(() => { window.__ev = [] })
    await fn()
    await page.waitForTimeout(settleMs)
    return page.evaluate(() => window.__ev
      .filter(([n]) => ['click', 'pointerdown', 'pointerup', 'keydown', 'keypress', 'keyup', 'input'].includes(n))
      .reduce((m, [, , d]) => Math.max(m, d), 0))
  }
  const search = page.locator('input[placeholder^="Search agents"]')
  const originClick = await eventMax(() => page.locator('button[title^="Real agents from the ERC-8004"]').click())
  const allClick = await eventMax(() => page.locator('button[title="All agents"]').click())
  const searchKey = await eventMax(() => search.press('C'))
  await search.fill('')
  await page.waitForTimeout(1500)
  const openModal = await eventMax(() => page.locator(CARD).first().click(), 3000)
  // A modal-only state change: still re-renders the whole list behind the modal.
  const accordion = await eventMax(() => page.getByText('Back this agent', { exact: false }).first().click())
  await browser.close()
  return { listMs, tti, tbt, longTasks: nav.lt.length, nodes: nav.nodes, heapMB: nav.heapMB, originClick, allClick, searchKey, openModal, accordion }
}

async function measure() {
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await measureOnce())
  const keys = Object.keys(runs[0])
  const median = (k) => {
    const v = runs.map((r) => r[k]).filter((x) => x != null).sort((a, b) => a - b)
    return v.length ? Math.round(v[Math.floor(v.length / 2)]) : null
  }
  console.log(JSON.stringify({
    rows: N, merged: N + AS_ROWS.length, cpu: `${THROTTLE}x`, runs: RUNS,
    median: Object.fromEntries(keys.map((k) => [k, median(k)])),
    raw: runs.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] == null ? null : Math.round(r[k])]))),
  }))
}

// ── shots ────────────────────────────────────────────────────────────────────
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}

async function shot(browser, vp, name, url, prep, modal) {
  const { ctx, page } = await newFixturePage(browser, { ...VIEWPORTS[vp], colorScheme: 'dark' })
  await page.goto(BASE + url)
  await page.getByText(/^\d+( of \d+)? agents?/).first().waitFor({ timeout: 60000 })
  if (prep) await prep(page)
  await page.waitForTimeout(2500)
  const file = path.join(__dirname, '../../screenshots', new Date().toISOString().slice(0, 10), 'synthetic', vp, `${name}.png`)
  if (modal) {
    const m = page.locator('div.fixed.inset-0.overflow-y-auto').filter({ hasText: 'Atom ID:' }).first()
    await m.waitFor({ timeout: 30000 })
    await page.waitForTimeout(3000)
    await m.evaluate((el) => {
      Object.assign(el.style, { position: 'absolute', inset: 'auto', top: getComputedStyle(el).top, left: '0', width: '100%', height: 'auto', overflow: 'visible', backgroundAttachment: 'scroll' })
      document.body.style.overflow = ''
    })
    await m.screenshot({ path: file })
  } else {
    await page.screenshot({ path: file, fullPage: true })
  }
  console.log('wrote', path.relative(path.join(__dirname, '../..'), file))
  await ctx.close()
}

async function shots() {
  const browser = await chromium.launch()
  for (const vp of Object.keys(VIEWPORTS)) {
    await shot(browser, vp, 'agents-list', '/agents')
    await shot(browser, vp, 'agents-list-erc8004', '/agents', (p) => p.locator('button[title^="Real agents from the ERC-8004"]').click())
    await shot(browser, vp, 'agents-list-listview', '/agents', (p) => p.getByRole('button', { name: 'List' }).click())
    await shot(browser, vp, 'agents-quality-moderate', '/agents', (p) => p.getByRole('button', { name: 'Moderate' }).click())
    await shot(browser, vp, 'agents-quality-low', '/agents', (p) => p.getByRole('button', { name: 'Low' }).click())
    // "Agent Avatar Coder" shape: 1 position, 0 shares.
    await shot(browser, vp, 'modal-zero-stake-agentscore', `/agents?open=${AS_ROWS[8].term_id}`, null, true)
    await shot(browser, vp, 'modal-cohort', `/agents?open=${cohortId(0)}`, null, true)
  }
  await browser.close()
}

;(MODE === 'shots' ? shots : measure)().catch((e) => { console.error(e); process.exit(1) })
