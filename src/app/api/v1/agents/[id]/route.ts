import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getAgentDetail } from '@/lib/api-data'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return apiError('Agent ID is required', 400)

    const data = await getAgentDetail(id)
    if (!data) return apiError('Agent not found', 404)

    return apiSuccess(data)
  } catch (error) {
    console.error('[API] /agents/:id error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
