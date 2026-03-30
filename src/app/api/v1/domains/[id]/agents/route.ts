import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getDomainAgents } from '@/lib/api-data'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return apiError('Domain ID is required', 400)

    const sp = request.nextUrl.searchParams
    const minTrust = parseFloat(sp.get('minTrust') || '0')
    if (isNaN(minTrust) || minTrust < 0 || minTrust > 100) {
      return apiError('minTrust must be a number between 0 and 100', 400)
    }

    const limit = Math.min(parseInt(sp.get('limit') || '20'), 100)

    const result = await getDomainAgents(id, { minTrust, limit })
    if (!result.domain) return apiError('Domain not found', 404)

    return apiSuccess(result, { total: result.total })
  } catch (error) {
    console.error('[API] /domains/:id/agents error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
