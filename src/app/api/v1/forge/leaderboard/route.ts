import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { fetchForgeProjectsFromChain } from '@/lib/forge/data'
import { ForgeCategory } from '@/lib/forge/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as ForgeCategory | null

    let projects = await fetchForgeProjectsFromChain(20)

    if (category && Object.values(ForgeCategory).includes(category)) {
      projects = projects.filter(p => p.category === category)
    }

    const top3 = projects
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 3)
      .map((project, i) => ({ rank: i + 1, project }))

    return apiSuccess(top3)
  } catch (error) {
    console.error('[API] /forge/leaderboard error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
