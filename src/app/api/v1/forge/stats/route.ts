import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { fetchForgeProjectsFromChain } from '@/lib/forge/data'
import { ForgeCategory } from '@/lib/forge/types'
import { meanKnownForgeScore } from '@/lib/forge/scoring'

export async function GET(_request: NextRequest) {
  try {
    const projects = await fetchForgeProjectsFromChain(200)

    const totalStaked     = projects.reduce((s, p) => s + p.totalStaked, 0)
    const totalStakers    = projects.reduce((s, p) => s + p.stakerCount, 0)
    const totalEvaluators = projects.reduce((s, p) => s + p.evaluatorCount, 0)
    // Over the projects whose score is known; null when none is (never a 0 nobody measured).
    const mean            = meanKnownForgeScore(projects)
    const avgTrustScore   = mean == null ? null : Math.round(mean)

    const categoryCounts = Object.fromEntries(
      Object.values(ForgeCategory).map(c => [
        c,
        projects.filter(p => p.category === c).length,
      ])
    ) as Record<ForgeCategory, number>

    return apiSuccess({
      totalProjects: projects.length,
      totalStaked:   Math.round(totalStaked * 100) / 100,
      totalStakers,
      totalEvaluators,
      categoryCounts,
      avgTrustScore,
    })
  } catch (error) {
    console.error('[API] /forge/stats error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
