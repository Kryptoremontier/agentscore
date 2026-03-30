import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getSkillDetail } from '@/lib/api-data'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return apiError('Skill ID is required', 400)

    const data = await getSkillDetail(id)
    if (!data) return apiError('Skill not found', 404)

    return apiSuccess(data)
  } catch (error) {
    console.error('[API] /skills/:id error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
