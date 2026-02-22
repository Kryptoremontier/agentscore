'use client'

import { motion } from 'framer-motion'
import {
  Sparkles, Award, Heart, Cpu, Coins, Users, ShieldCheck,
  Lock, ThumbsUp, ShieldAlert, Zap, MessageCircle, Flag,
  Footprints, Blocks
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { BADGE_DEFINITIONS } from '@/lib/badges'
import type { UserBadge, UserStats } from '@/types/user'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles, Award, Heart, Cpu, Coins, Users, ShieldCheck,
  ThumbsUp, ShieldAlert, Zap, MessageCircle, Flag,
  Footprints, Blocks,
}

const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  amber:   { bg: 'bg-amber-500/20',   border: 'border-amber-500/30',   text: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  pink:    { bg: 'bg-pink-500/20',    border: 'border-pink-500/30',    text: 'text-pink-400',    glow: 'shadow-pink-500/20' },
  cyan:    { bg: 'bg-cyan-500/20',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20' },
  blue:    { bg: 'bg-blue-500/20',    border: 'border-blue-500/30',    text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  violet:  { bg: 'bg-violet-500/20',  border: 'border-violet-500/30',  text: 'text-violet-400',  glow: 'shadow-violet-500/20' },
  green:   { bg: 'bg-green-500/20',   border: 'border-green-500/30',   text: 'text-green-400',   glow: 'shadow-green-500/20' },
  rose:    { bg: 'bg-rose-500/20',    border: 'border-rose-500/30',    text: 'text-rose-400',    glow: 'shadow-rose-500/20' },
  sky:     { bg: 'bg-sky-500/20',     border: 'border-sky-500/30',     text: 'text-sky-400',     glow: 'shadow-sky-500/20' },
  indigo:  { bg: 'bg-indigo-500/20',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  glow: 'shadow-indigo-500/20' },
  yellow:  { bg: 'bg-yellow-500/20',  border: 'border-yellow-500/30',  text: 'text-yellow-400',  glow: 'shadow-yellow-500/20' },
  orange:  { bg: 'bg-orange-500/20',  border: 'border-orange-500/30',  text: 'text-orange-400',  glow: 'shadow-orange-500/20' },
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
              'rounded-2xl flex items-center justify-center border cursor-pointer shadow-lg',
              colors.bg,
              colors.border,
              colors.glow,
              sizeClasses[size]
            )}
          >
            <Icon className={cn(iconSizes[size], colors.text)} />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="text-center">
            <p className="font-semibold">{definition.name}</p>
            <p className="text-xs text-slate-400">{definition.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface BadgeGridProps {
  earnedBadges: UserBadge[]
  showLocked?: boolean
  stats?: UserStats
}

export function BadgeGrid({ earnedBadges, showLocked = true, stats }: BadgeGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-5">
      {BADGE_DEFINITIONS.map((def) => {
        const earned = earnedBadges.find(b => b.type === def.id)

        if (earned) {
          return (
            <div key={def.id} className="flex flex-col items-center gap-2">
              <BadgeDisplay badge={earned} />
              <span className="text-[11px] text-slate-300 font-medium text-center leading-tight">
                {def.name}
              </span>
            </div>
          )
        }

        if (!showLocked) return null

        const progress = stats && def.progress ? def.progress(stats) : 0
        const Icon = iconComponents[def.icon] || Award

        return (
          <TooltipProvider key={def.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center',
                      'bg-white/[0.03] border border-white/[0.06] opacity-50'
                    )}>
                      <Lock className="w-5 h-5 text-slate-600" />
                    </div>
                    {progress > 0 && (
                      <div className="absolute -bottom-1 left-1 right-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 transition-all duration-300 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600 text-center leading-tight">
                    {def.name}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <div className="text-center">
                  <p className="font-semibold text-slate-400">{def.name}</p>
                  <p className="text-xs text-slate-500">{def.description}</p>
                  {progress > 0 && (
                    <p className="text-xs text-primary mt-1">{Math.round(progress)}% complete</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}
