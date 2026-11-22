import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { getStatsWithNorthStar } from '@/lib/north-star'

// Dynamic: caching lives in the data layer (lib/server-cache.ts), where only complete reads
// are stored and every answer carries meta.dataAgeSeconds. A route-level `revalidate` here was
// inert (the reads are `no-store`) while looking like it cached for minutes.
export const dynamic = 'force-dynamic'

async function handleGET(_request: NextRequest) {
  try {
    // The platform stats plus the North Star fields (Etap 9): agentsEstablished, agentsVerified, trustEvents7d, gateCalls7d.
    const stats = await getStatsWithNorthStar()
    return apiSuccess(stats)
  } catch (error) {
    console.error('[API] /stats error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
