import { NextResponse } from 'next/server'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'
import {
  AGENT_SURFACE_VERSION,
  TRUST_DISCLAIMER,
  TRUST_ROUTE_CACHE,
  TRUST_ROUTE_CACHE_CONTROL,
} from '@/lib/agent-surface'

/**
 * Service manifest for AgentScore itself (A2A-style auto-discovery). This
 * describes the SERVICE, not an individual agent — an individual agent's
 * card is GET /api/v1/agents/:id/card. Built from the same shared constants
 * as /llms.txt and /skill.md so this can't drift out of sync with them.
 */
export async function GET() {
  return NextResponse.json(
    {
      name: 'AgentScore',
      description:
        'On-chain reputation marketplace for AI agents, built on Intuition Protocol. Scores are derived from real staked tTRUST — support/oppose positions recorded on-chain, not self-reported ratings.',
      version: AGENT_SURFACE_VERSION,
      endpoints: API_V1_ENDPOINTS,
      docs: '/llms.txt',
      skill: '/skill.md',
      disclaimer: TRUST_DISCLAIMER,
      limits: {
        agentTrustRoute: {
          cacheControl: TRUST_ROUTE_CACHE_CONTROL,
          sMaxAgeSeconds: TRUST_ROUTE_CACHE.sMaxAgeSeconds,
          staleWhileRevalidateSeconds: TRUST_ROUTE_CACHE.staleWhileRevalidateSeconds,
        },
      },
      network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
