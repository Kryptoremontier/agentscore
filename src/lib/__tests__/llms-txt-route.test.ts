import { describe, expect, it } from 'vitest'
import { GET } from '@/app/llms.txt/route'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'
import { TRUST_DISCLAIMER, TRUST_ROUTE_CACHE } from '@/lib/agent-surface'

describe('GET /llms.txt', () => {
  it('is text/plain and includes endpoints sourced from API_V1_ENDPOINTS', async () => {
    const res = await GET()
    expect(res.headers.get('content-type')).toContain('text/plain')

    const text = await res.text()
    expect(text).toContain(`GET ${API_V1_ENDPOINTS.agent_trust}`)
    expect(text).toContain(`GET ${API_V1_ENDPOINTS.agent_card}`)
    expect(text).toContain(`GET ${API_V1_ENDPOINTS.leaderboard}`)
    expect(text).toContain(`GET ${API_V1_ENDPOINTS.domains}`)
  })

  it('includes the trust disclaimer and the real cache values it enforces', async () => {
    const res = await GET()
    const text = await res.text()

    expect(text).toContain(TRUST_DISCLAIMER)
    expect(text).toContain(`s-maxage=${TRUST_ROUTE_CACHE.sMaxAgeSeconds}`)
    expect(text).toContain(`stale-while-revalidate=${TRUST_ROUTE_CACHE.staleWhileRevalidateSeconds}`)
  })

  it('includes a real JSON and text example for the trust endpoint', async () => {
    const res = await GET()
    const text = await res.text()

    expect(text).toContain('"success":true')
    expect(text).toMatch(/agentId: 0x[0-9a-f]+/)
  })
})
