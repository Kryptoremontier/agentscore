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
 * ERC-8004 cohort rows (row 0 = Captain Dackie, real id; the rest synthetic),
 * plus the reference attestations (see ATTESTATIONS).
 *
 * Needs a running app (production build recommended — dev-mode React is
 * several times slower and not what users get):
 *   npm run build && npx next start -p 3100
 * then:
 *   node tests/e2e/agents-fixture.js measure [rows=264] [cpuThrottle=1] [runs=5] [baseUrl]
 *   node tests/e2e/agents-fixture.js shots   [rows=264] [label=synthetic] [baseUrl]
 *   FIXTURE_FAIL=cohort|agents|both|attestations node tests/e2e/agents-fixture.js shots 264 <label>
 *     (forces those reads to fail — captures the header / card error states)
 * Shots go to screenshots/<date>/<label>/<viewport>/ (gitignored) — they are
 * FIXTURE renders, never evidence of live data.
 */
const { chromium } = require('@playwright/test')
const path = require('node:path')

const [, , MODE = 'measure', ...rest] = process.argv
const N = Number(rest[0] ?? 264)
const THROTTLE = MODE === 'measure' ? Number(rest[1] ?? 1) : 1
const RUNS = MODE === 'measure' ? Number(rest[2] ?? 5) : 1
const BASE = (MODE === 'measure' ? rest[3] : rest[2]) ?? 'http://localhost:3100'
// shots only: output folder under screenshots/<date>/ (e.g. synthetic-before, synthetic-after).
const LABEL = (MODE === 'shots' ? rest[1] : null) ?? 'synthetic'

// ── Fixture ──────────────────────────────────────────────────────────────────
// The three reference agents keep their REAL term ids so shots and assertions
// name real rows. Values are live where recorded: AgentScore stake/staker counts
// from /api/v1/agents (2026-09-24); Dackie 1 attester / 0.0099 tTRUST on
// Crypto (commit 5e898f4, live 2026-09-15). Luda's attestation stake (1e15) is
// the unit-test fixture value, not a recorded live number.
const REF = {
  dackie: '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb',
  luda: '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a',
  openclaw: '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d',
}
const BUCKET = {
  crypto: '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42',
  knowledge: '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4',
}
const W1 = '0x139219107C1eBE569f543C581b3B807Cf6740006'

const AS_ROWS = [
  [REF.openclaw, 'Agent: OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for Testing AgentScore.', '335061000000000000', 1],
  [null, 'Agent:INTU: Code Helper AI - First On-Chain with Full reputation and identity Helper AI for Coding systems.', '224900000000000000', 3],
  [null, 'AGI Tracker - AGI Tracker for AGI Models', '117600000000000000', 1],
  [null, 'AgentScore Sorting Agent', '99960000000000000', 2],
  [null, 'Agent: CodeBuddy - Suggest buddy for coding explanation.', '98980000000000000', 2],
  [null, 'Agent:INTU:Talaria', '49980000000000000', 1],
  [REF.luda, '{"@context":"https://schema.org","@type":"Thing","name":"Luda","description":"AI watch for ludarep"}', '980000000000000', 1],
  [null, 'Skill: On-Chain Data Analyzer - Reads and interprets blockchain transaction data.', '0', 1],
  [null, 'Agent: Agent Avatar Coder - Agent Avatar Coder from Kryptoremontier', '0', 1],
].map(([id, label, shares, count], i) => ({
  term_id: id ?? '0xa9e0' + (i + 1).toString(16).padStart(60, '0'),
  label, data: null, type: 'Thing', emoji: null,
  created_at: new Date(Date.UTC(2026, 1, 1 + i)).toISOString(),
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { count, sum: { shares } } },
  as_subject_triples: [],
}))

// Zero-padded after a fixed prefix — padding with a hex digit would collide ids.
// Row 0 is Captain Dackie (real id); the rest are synthetic.
const cohortId = (i) => (i === 0 ? REF.dackie : '0xc0de' + (i + 1).toString(16).padStart(60, '0'))
const COHORT = Array.from({ length: N }, (_, i) => ({
  created_at: new Date(Date.UTC(2026, 6, 1) + i * 60000).toISOString(),
  subject: { term_id: cohortId(i), label: i === 0 ? 'Captain Dackie' : `Cohort Agent ${String(i).padStart(3, '0')}` },
  object: { label: `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${1000 + i}` },
}))
const CLASSIFICATION = COHORT.flatMap((c, i) => [
  { subject_id: c.subject.term_id, object: { term_id: '0xt' + (i % 7), label: `skill_${i % 7}` } },
  { subject_id: c.subject.term_id, object: { term_id: '0xd' + (i % 5), label: `domain_${i % 5}` } },
])

// Attestation triples ([agent] — is skilled in — [bucket]) and their vault positions.
const ATTESTATIONS = [
  { term_id: '0xa77e57000000000000000000000000000000000000000000000000000000d4c1', counter_term_id: null,
    subject: { term_id: REF.dackie, label: 'Captain Dackie' }, object: { term_id: BUCKET.crypto },
    positions: [{ account_id: W1, shares: '9900000000000000' }] },
  { term_id: '0xa77e57000000000000000000000000000000000000000000000000000000d4c2', counter_term_id: null,
    subject: { term_id: REF.luda, label: 'Luda' }, object: { term_id: BUCKET.knowledge },
    positions: [{ account_id: W1, shares: '1000000000000000' }] },
]

// Positions on the AgentScore atom vaults: `count` wallets splitting the row's stake, so the
// live-staker count (lib/live-position.ts) matches the recorded one. Agent Avatar Coder and
// On-Chain Data Analyzer hold one 0-share row each, as live.
const AS_POSITIONS = AS_ROWS.flatMap((a) => {
  const n = a.positions_aggregate.aggregate.count
  const each = BigInt(a.positions_aggregate.aggregate.sum.shares) / BigInt(n)
  return Array.from({ length: n }, (_, k) => ({
    id: `${a.term_id}-1-${k}`, term_id: a.term_id, account_id: '0x' + (k + 1).toString(16).padStart(40, '0'), shares: String(each),
  }))
})
const ATTESTATION_POSITIONS = ATTESTATIONS.flatMap((a) => a.positions.map((p) => ({ id: `${a.term_id}-1-${p.account_id}`, term_id: a.term_id, ...p })))

// FIXTURE_FAIL=cohort|agents|both|attestations makes those reads fail (HTTP 500), to capture
// error states.
const FAIL = process.env.FIXTURE_FAIL ?? ''

// Answers like the endpoint where the app depends on it (lib/gql-pager.ts): $limit/$offset are
// honoured and `<table>_aggregate { aggregate { count } }` counts the same rows. Serves both the
// pre-pager queries (main before etap4b-tier: one request, no $limit) and the paged ones.
const pageOf = (rows, v) => (typeof v.limit === 'number' ? rows.slice(v.offset ?? 0, (v.offset ?? 0) + v.limit) : rows)
const counted = (table, rows) => ({ [`${table}_aggregate`]: { aggregate: { count: rows.length } } })

function answer(query, variables = {}) {
  const failCohort = FAIL === 'cohort' || FAIL === 'both'
  const failAgents = FAIL === 'agents' || FAIL === 'both'
  const failAttestations = FAIL === 'attestations'
  const isCount = (table) => query.includes(`${table}_aggregate`) && !query.includes(`${table}(`)
  if (query.includes('GetErc8004Cohort')) {
    if (failCohort) return null
    return isCount('triples') ? counted('triples', COHORT) : { triples: pageOf(COHORT, variables) }
  }
  if (query.includes('GetCohortClassification')) {
    // The chunk's subject ids are literals in the query string (lib/cohort-reader.ts).
    const rows = CLASSIFICATION.filter((c) => query.includes(c.subject_id))
    return isCount('triples') ? counted('triples', rows) : { triples: pageOf(rows, variables) }
  }
  if (query.includes('GetAttestationTriple')) {
    if (failAttestations) return null
    const subjects = variables.subjects ?? (variables.subject ? [variables.subject] : null)
    const rows = ATTESTATIONS.filter((a) => !subjects || subjects.includes(a.subject.term_id)).map(({ positions, ...t }) => t)
    return isCount('triples') ? counted('triples', rows) : { triples: pageOf(rows, variables) }
  }
  if (query.includes('GetAttestationPositions') || query.includes('VaultPositions')) {
    if (failAttestations && query.includes('GetAttestationPositions')) return null
    const ids = new Set(variables.vaultIds ?? [])
    const rows = [...ATTESTATION_POSITIONS, ...AS_POSITIONS].filter((p) => ids.has(p.term_id))
    return isCount('positions') ? counted('positions', rows) : { positions: pageOf(rows, variables) }
  }
  // AgentScore corpus: main asks for rows + count in one request; the pager asks separately.
  if (query.includes('atoms(') || query.includes('atoms_aggregate')) {
    if (failAgents) return null
    return { atoms: pageOf(AS_ROWS, variables), ...counted('atoms', AS_ROWS) }
  }
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
    // The landing badge's corpus total comes from /api/v1/agents (server-side read) —
    // answer it from the same fixture so the badge matches the rows.
    if (url.startsWith(BASE + '/api/v1/agents?limit=1')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], meta: { total: AS_ROWS.length, truncated: false } }) })
    }
    if (url.startsWith(BASE)) return route.continue()
    if (url.includes('/v1/graphql')) {
      // Cross-origin JSON POST → preflight; fulfilled responses need CORS headers.
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      let body = {}
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      const data = answer(body.query || '', body.variables || {})
      if (data === null) return route.fulfill({ status: 500, headers: cors, contentType: 'text/plain', body: 'fixture: forced failure' })
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ data }) })
    }
    return route.abort() // RPC, WalletConnect, analytics — not part of the page's render cost
  })
  return { ctx, page: await ctx.newPage() }
}

// One per grid card, full or compact, on main and on this branch.
const CARD = 'h3.font-bold.text-white.text-base'

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
    const cards = document.querySelectorAll('h3.font-bold.text-white.text-base').length
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

const LIST_READY = (p) => p.getByText(/^\d+( of \d+)? agents?$/)
  .or(p.getByText(/^Error:/))
  .or(p.getByText('No agents registered yet'))
  .first()

/**
 * opts.prep: steps after the page is ready; opts.modal: capture the modal at
 * full height; opts.fold: first viewport only (readable crops of huge lists);
 * opts.ready: custom readiness locator factory (default: /agents results line).
 */
// ONLY=name1,name2 re-captures just those shots.
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null

async function shot(browser, vp, name, url, opts = {}) {
  if (ONLY && !ONLY.has(name)) return
  const { ctx, page } = await newFixturePage(browser, { ...VIEWPORTS[vp], colorScheme: 'dark' })
  try {
    await page.goto(BASE + url)
    await (opts.ready ?? LIST_READY)(page).waitFor({ timeout: 60000 })
    if (opts.prep) await opts.prep(page)
    await page.waitForTimeout(2500)
    const file = path.join(__dirname, '../../screenshots', new Date().toISOString().slice(0, 10), LABEL, vp, `${name}.png`)
    if (opts.modal) {
      const m = page.locator('div.fixed.inset-0.overflow-y-auto').filter({ hasText: 'Atom ID:' }).first()
      await m.waitFor({ timeout: 30000 })
      await page.waitForTimeout(3000)
      await m.evaluate((el) => {
        Object.assign(el.style, { position: 'absolute', inset: 'auto', top: getComputedStyle(el).top, left: '0', width: '100%', height: 'auto', overflow: 'visible', backgroundAttachment: 'scroll' })
        document.body.style.overflow = ''
      })
      await m.screenshot({ path: file })
    } else {
      await page.screenshot({ path: file, fullPage: !opts.fold })
    }
    console.log('wrote', path.relative(path.join(__dirname, '../..'), file))
  } catch (e) {
    console.log(`skipped ${vp}/${name}: ${e.message.split('\n')[0]}`)
  } finally {
    await ctx.close()
  }
}

const clickIfPresent = (name) => async (p) => {
  const b = p.getByRole('button', { name, exact: true })
  if ((await b.count()) === 0) throw new Error(`no "${name}" filter on this build`)
  await b.first().click()
}

async function shots() {
  const browser = await chromium.launch()
  for (const vp of Object.keys(VIEWPORTS)) {
    await shot(browser, vp, 'agents-list-fold', '/agents', { fold: true })
    if (FAIL) continue // failure runs only need the header/fold state
    await shot(browser, vp, 'agents-list', '/agents')
    await shot(browser, vp, 'agents-list-erc8004', '/agents', { prep: (p) => p.locator('button[title^="Real agents from the ERC-8004"]').click() })
    await shot(browser, vp, 'agents-card-dackie', '/agents', {
      fold: true,
      prep: async (p) => {
        await p.locator('button[title^="Real agents from the ERC-8004"]').click()
        await p.locator('input[placeholder^="Search agents"]').fill('Dackie')
      },
    })
    await shot(browser, vp, 'agents-list-listview', '/agents', { fold: true, prep: (p) => p.getByRole('button', { name: 'List' }).click() })
    for (const bucket of ['Moderate', 'Low', 'Unrated']) {
      await shot(browser, vp, `agents-quality-${bucket.toLowerCase()}`, '/agents', { fold: true, prep: clickIfPresent(bucket) })
    }
    await shot(browser, vp, 'modal-dackie', `/agents?open=${REF.dackie}`, { modal: true })
    await shot(browser, vp, 'modal-luda', `/agents?open=${REF.luda}`, { modal: true })
    await shot(browser, vp, 'modal-openclaw', `/agents?open=${REF.openclaw}`, { modal: true })
    // "Agent Avatar Coder" shape: 1 position, 0 shares.
    await shot(browser, vp, 'modal-zero-stake-agentscore', `/agents?open=${AS_ROWS[8].term_id}`, { modal: true })
    await shot(browser, vp, 'landing', '/', { ready: (p) => p.getByText(/indexed$/).first() })
  }
  await browser.close()
}

;(MODE === 'shots' ? shots : measure)().catch((e) => { console.error(e); process.exit(1) })
