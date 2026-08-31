import { type NextRequest, NextResponse } from 'next/server'
import { apiError, corsOptions } from '@/lib/api-helpers'
import { getAgentTrustBreakdown, type AgentTrustBreakdown } from '@/lib/api-data'
import { AGENT_SURFACE_VERSION, TRUST_DISCLAIMER, TRUST_ROUTE_CACHE_CONTROL, renderTrustText } from '@/lib/agent-surface'

const RESPONSE_HEADERS = {
  'Cache-Control': TRUST_ROUTE_CACHE_CONTROL,
  // JSON vs. text share one URL and differ only by the Accept header —
  // without Vary the CDN edge cache serves whichever representation was
  // cached first to every client hitting that URL (?format=text is exempt:
  // its query string is already part of the cache key).
  Vary: 'Accept',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function wantsText(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.get('format') === 'text') return true
  const accept = request.headers.get('accept') || ''
  return accept.includes('text/plain')
}

function textResponse(data: AgentTrustBreakdown) {
  return new NextResponse(renderTrustText(data), {
    headers: {
      ...RESPONSE_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

function jsonResponse(data: AgentTrustBreakdown) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
        version: AGENT_SURFACE_VERSION,
        disclaimer: TRUST_DISCLAIMER,
      },
    },
    { headers: RESPONSE_HEADERS }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return apiError('Agent ID is required', 400)

    const data = await getAgentTrustBreakdown(id)
    if (!data) return apiError('Agent not found', 404)

    return wantsText(request) ? textResponse(data) : jsonResponse(data)
  } catch (error) {
    // getAgentTrustBreakdown's only throwing dependency is the Hasura gql()
    // call — on-chain price reads already degrade to null on failure — so
    // any exception here is an upstream indexer failure, not a bug in this
    // route.
    console.error('[API] /agents/:id/trust error:', error)
    return NextResponse.json(
      { error: 'upstream', retry_after_seconds: 10 },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}

export async function OPTIONS() {
  return corsOptions()
}
