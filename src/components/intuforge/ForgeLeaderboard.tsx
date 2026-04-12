'use client'

import { useRouter } from 'next/navigation'
import { Crown, Shield, Award, Trophy } from 'lucide-react'
import type { ForgeProject } from '@/lib/forge/types'

const RANK_CONFIG = [
  {
    icon: Crown,
    color: '#C8963C',
    bg: 'rgba(200,150,60,0.12)',
    border: 'rgba(200,150,60,0.28)',
    barColor: '#C8963C',
  },
  {
    icon: Shield,
    color: '#B5BDC6',
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.14)',
    barColor: '#7A838D',
  },
  {
    icon: Award,
    color: '#9C7A5B',
    bg: 'rgba(156,122,91,0.10)',
    border: 'rgba(156,122,91,0.22)',
    barColor: '#9C7A5B',
  },
]

interface ForgeLeaderboardProps {
  projects: ForgeProject[]
}

export function ForgeLeaderboard({ projects }: ForgeLeaderboardProps) {
  const router = useRouter()
  const top3 = projects.slice(0, 3)

  if (top3.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Trophy className="w-4 h-4 text-[#C8963C]" />
        <h2 className="text-sm font-semibold text-white">Top Projects</h2>
      </div>

      <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
        {top3.map((project, i) => {
          const cfg = RANK_CONFIG[i]
          const Icon = cfg.icon
          return (
            <div
              key={project.id}
              onClick={() => router.push(`/explore/intuforge/${project.id}`)}
              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.03]"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              {/* Rank icon */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
              </div>

              {/* Name */}
              <span className="flex-1 text-sm font-medium text-white truncate">
                {project.name}
              </span>

              {/* Score bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${project.finalScore}%`, background: cfg.barColor }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: cfg.barColor }}>
                  {project.finalScore}
                </span>
              </div>

              <span className="text-[11px] shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {project.stakerCount} stakers
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
