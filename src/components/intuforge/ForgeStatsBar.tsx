'use client'

import type { ForgeStats } from '@/lib/forge/types'

interface ForgeStatsBarProps {
  stats: ForgeStats
}

export function ForgeStatsBar({ stats }: ForgeStatsBarProps) {
  const items = [
    { label: 'Projects', value: stats.totalProjects.toString() },
    { label: 'tTRUST Staked', value: stats.totalStaked.toFixed(2) },
    { label: 'Stakers', value: stats.totalStakers.toString() },
    { label: 'Evaluators', value: stats.totalEvaluators.toString() },
    { label: 'Avg Score', value: stats.avgTrustScore.toFixed(0) },
  ]

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2">
          {i > 0 && (
            <span className="hidden sm:inline w-px h-3.5 bg-white/10" />
          )}
          <span className="text-sm text-white/80 font-semibold tabular-nums">
            {item.value}
          </span>
          <span className="text-xs text-white/30">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
