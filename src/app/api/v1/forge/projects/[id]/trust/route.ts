import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { fetchForgeProjectById } from '@/lib/forge/data'
import { getForgeProjectScore } from '@/lib/forge/scoring'

async function handleGET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await fetchForgeProjectById(params.id)
    if (!project) return apiError('Project not found', 404)

    return apiSuccess({
      score:          getForgeProjectScore(project),
      trustScore:     project.trustScore,
      compositeScore: project.compositeScore,
      finalScore:     project.finalScore,
      stakerCount:    project.stakerCount,
      totalStaked:    project.totalStaked,
      opposeStaked:   project.opposeStaked,
      momentum:       project.momentum,
      sparklineData:  project.sparklineData,
      supportPositions: (project.supportPositions ?? []).length,
      opposePositions:  (project.opposePositions ?? []).length,
    })
  } catch (error) {
    console.error(`[API] GET /forge/projects/${params.id}/trust error:`, error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
