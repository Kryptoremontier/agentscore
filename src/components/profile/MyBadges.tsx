'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Target } from 'lucide-react'
import { BadgeGrid } from './BadgeDisplay'
import { checkEarnedBadges, BADGE_DEFINITIONS } from '@/lib/badges'
import type { UserBadge, ExpertLevel, UserStats } from '@/types/user'
import { cn } from '@/lib/cn'

interface MyBadgesProps {
  badges: UserBadge[]
  expertLevel: ExpertLevel
  stats: UserStats
}

const expertLevelInfo: Record<ExpertLevel, { color: string; gradient: string; nextLevel?: string; required?: number }> = {
  newcomer: { color: 'slate', gradient: 'from-slate-400 to-slate-600', nextLevel: 'contributor', required: 1 },
  contributor: { color: 'emerald', gradient: 'from-emerald-400 to-green-600', nextLevel: 'expert', required: 3 },
  expert: { color: 'blue', gradient: 'from-blue-400 to-cyan-600', nextLevel: 'master', required: 5 },
  master: { color: 'purple', gradient: 'from-purple-400 to-violet-600', nextLevel: 'legend', required: 6 },
  legend: { color: 'yellow', gradient: 'from-yellow-400 to-amber-600' },
}

export function MyBadges({ badges, expertLevel, stats }: MyBadgesProps) {
  const levelInfo = expertLevelInfo[expertLevel]
  const earnableNow = checkEarnedBadges(stats, badges)

  return (
    <div className="space-y-6">
      {/* Expert Level Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Expert Level</h3>
            <p className="text-sm text-slate-400">
              {badges.length} of {BADGE_DEFINITIONS.length} badges earned
            </p>
          </div>
          <div className={cn(
            'px-4 py-2 rounded-lg font-bold text-lg capitalize',
            'bg-gradient-to-r text-white',
            levelInfo.gradient
          )}>
            {expertLevel}
          </div>
        </div>

        {/* Progress to Next Level */}
        {levelInfo.nextLevel && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">
                Progress to {levelInfo.nextLevel}
              </span>
              <span className="font-medium">
                {badges.length} / {levelInfo.required}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent-cyan transition-all duration-500"
                style={{ width: `${Math.min(100, (badges.length / (levelInfo.required || 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Badges Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">All Badges</h3>
          {earnableNow.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
              <Target className="w-4 h-4" />
              {earnableNow.length} ready to claim
            </div>
          )}
        </div>

        <BadgeGrid
          earnedBadges={badges}
          showLocked={true}
          stats={stats}
        />
      </motion.div>

      {/* Badge Tips */}
      {badges.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-2">How to Earn Badges</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Register your first agent to earn Agent Creator</li>
                <li>• Support 50+ agents to earn Prolific Supporter</li>
                <li>• Make 100+ attestations to earn Community Pillar</li>
                <li>• Stake 10K+ $TRUST to earn Whale</li>
                <li>• Achieve 90+ reputation to earn Trusted Expert</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
