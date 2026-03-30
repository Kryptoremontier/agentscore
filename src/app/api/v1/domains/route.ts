import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getDomains } from '@/lib/api-data'

export async function GET(_request: NextRequest) {
  try {
    const domains = await getDomains()
    return apiSuccess(domains, { total: domains.length })
  } catch (error) {
    console.error('[API] /domains error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
