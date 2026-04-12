import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { fetchForgeProjectsFromChain } from '@/lib/forge/data'
import { ForgeCategory } from '@/lib/forge/types'

export async function GET(_request: NextRequest) {
  try {
    const projects = await fetchForgeProjectsFromChain(200)

    const totalStaked     = projects.reduce((s, p) => s + p.totalStaked, 0)
    const totalStakers    = projects.reduce((s, p) => s + p.stakerCount, 0)
    const totalEvaluators = projects.reduce((s, p) => s + p.evaluatorCount, 0)
    const avgTrustScore   = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + p.finalScore, 0) / projects.length)
      : 0

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
