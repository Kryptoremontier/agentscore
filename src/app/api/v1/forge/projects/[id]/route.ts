import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { fetchForgeProjectById } from '@/lib/forge/data'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const project = await fetchForgeProjectById(id)
    if (!project) return apiError('Project not found', 404)
    return apiSuccess(project)
  } catch (error) {
    console.error(`[API] GET /forge/projects/${params.id} error:`, error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
