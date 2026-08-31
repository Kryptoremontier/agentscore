import { describe, expect, it } from 'vitest'
import { GET as getManifest } from '@/app/.well-known/agent.json/route'
import { GET as getApiIndex } from '@/app/api/v1/route'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'
import { AGENT_SURFACE_VERSION, TRUST_DISCLAIMER } from '@/lib/agent-surface'

describe('GET /.well-known/agent.json', () => {
  it('is valid JSON describing the AgentScore service', async () => {
    const res = await getManifest()
    expect(res.headers.get('content-type')).toContain('application/json')

    const manifest = await res.json()
    expect(manifest.name).toBe('AgentScore')
    expect(typeof manifest.description).toBe('string')
    expect(manifest.version).toBe(AGENT_SURFACE_VERSION)
    expect(manifest.docs).toBe('/llms.txt')
    expect(manifest.skill).toBe('/skill.md')
    expect(manifest.disclaimer).toBe(TRUST_DISCLAIMER)
    expect(manifest.network).toBe('testnet')
  })

  it('lists the same endpoints as the /api/v1 index', async () => {
    const manifestRes = await getManifest()
    const manifest = await manifestRes.json()

    const indexRes = await getApiIndex(new Request('https://x/api/v1') as never)
    const index = await indexRes.json()

    expect(Object.keys(manifest.endpoints).length).toBe(Object.keys(index.data.endpoints).length)
    expect(manifest.endpoints).toEqual(API_V1_ENDPOINTS)
    expect(manifest.endpoints).toEqual(index.data.endpoints)
  })

  it('carries the trust route cache limits', async () => {
    const res = await getManifest()
    const manifest = await res.json()

    expect(manifest.limits.agentTrustRoute.sMaxAgeSeconds).toBeTypeOf('number')
    expect(manifest.limits.agentTrustRoute.staleWhileRevalidateSeconds).toBeTypeOf('number')
  })
})
