'use client'

import { motion } from 'framer-motion'
import { Trophy, TrendingUp } from 'lucide-react'
import { BadgeGrid, BadgeDisplay } from './BadgeDisplay'
import { BADGE_DEFINITIONS, TIER_LABELS } from '@/lib/badges'
import type { UserBadge, ExpertLevel, UserStats, BadgeTier } from '@/types/user'

const EXPERT_LEVEL_LABEL: Record<ExpertLevel, string> = {
  newcomer:    'Just getting started',
  contributor: 'Active community member',
  expert:      'Established evaluator',
  master:      'Top-tier contributor',
  legend:      'Maximum reputation achieved',
}

interface MyBadgesProps {
  badges: UserBadge[]
  expertLevel: ExpertLevel
  stats: UserStats
}

export function MyBadges({ badges, expertLevel, stats }: MyBadgesProps) {
  const totalBadges = BADGE_DEFINITIONS.length
  const highestTier = badges.length > 0 ? Math.max(...badges.map(b => b.tier)) : 0

  const summaryStats = [
    { value: `${badges.length}/${totalBadges}`, label: 'Earned' },
    { value: highestTier > 0 ? `T${highestTier}` : '–', label: highestTier > 0 ? `${TIER_LABELS[highestTier as BadgeTier].name}` : 'Tier' },
    { value: stats.daysActive,    label: 'Days Active' },
    { value: stats.totalSignals,  label: 'Signals' },
  ]

  const detailStats = [
    { label: 'Agents',     value: stats.totalAgentsRegistered },
    { label: 'Signals',    value: stats.totalSignals },
    { label: 'Positions',  value: stats.totalPositions },
    { label: 'Support',    value: stats.agentsSupported },
    { label: 'Staked',     value: `${stats.tTrustStakedNum >= 1 ? stats.tTrustStakedNum.toFixed(2) : stats.tTrustStakedNum.toFixed(4)} tTRUST` },
    { label: 'Reports',    value: stats.reportsSubmitted },
    { label: 'Days active',value: stats.daysActive },
    { label: 'Reputation', value: stats.reputation },
  ]

  return (
    <div className="space-y-5">
      {/* Level + Summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5"
        style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.25)' }}
            >
              <Trophy className="w-4.5 h-4.5 text-[#C8963C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Reputation Level</h3>
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.25)', color: '#C8963C' }}
                >
                  {expertLevel}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {EXPERT_LEVEL_LABEL[expertLevel]}
              </p>
            </div>
          </div>

          {badges.length > 0 && (
            <div className="flex items-center gap-1.5">
              {badges.slice(0, 5).map(badge => (
                <BadgeDisplay key={badge.id} badge={badge} size="sm" />
              ))}
              {badges.length > 5 && (
                <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>+{badges.length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div
          className="flex divide-x rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {summaryStats.map(s => (
            <div key={s.label} className="flex-1 text-center py-3 px-2"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-base font-bold font-mono tabular-nums text-white leading-none">{s.value}</div>
              <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Your Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl p-5"
        style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <span>Your Stats</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2.5 text-xs">
          {detailStats.map(s => (
            <div key={s.label} className="flex justify-between items-center">
              <span style={{ color: 'rgba(255,255,255,0.38)' }}>{s.label}</span>
              <span className="font-mono text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* All Badges */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>All Badges</h3>
        <BadgeGrid
          earnedBadges={badges}
          showLocked={true}
          stats={stats}
        />
      </motion.div>
    </div>
  )
}
