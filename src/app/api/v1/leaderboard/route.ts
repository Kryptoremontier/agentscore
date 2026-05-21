import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions, parsePagination } from '@/lib/api-helpers'
import { getAgentsWithScores } from '@/lib/api-data'

export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const domain = sp.get('domain') || null
    const { limit, offset } = parsePagination(sp)

    // Fetch all agents sorted by score; we need the full set to assign global ranks
    const { agents, total } = await getAgentsWithScores({ sort: 'score', limit: 100, offset: 0 })

    const filtered = domain
      ? agents.filter(a => a.name.toLowerCase().includes(domain.toLowerCase()))
      : agents

    const ranked = filtered.map((agent, idx) => ({
      rank: idx + 1,
      termId: agent.id,
      name: agent.name,
      trustScore: agent.score.trustScore,
      qualityScore: agent.score.qualityScore,
      objectScore: agent.score.objectScore,
      score: agent.score,
      domain: null,
      stakerCount: agent.stakerCount,
      totalStaked: Math.round((agent.supportStake + agent.opposeStake) * 1000) / 1000,
      momentum: agent.momentum,
    }))

    const totalFiltered = ranked.length
    const page = ranked.slice(offset, offset + limit)

    return apiSuccess(page, { total: totalFiltered, limit, offset })
  } catch (error) {
    console.error('[API] /leaderboard error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
