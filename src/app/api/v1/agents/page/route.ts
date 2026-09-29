import { apiError, apiSuccess, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { getAgentsPageData } from '@/lib/agents-page-data'
import { encodeForCache } from '@/lib/json-codec'

/**
 * Internal: everything the /agents page lists, in one answer, from the shared complete-reads
 * cache (lib/agents-page-data.ts). Each part says how old it is or that it failed; the answer
 * is CDN-cached briefly only when every part was read (lib/api-helpers.ts). Values keep exact
 * wei and per-subject maps (lib/json-codec.ts). Not part of the public REST surface.
 */
export const dynamic = 'force-dynamic'

async function handleGET() {
  try {
    return apiSuccess(encodeForCache(await getAgentsPageData()))
  } catch (error) {
    console.error('[API] /agents/page error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
