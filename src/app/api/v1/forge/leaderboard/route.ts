import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { fetchForgeProjectsFromChain } from '@/lib/forge/data'
import { getForgeProjectScore, compareForgeScoreDesc } from '@/lib/forge/scoring'
import { ForgeCategory } from '@/lib/forge/types'

// Dynamic: caching lives in the data layer (lib/server-cache.ts), where only complete reads
// are stored and every answer carries meta.dataAgeSeconds. A route-level `revalidate` here was
// inert (the reads are `no-store`) while looking like it cached for minutes.
export const dynamic = 'force-dynamic'

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as ForgeCategory | null

    let projects = await fetchForgeProjectsFromChain()

    if (category && Object.values(ForgeCategory).includes(category)) {
      projects = projects.filter(p => p.category === category)
    }

    const top3 = projects
      .sort(compareForgeScoreDesc) // an unknown score (oppose read failed) never ranks
      .slice(0, 3)
      .map((project, i) => ({
        rank: i + 1,
        project: {
          ...project,
          score: getForgeProjectScore(project),
        },
      }))

    return apiSuccess(top3)
  } catch (error) {
    console.error('[API] /forge/leaderboard error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
