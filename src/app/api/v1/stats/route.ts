import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getPlatformStats } from '@/lib/api-data'

export async function GET(_request: NextRequest) {
  try {
    const stats = await getPlatformStats()
    return apiSuccess(stats)
  } catch (error) {
    console.error('[API] /stats error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
