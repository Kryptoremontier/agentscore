/**
 * Etap 7a commit 3 — the /agents list is in the first HTML. The page was one client component that
 * fetched the list only after its JS had loaded and run (mobile, warm cache: the first card at
 * ~4 s). Now a server page reads the same cached answer as /api/v1/agents/page and hands it to the
 * client component, which renders it at once and keeps everything interactive.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const page = code('app/agents/page.tsx')
const client = code('app/agents/agents-client.tsx')

describe('the server page', () => {
  it('is a server component that reads the cached list (no "use client", the same reader as the API)', () => {
    expect(page).not.toMatch(/['"]use client['"]/)
    expect(page).toMatch(/import \{ getAgentsPageData \} from '@\/lib\/agents-page-data'/)
    expect(code('app/api/v1/agents/page/route.ts')).toMatch(/getAgentsPageData\(\)/)
    expect(page).toMatch(/export const dynamic = 'force-dynamic'/)
  })

  it('streams: the read sits inside Suspense with the skeleton — a cold cache sends the frame first', () => {
    expect(page).toMatch(/<Suspense fallback=\{<AgentsPageSkeleton \/>\}>\s*<AgentsWithList \/>\s*<\/Suspense>/)
    expect(page).toMatch(/async function AgentsWithList\(\)/)
  })

  it('hands the answer over encoded as the API sends it, with the render instant; a failure → no initial list', () => {
    expect(page).toMatch(/await getAgentsPageData\(\)\.catch\(\(\) => null\)/)
    expect(page).toMatch(/initial=\{payload \? \{ payload: encodeForCache\(payload\), renderedAt: Date\.now\(\) \} : null\}/)
  })
})

describe('the client component', () => {
  it('derives its first state from the server answer by the same rule as every reload (listStateOf)', () => {
    expect(client).toMatch(/export function AgentsPageClient\(\{ initial \}: \{ initial: AgentsInitialList \| null \}\)/)
    expect(client).toMatch(/initial \? agentsPageView\(decodeFromCache<AgentsPagePayload>\(initial\.payload\)\) : null/)
    expect(client).toMatch(/const \[init\] = useState\(\(\) => \(initialView \? listStateOf\(initialView\) : null\)\)/)
    expect(client).toMatch(/const next = listStateOf\(view\)/)
    expect(client).toMatch(/const \[loading, setLoading\] = useState\(!init\)/)
    expect(client).toMatch(/const \[pageView, setPageView\] = useState<AgentsPageView \| null>\(initialView\)/)
  })

  it('reads the API only when the server had no list (no second read of the same answer)', () => {
    expect(client).toMatch(/useEffect\(\(\) => \{\s*if \(init\) return\s*let cancelled = false\s*loadPage\(\(\) => cancelled\)/)
  })

  it('the freshness line renders the same on both sides: the server instant first, the real clock after mount', () => {
    expect(client).toMatch(/useState\(\(\) => initial\?\.renderedAt \?\? Date\.now\(\)\)/)
    expect(client).toMatch(/useEffect\(\(\) => \{\s*setNowTick\(Date\.now\(\)\)/)
  })

  it('the list in the HTML is visible before the JS runs: no entrance animation from opacity 0 while hydrating', () => {
    expect(client).toMatch(/const enter = <T,>\(from: T\): T \| false => \(init && !hydrated \? false : from\)/)
    expect(client).not.toMatch(/initial=\{\{ opacity: 0/)
    expect(client.match(/initial=\{enter\(\{ opacity: 0/g)?.length).toBeGreaterThanOrEqual(7)
  })

  it('a failed part still says so: the list state keeps FEED_UNREACHABLE and the cohort\'s error', () => {
    expect(client).toMatch(/error: scored \? null : FEED_UNREACHABLE/)
    expect(client).toMatch(/cohortStatus: \(cohort \? 'ok' : 'error'\) as FeedStatus/)
  })
})
