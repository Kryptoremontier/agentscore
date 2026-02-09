'use client'

import { motion } from 'framer-motion'
import {
  Sparkles, Award, Heart, Cpu, Coins, Users, ShieldCheck,
  Lock
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { BADGE_DEFINITIONS } from '@/lib/badges'
import type { UserBadge, UserStats } from '@/types/user'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles, Award, Heart, Cpu, Coins, Users, ShieldCheck,
}

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
}

interface BadgeDisplayProps {
  badge: UserBadge
  size?: 'sm' | 'md' | 'lg'
}

export function BadgeDisplay({ badge, size = 'md' }: BadgeDisplayProps) {
  const definition = BADGE_DEFINITIONS.find(d => d.id === badge.type)
  if (!definition) return null

  const Icon = iconComponents[definition.icon] || Award
  const colors = colorClasses[definition.color] || colorClasses['blue'] || {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400'
  }

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={cn(
              'rounded-xl flex items-center justify-center border',
              colors.bg,
              colors.border,
              sizeClasses[size]
            )}
          >
            <Icon className={cn(iconSizes[size], colors.text)} />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-semibold">{definition.name}</p>
            <p className="text-xs text-slate-400">{definition.description}</p>
            <p className="text-xs text-slate-500 mt-1">
              Earned {new Date(badge.earnedAt).toLocaleDateString()}
            </p>
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
    <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
      {BADGE_DEFINITIONS.map((def) => {
        const earned = earnedBadges.find(b => b.type === def.id)

        if (earned) {
          return <BadgeDisplay key={def.id} badge={earned} />
        }

        if (!showLocked) return null

        // Locked badge
        const progress = stats && def.progress ? def.progress(stats) : 0

        return (
          <TooltipProvider key={def.id}>
            <Tooltip>
              <TooltipTrigger>
                <div className="relative">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    'bg-white/5 border border-white/10 opacity-40'
                  )}>
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                  {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
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
