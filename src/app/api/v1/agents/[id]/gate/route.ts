import { type NextRequest, NextResponse } from 'next/server'
import { apiError, cacheControlFor, corsOptions, freshnessMeta, NO_STORE, withReadLedger } from '@/lib/api-helpers'
import { trustGate } from '@/lib/api-data'
import { parseGatePolicy } from '@/lib/trust-gate'

/**
 * GET /api/v1/agents/:id/gate?minTier=trusted | ?minPeople=1&area=Crypto%20%2F%20Onchain
 *
 * The trust gate (Etap 7, lib/trust-gate.ts): allow / deny / unknown for paying or delegating to
 * this agent, under the caller's policy (default `{ minTier: "trusted" }`), with who vouches, for
 * what, and the data's age. A policy that doesn't parse is refused (400), never a silent deny.
 * `unknown` (a failed read) is never cached; only `minTier`, `minPeople` and `area` are read.
 */
async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return apiError('Agent ID is required', 400)
  const q = request.nextUrl.searchParams
  const parsed = parseGatePolicy({ minTier: q.get('minTier'), minPeople: q.get('minPeople'), area: q.get('area') })
  if (!parsed.ok) return apiError(parsed.error, 400)

  const data = await trustGate(id, parsed.policy)
  return NextResponse.json(
    {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), network: process.env.NEXT_PUBLIC_NETWORK || 'testnet', ...freshnessMeta() },
    },
    {
      headers: {
        'Cache-Control': data.decision === 'unknown' ? NO_STORE : cacheControlFor(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    },
  )
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
