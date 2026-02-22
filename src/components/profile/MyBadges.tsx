'use client'

import { motion } from 'framer-motion'
import { Trophy, Lightbulb } from 'lucide-react'
import { BadgeGrid } from './BadgeDisplay'
import { BADGE_DEFINITIONS } from '@/lib/badges'
import type { UserBadge, ExpertLevel, UserStats } from '@/types/user'
import { cn } from '@/lib/cn'

interface MyBadgesProps {
  badges: UserBadge[]
  expertLevel: ExpertLevel
  stats: UserStats
}

const expertLevelInfo: Record<ExpertLevel, {
  gradient: string
  ring: string
  nextLevel?: string
  required?: number
  label: string
}> = {
  newcomer: {
    gradient: 'from-slate-400 to-slate-600',
    ring: 'ring-slate-500/30',
    nextLevel: 'contributor',
    required: 2,
    label: 'Just getting started',
  },
  contributor: {
    gradient: 'from-emerald-400 to-green-600',
    ring: 'ring-emerald-500/30',
    nextLevel: 'expert',
    required: 4,
    label: 'Active community member',
  },
  expert: {
    gradient: 'from-blue-400 to-cyan-600',
    ring: 'ring-blue-500/30',
    nextLevel: 'master',
    required: 7,
    label: 'Experienced evaluator',
  },
  master: {
    gradient: 'from-purple-400 to-violet-600',
    ring: 'ring-purple-500/30',
    nextLevel: 'legend',
    required: 10,
    label: 'Top-tier contributor',
  },
  legend: {
    gradient: 'from-yellow-400 to-amber-600',
    ring: 'ring-yellow-500/30',
    label: 'Maximum reputation reached',
  },
}

export function MyBadges({ badges, expertLevel, stats }: MyBadgesProps) {
  const levelInfo = expertLevelInfo[expertLevel]
  const progress = levelInfo.required
    ? Math.min(100, (badges.length / levelInfo.required) * 100)
    : 100

  return (
    <div className="space-y-6">
      {/* Expert Level Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('glass-card p-6 ring-1', levelInfo.ring)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Reputation Level</h3>
              <p className="text-xs text-slate-400">
                {badges.length} of {BADGE_DEFINITIONS.length} badges earned
              </p>
            </div>
          </div>
          <div className={cn(
            'px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-wider',
            'bg-gradient-to-r text-white shadow-lg',
            levelInfo.gradient
          )}>
            {expertLevel}
          </div>
        </div>

        <p className="text-sm text-slate-400 mb-4">{levelInfo.label}</p>

        {/* Progress to Next Level */}
        {levelInfo.nextLevel && (
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-500">
                Progress to <span className="capitalize text-slate-300">{levelInfo.nextLevel}</span>
              </span>
              <span className="font-mono font-medium text-slate-300">
                {badges.length} / {levelInfo.required}
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-primary to-accent-cyan rounded-full"
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
        <h3 className="text-lg font-semibold mb-6">All Badges</h3>
        <BadgeGrid
          earnedBadges={badges}
          showLocked={true}
          stats={stats}
        />
      </motion.div>

      {/* How to Earn */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 shrink-0">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold mb-3">How to Earn Badges</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BADGE_DEFINITIONS.map(def => {
                const earned = badges.find(b => b.type === def.id)
                return (
                  <div key={def.id} className={cn(
                    'flex items-center gap-2 text-sm p-2 rounded-lg',
                    earned ? 'text-slate-300 bg-white/[0.03]' : 'text-slate-500'
                  )}>
                    {earned
                      ? <span className="text-emerald-400">✓</span>
                      : <span className="text-slate-600">○</span>
                    }
                    <span className={earned ? 'line-through opacity-60' : ''}>{def.name}</span>
                    <span className="text-xs text-slate-600 ml-auto hidden sm:block">
                      {def.description.length > 30 ? def.description.slice(0, 30) + '...' : def.description}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
