import Link from 'next/link'
import { Hammer, Plus } from 'lucide-react'
import { ProjectGrid } from '@/components/intuforge/ProjectGrid'
import { ForgeLeaderboard } from '@/components/intuforge/ForgeLeaderboard'
import { ForgeStatsBar } from '@/components/intuforge/ForgeStatsBar'
import { MOCK_PROJECTS } from '@/lib/forge/constants'
import { fetchForgeProjectsFromChain } from '@/lib/forge/data'
import type { ForgeStats, ForgeProject } from '@/lib/forge/types'
import { ForgeCategory } from '@/lib/forge/types'

export const revalidate = 60

function deriveStats(projects: ForgeProject[]): ForgeStats {
  const totalStaked     = projects.reduce((s, p) => s + p.totalStaked, 0)
  const totalStakers    = projects.reduce((s, p) => s + p.stakerCount, 0)
  const totalEvaluators = projects.reduce((s, p) => s + p.evaluatorCount, 0)
  const avgTrustScore   = projects.reduce((s, p) => s + p.finalScore, 0) / (projects.length || 1)

  const categoryCounts = Object.fromEntries(
    Object.values(ForgeCategory).map(c => [c, projects.filter(p => p.category === c).length])
  ) as Record<ForgeCategory, number>

  return {
    totalProjects: projects.length,
    totalStaked,
    totalStakers,
    totalEvaluators,
    categoryCounts,
    avgTrustScore: Math.round(avgTrustScore),
  }
}

async function getProjects(): Promise<{ projects: ForgeProject[]; isMock: boolean }> {
  // Try real on-chain data first
  const chainProjects = await fetchForgeProjectsFromChain(100)
  if (chainProjects.length > 0) {
    return { projects: chainProjects, isMock: false }
  }
  // Fall back to mock data (no on-chain projects yet or indexer unavailable)
  return { projects: MOCK_PROJECTS, isMock: true }
}

export default async function IntuforgePage() {
  const { projects, isMock: usingMockData } = await getProjects()
  const stats = deriveStats(projects)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.25)' }}
            >
              <Hammer className="w-4.5 h-4.5 text-[#C8963C]" />
            </div>
            <h1 className="text-2xl font-bold text-white">IntuForge</h1>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'rgba(200,150,60,0.12)', color: '#C8963C', border: '1px solid rgba(200,150,60,0.25)' }}
            >
              NEW
            </span>
          </div>
          <p className="text-sm text-white/40 max-w-md leading-relaxed">
            The Intuition Project Launchpad — discover, back, and build trust for projects in the
            Intuition ecosystem.
          </p>
          <div className="mt-3">
            <ForgeStatsBar stats={stats} />
          </div>
        </div>

        <Link
          href="/explore/intuforge/register"
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.02]"
          style={{
            background: 'rgba(200,150,60,0.12)',
            border: '1px solid rgba(200,150,60,0.3)',
            color: '#C8963C',
          }}
        >
          <Plus className="w-4 h-4" />
          List Your Project
        </Link>
      </div>

      {/* Mock data banner */}
      {usingMockData && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.15)',
            color: 'rgba(147,197,253,0.8)',
          }}
        >
          <span className="font-semibold">Demo mode:</span> These are example projects. List yours to join the leaderboard!
        </div>
      )}

      {/* Leaderboard */}
      <section>
        <ForgeLeaderboard projects={[...projects].sort((a, b) => b.finalScore - a.finalScore)} />
      </section>

      {/* Explore */}
      <section>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">
          Explore
        </h2>
        <ProjectGrid projects={projects} />
      </section>

      {/* Stats footer */}
      <div
        className="flex flex-wrap items-center gap-4 justify-center py-4 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}
      >
        <span className="text-xs">
          {stats.totalProjects} Listed · {stats.totalStakers} Stakers · {stats.totalEvaluators} Evaluators · Avg Score: {stats.avgTrustScore}
        </span>
      </div>
    </div>
  )
}
