import { type NextRequest, NextResponse } from 'next/server'
import { apiError, cacheControlFor, corsOptions, freshnessMeta, NO_STORE, withReadLedger } from '@/lib/api-helpers'
import { trustGateFor } from '@/lib/gate-any-id'
import { recordGateCall } from '@/lib/gate-calls'
import { parseGatePolicy } from '@/lib/trust-gate'

/**
 * GET /api/v1/agents/:id/gate?minTier=trusted | ?minPeople=1&area=Crypto%20%2F%20Onchain
 *
 * The trust gate (Etap 7, lib/trust-gate.ts): allow / deny / unknown for paying or delegating to
 * this agent, under the caller's policy (default `{ minTier: "trusted" }`), with who vouches, for
 * what, and the data's age. A policy that doesn't parse is refused (400), never a silent deny.
 * `unknown` (a failed read) is never cached; only `minTier`, `minPeople` and `area` are read.
 *
 * Etap 9 — `:id` is any id /check takes (lib/gate-any-id.ts): an Intuition term id, an ERC-8004 id
 * (`8453:1380` or the CAIP form, percent-encoded), the wallet that registered the agent, or an
 * exact name. More than one agent fits → `unknown` with `candidates`. `agentId` says which agent
 * the answer is about.
 */
async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: given } = await params
  if (!given) return apiError('Agent ID is required', 400)
  // A CAIP id or a name arrives percent-encoded; a term id is unchanged by this.
  let id = given
  try { id = decodeURIComponent(given) } catch { /* a literal "%": as given */ }
  const q = request.nextUrl.searchParams
  const parsed = parseGatePolicy({ minTier: q.get('minTier'), minPeople: q.get('minPeople'), area: q.get('area') })
  if (!parsed.ok) return apiError(parsed.error, 400)

  // One outside call counted (stats `gateCalls7d`), beside the read — never after it, never able to fail it.
  const [data] = await Promise.all([trustGateFor(id, parsed.policy), recordGateCall(request.headers)])
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
