import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions, parsePagination, withReadLedger } from '@/lib/api-helpers'
import { getAgentsWithScores } from '@/lib/api-data'

// Dynamic: caching lives in the data layer (lib/server-cache.ts), where only complete reads
// are stored and every answer carries meta.dataAgeSeconds. A route-level `revalidate` here was
// inert (the reads are `no-store`) while looking like it cached for minutes.
export const dynamic = 'force-dynamic'

const VALID_SORTS = ['score', 'stakers', 'newest'] as const
type SortOption = typeof VALID_SORTS[number]

async function handleGET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams

    const sortParam = sp.get('sort') || 'score'
    if (!VALID_SORTS.includes(sortParam as SortOption)) {
      return apiError(`Invalid sort parameter. Use: ${VALID_SORTS.join(', ')}`, 400)
    }

    const minTrust = parseFloat(sp.get('minTrust') || '0')
    if (isNaN(minTrust) || minTrust < 0 || minTrust > 100) {
      return apiError('minTrust must be a number between 0 and 100', 400)
    }

    const { limit, offset } = parsePagination(sp)
    const includeJunk = sp.get('includeJunk') === 'true'

    const { agents, total, junkFiltered, truncated } = await getAgentsWithScores({
      sort: sortParam as SortOption,
      limit,
      offset,
      minTrust,
      includeJunk,
    })

    // truncated: the corpus fetch hit its cap, so `total` counts only fetched rows (REPO_MAP §7 rule 1).
    return apiSuccess(agents, { total, limit, offset, junkFiltered, truncated })
  } catch (error) {
    console.error('[API] /agents error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
