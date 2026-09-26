import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getAgentDetail, getCohortAgentDetail } from '@/lib/api-data'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return apiError('Agent ID is required', 400)

    // The scored AgentScore corpus first, then the ERC-8004 cohort (e.g. Captain Dackie): an
    // attested agent is never a 404. A genuinely unknown id is; a failed read throws → 500.
    const data = await getAgentDetail(id)
    if (data) return apiSuccess(data)
    const cohort = await getCohortAgentDetail(id)
    if (!cohort) return apiError('Agent not found', 404)
    return apiSuccess(cohort)
  } catch (error) {
    console.error('[API] /agents/:id error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
