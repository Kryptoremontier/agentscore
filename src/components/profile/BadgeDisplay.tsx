'use client'

import { motion } from 'framer-motion'
import {
  Award, Heart, Coins, ShieldCheck,
  Lock, Zap, Globe, Flag,
  Footprints, Blocks, Rocket, Crown,
  Check, Circle
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { BADGE_DEFINITIONS, badgeProgress, isBadgeEarned } from '@/lib/badges'
import type { UserBadge, UserStats, BadgeTier } from '@/types/user'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Award, Heart, Coins, ShieldCheck,
  Zap, Globe, Flag,
  Footprints, Blocks, Rocket, Crown,
}

const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  amber:   { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   text: 'text-amber-400',   glow: 'shadow-amber-500/25' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', glow: 'shadow-emerald-500/25' },
  pink:    { bg: 'bg-pink-500/20',    border: 'border-pink-500/40',    text: 'text-pink-400',    glow: 'shadow-pink-500/25' },
  cyan:    { bg: 'bg-cyan-500/20',    border: 'border-cyan-500/40',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/25' },
  blue:    { bg: 'bg-blue-500/20',    border: 'border-blue-500/40',    text: 'text-blue-400',    glow: 'shadow-blue-500/25' },
  violet:  { bg: 'bg-violet-500/20',  border: 'border-violet-500/40',  text: 'text-violet-400',  glow: 'shadow-violet-500/25' },
  green:   { bg: 'bg-green-500/20',   border: 'border-green-500/40',   text: 'text-green-400',   glow: 'shadow-green-500/25' },
  rose:    { bg: 'bg-rose-500/20',    border: 'border-rose-500/40',    text: 'text-rose-400',    glow: 'shadow-rose-500/25' },
  sky:     { bg: 'bg-sky-500/20',     border: 'border-sky-500/40',     text: 'text-sky-400',     glow: 'shadow-sky-500/25' },
  indigo:  { bg: 'bg-indigo-500/20',  border: 'border-indigo-500/40',  text: 'text-indigo-400',  glow: 'shadow-indigo-500/25' },
  yellow:  { bg: 'bg-yellow-500/20',  border: 'border-yellow-500/40',  text: 'text-yellow-400',  glow: 'shadow-yellow-500/25' },
  orange:  { bg: 'bg-orange-500/20',  border: 'border-orange-500/40',  text: 'text-orange-400',  glow: 'shadow-orange-500/25' },
  slate:   { bg: 'bg-slate-500/20',   border: 'border-slate-500/40',   text: 'text-slate-400',   glow: 'shadow-slate-500/25' },
  purple:  { bg: 'bg-purple-500/20',  border: 'border-purple-500/40',  text: 'text-purple-400',  glow: 'shadow-purple-500/25' },
}

const tierBorderColors: Record<BadgeTier, string> = {
  1: 'ring-slate-500/30',
  2: 'ring-amber-600/30',
  3: 'ring-slate-300/30',
  4: 'ring-yellow-500/30',
  5: 'ring-cyan-400/30',
  6: 'ring-violet-400/30',
}

interface BadgeDisplayProps {
  badge: UserBadge
  size?: 'sm' | 'md' | 'lg'
}

export function BadgeDisplay({ badge, size = 'md' }: BadgeDisplayProps) {
  const definition = BADGE_DEFINITIONS.find(d => d.id === badge.type)
  if (!definition) return null

  const Icon = iconComponents[definition.icon] || Award
  const colors = colorClasses[definition.color] || colorClasses['blue']!

  const sizeClasses = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-20 h-20' }
  const iconSizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-9 h-9' }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileHover={{ scale: 1.12, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'rounded-2xl flex items-center justify-center border cursor-pointer shadow-lg ring-1',
              colors.bg,
              colors.border,
              colors.glow,
              tierBorderColors[definition.tier],
              sizeClasses[size]
            )}
          >
            <Icon className={cn(iconSizes[size], colors.text)} />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <div className="text-center">
            <p className="font-semibold">{definition.name}</p>
            <p className="text-[10px] text-slate-500 mb-1">{definition.tierLabel}</p>
            <p className="text-xs text-slate-400">{definition.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface BadgeCardProps {
  def: typeof BADGE_DEFINITIONS[number]
  earned: UserBadge | undefined
  stats: UserStats
}

export function BadgeCard({ def, earned, stats }: BadgeCardProps) {
  const Icon = iconComponents[def.icon] || Award
  const colors = colorClasses[def.color] || colorClasses['blue']!
  const progress = badgeProgress(def, stats)
  const isEarned = !!earned

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-card p-5 transition-all',
        isEarned ? 'ring-1 ' + tierBorderColors[def.tier] : 'opacity-70'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border',
          isEarned ? colors.bg : 'bg-white/[0.03]',
          isEarned ? colors.border : 'border-white/[0.06]',
        )}>
          {isEarned
            ? <Icon className={cn('w-6 h-6', colors.text)} />
            : <Lock className="w-5 h-5 text-slate-600" />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              'font-semibold text-sm',
              isEarned ? 'text-white' : 'text-slate-400'
            )}>
              {def.name}
            </h4>
            {isEarned && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', colors.bg, colors.text)}>
                Earned
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mb-0.5">{def.tierLabel}</p>
          <p className="text-xs text-slate-400 mb-3">{def.description}</p>

          {/* Sub-requirements */}
          <div className="space-y-1.5">
            {def.requirements.map((req, i) => {
              const met = req.check(stats)
              const current = req.current(stats)
              const pct = Math.min(100, (current / req.target) * 100)

              return (
                <div key={i} className="flex items-center gap-2">
                  {met ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={met ? 'text-slate-300' : 'text-slate-500'}>{req.label}</span>
                      <span className={cn(
                        'font-mono',
                        met ? 'text-emerald-400' : 'text-slate-500'
                      )}>
                        {typeof current === 'number' && current < 100
                          ? Number.isInteger(current) ? current : current.toFixed(3)
                          : Math.round(current)
                        }/{req.target}{req.unit ? ` ${req.unit}` : ''}
                      </span>
                    </div>
                    {!met && (
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-primary/40 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Overall progress */}
          {!isEarned && progress > 0 && (
            <div className="mt-2 pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-slate-500">Overall progress</span>
                <span className="text-primary font-medium">{progress}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent-cyan rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

interface BadgeGridProps {
  earnedBadges: UserBadge[]
  showLocked?: boolean
  stats?: UserStats
}

export function BadgeGrid({ earnedBadges, showLocked = true, stats }: BadgeGridProps) {
  if (!stats) return null

  const grouped = BADGE_DEFINITIONS.reduce((acc, def) => {
    const tier = def.tier
    if (!acc[tier]) acc[tier] = []
    acc[tier].push(def)
    return acc
  }, {} as Record<number, typeof BADGE_DEFINITIONS>)

  return (
    <div className="space-y-8">
      {Object.entries(grouped)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([tier, defs]) => {
          const tierNum = Number(tier)
          const allEarned = defs.every(d => earnedBadges.some(b => b.type === d.id))
          const anyEarned = defs.some(d => earnedBadges.some(b => b.type === d.id))

          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  allEarned
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : anyEarned
                      ? 'bg-primary/15 text-primary'
                      : 'bg-white/5 text-slate-500'
                )}>
                  {defs[0].tierLabel}
                </span>
                {allEarned && (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {defs.map(def => {
                  const earned = earnedBadges.find(b => b.type === def.id)
                  if (!showLocked && !earned) return null
                  return <BadgeCard key={def.id} def={def} earned={earned} stats={stats} />
                })}
              </div>
            </div>
          )
        })}
    </div>
  )
}
