import { type NextRequest } from 'next/server'
import { apiError, apiSuccess, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { getAgentModalParts, isListedAgent } from '@/lib/agents-page-data'
import { MODAL_PARTS, type ModalPart } from '@/lib/agents-page-types'
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id || !TERM_ID.test(id)) return apiError('A term id (0x + 64 hex) is required', 400)
    // ?parts=vault,signals,reports — only those (the agent header's; Etap 5a). Default: every part.
    const asked = request.nextUrl.searchParams.get('parts')
    const parts = asked ? asked.split(',').map((p) => p.trim()).filter(Boolean) : [...MODAL_PARTS]
    const unknown = parts.filter((p) => !(MODAL_PARTS as readonly string[]).includes(p))
    if (unknown.length || parts.length === 0) return apiError(`Unknown part(s): ${unknown.join(', ') || '(none)'} — one or more of ${MODAL_PARTS.join(', ')}`, 400)
    if ((await isListedAgent(id)) === false) return apiError('Agent not found', 404)
    return apiSuccess(encodeForCache(await getAgentModalParts(id, parts as ModalPart[])))
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
