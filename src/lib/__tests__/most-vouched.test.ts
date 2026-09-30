/**
 * Etap 5b Run 1 commit 3 — sort by people. /agents and the landing carousel order their rows with
 * one helper (lib/agent-list.ts orderAgents) and one default ("Most vouched"), from the same read.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { orderAgents, listEntryOf, cardAttestationView } from '../agent-list'
import { DEFAULT_SORT } from '../agent-list-sort'
import { CANONICAL_DOMAINS_REGISTRY } from '../canonical-domains'
import type { AttestedEntry } from '../attestation-reader'

const E18 = 10n ** 18n
const wei = (t: string) => BigInt(Math.round(Number(t) * 1e6)) * (E18 / 1_000_000n)
const ATTESTER = '0x1392aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0006'
const attested = (agentId: string, domainIdx: number, stake: bigint): AttestedEntry => ({
  agentId, agentName: '', domain: CANONICAL_DOMAINS_REGISTRY[domainIdx], distinctAttesters: 1, attesters: [ATTESTER],
  attesterStakes: [{ wallet: ATTESTER, shares: stake }], totalStake: stake, opposeStake: 0n, positionCount: 1, score: 0,
})
const row = (term_id: string, label: string, created_at: string, supportWei?: bigint) => ({
  term_id, label, created_at,
  // Cohort rows: the list never reads their vault (no positions_aggregate).
  ...(supportWei != null ? { positions_aggregate: { aggregate: { sum: { shares: supportWei.toString() } } } } : {}),
})

// Live 2026-09-30 (the list's read): Luda and Captain Dackie are the only agents anyone vouches for.
const LUDA = row('0xluda', 'Luda', '2026-06-01T00:00:00Z', wei('0.001'))
const DACKIE = row('0xdackie', 'Captain Dackie', '2026-03-01T00:00:00Z')
const OPEN_CLAW = row('0xopenclaw', 'OPEN CLAW', '2026-02-18T00:00:00Z', wei('0.3351'))
const CODEBUDDY = row('0xcodebuddy', 'CodeBuddy', '2026-05-01T00:00:00Z', wei('0.099'))
const COHORT_NEW = row('0xcohortnew', 'Cohort new', '2026-09-01T00:00:00Z')
const VIEWS = new Map([
  ['0xluda', cardAttestationView([attested('0xluda', 2, wei('0.0208'))])],
  ['0xdackie', cardAttestationView([attested('0xdackie', 0, wei('0.0099'))])],
  ['0xopenclaw', cardAttestationView([])],
])

describe('orderAgents — the default order, from the list\'s read', () => {
  it('starts Luda, Captain Dackie (1 person each; 0.0208 > 0.0099 tTRUST), then backing, then newest', () => {
    const order = orderAgents([COHORT_NEW, OPEN_CLAW, CODEBUDDY, DACKIE, LUDA].map(listEntryOf), VIEWS, DEFAULT_SORT)
    expect(order.map((e) => e.agent.label)).toEqual(['Luda', 'Captain Dackie', 'OPEN CLAW', 'CodeBuddy', 'Cohort new'])
    expect(order[0].vouch).toEqual({ people: 1, stakeWei: wei('0.0208') })
  })
  it('before the attestation read answers (undefined) or when it failed (null), nobody is counted: backing, then newest', () => {
    for (const views of [undefined, null]) {
      expect(orderAgents([DACKIE, LUDA, OPEN_CLAW].map(listEntryOf), views, DEFAULT_SORT).map((e) => e.agent.label))
        .toEqual(['OPEN CLAW', 'Luda', 'Captain Dackie'])
    }
  })
})

describe('one order for /agents and the landing carousel (source guards)', () => {
  const SRC = path.join(__dirname, '..', '..')
  const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
  it('/agents: sort from the URL (default "Most vouched"), rows through listEntryOf, ordered by orderAgents', () => {
    const page = read('app/agents/page.tsx')
    expect(page).toMatch(/useState<AgentListSortBy>\(\(\) => parseListFilters\(searchParams\)\.sort\)/)
    expect(page).toMatch(/const sorted = orderAgents\(filtered, attestationViewBySubject, sortBy\)/)
    expect(page).toMatch(/\{SORT_OPTIONS\.map\(o => <option key=\{o\.id\} value=\{o\.id\}>\{o\.label\}<\/option>\)\}/)
    expect(page).toMatch(/onChange=\{\(e\) => setListFilters\(\{ sort: parseSort\(e\.target\.value\) \}\)\}/)
  })
  it('the carousel: the same read (our API), the same rows, the same default — its first 8', () => {
    const featured = read('components/landing/FeaturedAgents.tsx')
    expect(featured).toMatch(/agentsPageView\(await fetchAgentsPage\(\)\)/)
    expect(featured).toMatch(/orderAgents\(rows\.map\(listEntryOf\), views, DEFAULT_SORT\)\.slice\(0, 8\)/)
    // No second, newest-first GraphQL read of AgentScore atoms for the agents tab.
    expect(featured).not.toMatch(/AGENT_WHERE_STR/)
  })
})
