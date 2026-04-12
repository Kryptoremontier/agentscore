import Link from 'next/link'
import { Hammer, Plus } from 'lucide-react'
import { ProjectGrid } from '@/components/intuforge/ProjectGrid'
import { ForgeLeaderboard } from '@/components/intuforge/ForgeLeaderboard'
import { ForgeStatsBar } from '@/components/intuforge/ForgeStatsBar'
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

export default async function IntuforgePage() {
  const projects = await fetchForgeProjectsFromChain(100)
  const stats = deriveStats(projects)

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-8 space-y-8">
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
              Alpha
            </span>
          </div>
          <p className="text-sm text-white/40 max-w-md leading-relaxed">
            The Intuition Project Launchpad — discover, back, and build trust for projects in the
            Intuition ecosystem.
          </p>
          {projects.length > 0 && (
            <div className="mt-3">
              <ForgeStatsBar stats={stats} />
            </div>
          )}
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

      {projects.length === 0 ? (
        /* Empty state — no projects on-chain yet */
        <div className="py-24 text-center space-y-4">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
            style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.15)' }}
          >
            <Hammer className="w-7 h-7 text-[#C8963C]/50" />
          </div>
          <p className="text-white/40 text-base font-medium">No projects listed yet</p>
          <p className="text-white/20 text-sm max-w-sm mx-auto leading-relaxed">
            IntuForge is live on Intuition Testnet. Be the first to register your project and build on-chain trust.
          </p>
          <Link
            href="/explore/intuforge/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-2 transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(200,150,60,0.12)',
              border: '1px solid rgba(200,150,60,0.3)',
              color: '#C8963C',
            }}
          >
            <Plus className="w-4 h-4" />
            Register First Project
          </Link>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
