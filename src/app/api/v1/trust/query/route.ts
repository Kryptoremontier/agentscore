import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { trustQuery } from '@/lib/api-data'

const VALID_SORTS = ['score', 'stakers'] as const
type SortOption = typeof VALID_SORTS[number]

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams

    const skill = sp.get('skill') || undefined
    const minTrust = parseFloat(sp.get('minTrust') || '0')
    const minStakers = parseInt(sp.get('minStakers') || '0')
    const limit = Math.min(parseInt(sp.get('limit') || '10'), 100)

    if (isNaN(minTrust) || minTrust < 0 || minTrust > 100) {
      return apiError('minTrust must be a number between 0 and 100', 400)
    }
    if (isNaN(minStakers) || minStakers < 0) {
      return apiError('minStakers must be a non-negative integer', 400)
    }

    const sortParam = sp.get('sort') || 'score'
    if (!VALID_SORTS.includes(sortParam as SortOption)) {
      return apiError(`Invalid sort parameter. Use: ${VALID_SORTS.join(', ')}`, 400)
    }

    const result = await trustQuery({
      skill,
      minTrust,
      minStakers,
      sort: sortParam as SortOption,
      limit,
    })

    return apiSuccess(result)
  } catch (error) {
    console.error('[API] /trust/query error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
