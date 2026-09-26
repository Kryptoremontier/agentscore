import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { installFakeHasura } from './fake-hasura'

/**
 * ERC-8004 agents on the detail surfaces (Etap 4b-close). Live 2026-09-26:
 * GET /api/v1/agents/<Captain Dackie> → 404 "Agent not found" and MCP get_agent_trust
 * → "Agent not found": getAgentDetail only searches the AgentScore corpus, and Dackie —
 * the one cohort agent with an attestation — is not in it. (The /agents/[id] PAGE already
 * rendered its non-scored profile, but downloaded the whole cohort to find one row.)
 */

vi.mock('../evaluator-data', () => ({ fetchEvaluatorLeaderboard: vi.fn(async () => []), fetchStakerPositions: vi.fn(async () => []) }))
vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))

const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const CAIP = 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380'
const DACKIE_TRIPLE = '0xe8565630aee28d221ca6e33461ca76faaa2e20e8865b0e9be2fbd8875186f906'
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const ATTESTER = '0x139219107C1eBE569f543C581b3B807Cf6740006'

const SAME_AS = [{ term_id: '0xsameas', created_at: '2026-07-01T00:00:00Z', subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: CAIP } }]

function fake(opts: { identityFail?: boolean; classificationFail?: boolean; attestationFail?: boolean } = {}) {
  return installFakeHasura({
    tables: [
      { match: (q) => q.includes('GetErc8004CohortAgent'), field: 'triples', rows: (_q, v) => SAME_AS.filter((r) => r.subject.term_id === v.id) },
      {
        match: (q) => q.includes('GetCohortClassification'), field: 'triples',
        rows: (q) => (q.includes(DACKIE) && q.includes('0xddde1d94') ? [{ term_id: '0xc1', subject_id: DACKIE, object: { term_id: '0xblock', label: 'blockchain' } }] : []),
      },
      { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: (_q, v) => ((v.subjects as string[]).includes(DACKIE) ? [{ term_id: DACKIE_TRIPLE, counter_term_id: null, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { term_id: CRYPTO } }] : []) },
      { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: [{ id: `${DACKIE_TRIPLE}-1-${ATTESTER}`, term_id: DACKIE_TRIPLE, account_id: ATTESTER, shares: '9900000000000000' }] },
      { match: (q) => q.includes('ApiAgent'), field: 'atoms', rows: [] },
    ],
    fail: (q) => (opts.identityFail && q.includes('GetErc8004CohortAgent')) || (opts.classificationFail && q.includes('GetCohortClassification'))
      || (opts.attestationFail && q.includes('GetAttestationTriple')) ? 'throw' : undefined,
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchCohortAgent — one cohort agent, same filter as the cohort list', () => {
  it('Captain Dackie → identity + declarations', async () => {
    fake()
    const { fetchCohortAgent } = await import('../cohort-reader')
    expect(await fetchCohortAgent(DACKIE)).toMatchObject({ termId: DACKIE, label: 'Captain Dackie', caipIdentity: CAIP, declaredDomains: ['blockchain'], declaredSkills: [] })
  })
  it('the identity filter and the id are separate _and terms (one object with two subject_id keys is rejected by Hasura — caught live)', async () => {
    const f = fake()
    const { fetchCohortAgent } = await import('../cohort-reader')
    await fetchCohortAgent(DACKIE)
    const q = f.calls.find((c) => c.query.includes('GetErc8004CohortAgent'))!.query
    expect(q).toMatch(/_and: \[\{[\s\S]*subject_id: \{ _is_null: false \}[\s\S]*\}, \{ subject_id: \{ _eq: \$id \} \}\]/)
  })
  it('an id with no ERC-8004 identity → null', async () => {
    fake()
    const { fetchCohortAgent } = await import('../cohort-reader')
    expect(await fetchCohortAgent('0xnobody')).toBeNull()
  })
  it('identity read fails → rejects (never "not a cohort agent")', async () => {
    fake({ identityFail: true })
    const { fetchCohortAgent } = await import('../cohort-reader')
    await expect(fetchCohortAgent(DACKIE)).rejects.toThrow()
  })
  it('classification fails → declarations null (unknown), identity still answered', async () => {
    fake({ classificationFail: true })
    const { fetchCohortAgent } = await import('../cohort-reader')
    expect(await fetchCohortAgent(DACKIE)).toMatchObject({ caipIdentity: CAIP, declaredDomains: null, declaredSkills: null })
  })
})

describe('getCohortAgentDetail — tier from attestations, nothing invented', () => {
  it('Dackie → unverified, 1 attester, 0.0099 tTRUST attested; no score / stake / staker fields', async () => {
    fake()
    const { getCohortAgentDetail } = await import('../api-data')
    const d = await getCohortAgentDetail(DACKIE)
    expect(d).toMatchObject({ origin: 'erc8004', trustTier: 'unverified', tierBasis: 'attestations', scoreBasis: null, attesters: 1, tTrustAttested: 0.0099 })
    expect(d?.attestedDomains).toEqual([{ domain: 'Crypto / Onchain', attesters: 1, tTrustAttested: 0.0099 }])
    for (const k of ['score', 'agentScore', 'supportStake', 'opposeStake', 'stakerCount']) expect(d).not.toHaveProperty(k)
  })
  it('attestation read fails → tier and counts null, never "unverified" / 0', async () => {
    fake({ attestationFail: true })
    const { getCohortAgentDetail } = await import('../api-data')
    expect(await getCohortAgentDetail(DACKIE)).toMatchObject({ trustTier: null, attesters: null, attestedDomains: null, tTrustAttested: null })
  })
})

describe('GET /api/v1/agents/:id resolves ERC-8004 agents', () => {
  beforeEach(() => vi.resetModules())
  const get = async (id: string) => {
    const { GET } = await import('@/app/api/v1/agents/[id]/route')
    const res = await GET(new NextRequest(`http://localhost/api/v1/agents/${id}`), { params: Promise.resolve({ id }) })
    return { status: res.status, body: await res.json() }
  }
  it('Dackie → 200 with tier unverified, 1 attester (was 404)', async () => {
    fake()
    const { status, body } = await get(DACKIE)
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ id: DACKIE, origin: 'erc8004', trustTier: 'unverified', attesters: 1 })
  })
  it('a genuinely unknown id → 404', async () => {
    fake()
    expect((await get('0xnobody')).status).toBe(404)
  })
  it('a failed identity read → 500, never 404', async () => {
    fake({ identityFail: true })
    const { status, body } = await get(DACKIE)
    expect(status).toBe(500)
    expect(body.error).not.toMatch(/not found/i)
  })
})

describe('MCP get_agent_trust resolves ERC-8004 agents', () => {
  it('Dackie → agent.origin erc8004, tier unverified (was "Agent not found")', async () => {
    fake()
    const { POST } = await import('@/app/api/mcp/[transport]/route')
    const res = await POST(new Request('http://localhost/api/mcp/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_agent_trust', arguments: { agentId: DACKIE } } }),
    }))
    const raw = await res.text()
    const json = JSON.parse(raw.includes('data:') ? raw.split('\n').find((l) => l.startsWith('data:'))!.slice(5) : raw)
    expect(JSON.parse(json.result.content[0].text).agent).toMatchObject({ origin: 'erc8004', trustTier: 'unverified', attesters: 1 })
  })
})

describe('the /agents/[id] page reads one cohort agent, not the whole cohort', () => {
  it('uses fetchCohortAgent and surfaces a failed read', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('src/app/agents/[id]/page.tsx', 'utf8')
    expect(page).toContain('fetchCohortAgent(agentId)')
    expect(page).not.toContain('fetchCohortAgents(')
    expect(page).toContain('cohortFailed ? null : cohortMatch?.declaredDomains')
  })
})
