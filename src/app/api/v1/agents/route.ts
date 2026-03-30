import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions, parsePagination } from '@/lib/api-helpers'
import { getAgentsWithScores } from '@/lib/api-data'

const VALID_SORTS = ['score', 'stakers', 'newest'] as const
type SortOption = typeof VALID_SORTS[number]

export async function GET(request: NextRequest) {
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

    const { agents, total } = await getAgentsWithScores({
      sort: sortParam as SortOption,
      limit,
      offset,
      minTrust,
    })

    return apiSuccess(agents, { total, limit, offset })
  } catch (error) {
    console.error('[API] /agents error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
