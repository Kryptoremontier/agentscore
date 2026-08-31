import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AgentTrustBreakdown } from '@/lib/api-data'

const getAgentTrustBreakdown = vi.fn<[string], Promise<AgentTrustBreakdown | null>>()

vi.mock('@/lib/api-data', () => ({
  getAgentTrustBreakdown: (id: string) => getAgentTrustBreakdown(id),
}))

const MOCK_BREAKDOWN: AgentTrustBreakdown = {
  agentId: '0xabc123',
  agentName: 'Test Agent',
  score: {
    objectType: 'agent',
    trustScore: 70,
    qualityScore: 50,
    objectScore: 62,
    tier: 'good',
    softGateActive: false,
    computedAt: '2026-01-01T00:00:00.000Z',
  },
  agentScore: 62,
  trustScore: { raw: 100, confidence: 0.39, anchored: 69.7, momentum: 0 },
  compositeScore: { total: 50, signalRatio: 100, stakerDiversity: 0, stability: 0, priceRetention: 100 },
  softGate: { supportRatio: 100, scaleFactor: 1, applied: false },
  antiManipulation: { diversityWeightedRatio: 100, whaleDetected: true, largestStakerShare: 1, evaluatorWeightsApplied: false },
  tier: { current: 'unverified', nextTier: 'sandbox', requirements: { stakers: '1/3', stake: '0.05/0.1 tTRUST', ratio: '100%/0%', age: '10/0 days' } },
}

async function loadRoute() {
  vi.resetModules()
  return import('@/app/api/v1/agents/[id]/trust/route')
}

function req(url: string, headers?: Record<string, string>) {
  return new NextRequest(url, { headers })
}

const params = { params: Promise.resolve({ id: '0xabc123' }) }

describe('GET /api/v1/agents/:id/trust', () => {
  beforeEach(() => {
    getAgentTrustBreakdown.mockReset()
  })

  it('returns 200 JSON by default with the unchanged data shape plus additive meta', async () => {
    getAgentTrustBreakdown.mockResolvedValue(MOCK_BREAKDOWN)
    const { GET } = await loadRoute()

    const res = await GET(req('http://localhost/api/v1/agents/0xabc123/trust'), params)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300')

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(MOCK_BREAKDOWN)
    expect(body.meta.version).toBe('v1')
    expect(body.meta.disclaimer).toMatch(/never trustworthiness/)
    expect(body.meta.network).toBeDefined()
    expect(body.meta.timestamp).toBeDefined()
  })

  it('returns 200 text/plain when Accept: text/plain is sent', async () => {
    getAgentTrustBreakdown.mockResolvedValue(MOCK_BREAKDOWN)
    const { GET } = await loadRoute()

    const res = await GET(
      req('http://localhost/api/v1/agents/0xabc123/trust', { Accept: 'text/plain' }),
      params
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('agentId: 0xabc123')
    expect(text).toContain('score.trustScore: 70')
    expect(text).toContain('disclaimer: ')
    expect(text).toMatch(/never trustworthiness/)
  })

  it('returns 200 text/plain when ?format=text is used', async () => {
    getAgentTrustBreakdown.mockResolvedValue(MOCK_BREAKDOWN)
    const { GET } = await loadRoute()

    const res = await GET(
      req('http://localhost/api/v1/agents/0xabc123/trust?format=text'),
      params
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('agentId: 0xabc123')
    expect(text).toMatch(/never trustworthiness/)
  })

  it('returns 404 for an unknown agent', async () => {
    getAgentTrustBreakdown.mockResolvedValue(null)
    const { GET } = await loadRoute()

    const res = await GET(req('http://localhost/api/v1/agents/0xdead/trust'), params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 502 with retry guidance when the upstream indexer fails', async () => {
    getAgentTrustBreakdown.mockRejectedValue(new Error('GraphQL error'))
    const { GET } = await loadRoute()

    const res = await GET(req('http://localhost/api/v1/agents/0xabc123/trust'), params)

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('upstream')
    expect(body.retry_after_seconds).toBe(10)
  })
})
