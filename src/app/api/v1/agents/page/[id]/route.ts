import { type NextRequest } from 'next/server'
import { apiError, apiSuccess, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { getAgentModalData, isListedAgent } from '@/lib/agents-page-data'
import { encodeForCache } from '@/lib/json-codec'

/**
 * Internal: what the /agents modal reads beyond the list for one agent — its vault, signals,
 * skill triples, reports and staker weights — from the shared complete-reads cache
 * (lib/agents-page-data.ts). Only agents the page lists; each part says how old it is or that
 * it failed. Not part of the public REST surface.
 */
export const dynamic = 'force-dynamic'

const TERM_ID = /^0x[0-9a-fA-F]{64}$/

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id || !TERM_ID.test(id)) return apiError('A term id (0x + 64 hex) is required', 400)
    if ((await isListedAgent(id)) === false) return apiError('Agent not found', 404)
    return apiSuccess(encodeForCache(await getAgentModalData(id)))
  } catch (error) {
    console.error('[API] /agents/page/:id error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
