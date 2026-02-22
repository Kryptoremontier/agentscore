'use client'

import { motion } from 'framer-motion'
import { Trophy, TrendingUp } from 'lucide-react'
import { BadgeGrid, BadgeDisplay } from './BadgeDisplay'
import { BADGE_DEFINITIONS, TIER_LABELS } from '@/lib/badges'
import type { UserBadge, ExpertLevel, UserStats, BadgeTier } from '@/types/user'
import { cn } from '@/lib/cn'

interface MyBadgesProps {
  badges: UserBadge[]
  expertLevel: ExpertLevel
  stats: UserStats
}

const expertLevelInfo: Record<ExpertLevel, {
  gradient: string
  ring: string
  label: string
}> = {
  newcomer: {
    gradient: 'from-slate-400 to-slate-600',
    ring: 'ring-slate-500/30',
    label: 'Just getting started',
  },
  contributor: {
    gradient: 'from-emerald-400 to-green-600',
    ring: 'ring-emerald-500/30',
    label: 'Active community member',
  },
  expert: {
    gradient: 'from-blue-400 to-cyan-600',
    ring: 'ring-blue-500/30',
    label: 'Established evaluator',
  },
  master: {
    gradient: 'from-purple-400 to-violet-600',
    ring: 'ring-purple-500/30',
    label: 'Top-tier contributor',
  },
  legend: {
    gradient: 'from-yellow-400 to-amber-600',
    ring: 'ring-yellow-500/30',
    label: 'Maximum reputation achieved',
  },
}

export function MyBadges({ badges, expertLevel, stats }: MyBadgesProps) {
  const levelInfo = expertLevelInfo[expertLevel]
  const totalBadges = BADGE_DEFINITIONS.length
  const highestTier = badges.length > 0
    ? Math.max(...badges.map(b => b.tier))
    : 0

  return (
    <div className="space-y-6">
      {/* Level + Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('glass-card p-6 ring-1', levelInfo.ring)}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/5">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Reputation Level</h3>
                <div className={cn(
                  'px-3 py-1 rounded-lg font-bold text-xs uppercase tracking-wider',
                  'bg-gradient-to-r text-white shadow-lg',
                  levelInfo.gradient
                )}>
                  {expertLevel}
                </div>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{levelInfo.label}</p>
            </div>
          </div>

          {/* Earned badges mini-display */}
          {badges.length > 0 && (
            <div className="flex items-center gap-1.5">
              {badges.slice(0, 5).map(badge => (
                <BadgeDisplay key={badge.id} badge={badge} size="sm" />
              ))}
              {badges.length > 5 && (
                <span className="text-xs text-slate-500 ml-1">+{badges.length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/[0.06]">
          <div className="text-center">
            <div className="text-xl font-bold font-mono text-emerald-400">{badges.length}</div>
            <div className="text-[10px] text-slate-500">of {totalBadges} earned</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold font-mono">
              {highestTier > 0 ? `T${highestTier}` : '–'}
            </div>
            <div className="text-[10px] text-slate-500">
              Highest tier{highestTier > 0 ? ` · ${TIER_LABELS[highestTier as BadgeTier].name}` : ''}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold font-mono">{stats.daysActive}</div>
            <div className="text-[10px] text-slate-500">days active</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold font-mono">{stats.totalSignals}</div>
            <div className="text-[10px] text-slate-500">on-chain signals</div>
          </div>
        </div>
      </motion.div>

      {/* Your Stats for Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-5"
      >
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Your Stats
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Agents</span>
            <span className="font-mono">{stats.totalAgentsRegistered}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Signals</span>
            <span className="font-mono">{stats.totalSignals}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Positions</span>
            <span className="font-mono">{stats.totalPositions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Support</span>
            <span className="font-mono">{stats.agentsSupported}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Staked</span>
            <span className="font-mono">{stats.tTrustStakedNum >= 1 ? stats.tTrustStakedNum.toFixed(2) : stats.tTrustStakedNum.toFixed(4)} tTRUST</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reports</span>
            <span className="font-mono">{stats.reportsSubmitted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Days active</span>
            <span className="font-mono">{stats.daysActive}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reputation</span>
            <span className="font-mono">{stats.reputation}</span>
          </div>
        </div>
      </motion.div>

      {/* All Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="text-lg font-semibold mb-5">All Badges</h3>
        <BadgeGrid
          earnedBadges={badges}
          showLocked={true}
          stats={stats}
        />
      </motion.div>
    </div>
  )
}
