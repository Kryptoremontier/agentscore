import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api-helpers'
import { AGENT_ID_RE, REFRESH_LIMIT, refreshPlan, startAgentRefresh } from '@/lib/agent-refresh'
import { createRateLimiter, clientIp } from '@/lib/rate-limit'

/**
 * POST /api/v1/refresh — after a trust or a withdrawal made in AgentScore, refill what that agent's
 * change affects (lib/agent-refresh.ts), after the response. Body: `{ "agentId": "0x…" }` (or
 * `?agentId=`). Nothing else is read from the request: it cannot change any value, only start a
 * fresh indexer read, stored only if complete. 202 when started; 400 for a bad id; 429 over
 * REFRESH_LIMIT per minute per IP.
 */
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter(REFRESH_LIMIT)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(request: NextRequest) {
  const allowed = limiter.take(clientIp(request.headers))
  if (!allowed.ok) {
    return NextResponse.json(
      { success: false, error: 'rate_limited', retryAfterSeconds: allowed.retryAfterSeconds },
      { status: 429, headers: { ...CORS, 'Retry-After': String(allowed.retryAfterSeconds) } },
    )
  }
  let agentId = request.nextUrl.searchParams.get('agentId')
  if (!agentId) {
    try {
      const body = (await request.json()) as { agentId?: unknown } | null
      agentId = typeof body?.agentId === 'string' ? body.agentId : null
    } catch {
      agentId = null
    }
  }
  if (!agentId || !AGENT_ID_RE.test(agentId)) return apiError('agentId must be a term id (0x + 64 hex)', 400)

  startAgentRefresh(agentId)
  return NextResponse.json(
    { success: true, data: { accepted: true, agentId, refreshing: refreshPlan(agentId, []).map((s) => s.key) } },
    { status: 202, headers: { ...CORS, 'Cache-Control': 'no-store' } },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
