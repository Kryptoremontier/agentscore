'use client'

import { EVALUATOR_TIER_CONFIG, type EvaluatorProfile, type EvaluatorTier } from '@/lib/evaluator-score'
import { cn } from '@/lib/cn'

interface EvaluatorBadgeProps {
  profile: EvaluatorProfile
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * EvaluatorBadge — compact pill showing evaluator tier, accuracy, and weight.
 *
 * sm  → icon + tier name only (for staker lists)
 * md  → icon + tier + accuracy% (for profile)
 * lg  → full with weight multiplier (for leaderboard)
 */
export function EvaluatorBadge({ profile, size = 'md', className }: EvaluatorBadgeProps) {
  const cfg = EVALUATOR_TIER_CONFIG[profile.evaluatorTier]
  const accuracyPct = Math.round(profile.adjustedAccuracy * 100)
  const weightColor = getWeightColor(profile.evaluatorWeight)

  const tooltipText = [
    `${cfg.icon} ${cfg.label} evaluator`,
    `${accuracyPct}% accuracy across ${profile.totalPositions} evaluation${profile.totalPositions !== 1 ? 's' : ''}`,
    `Staking weight: ${profile.evaluatorWeight.toFixed(2)}x`,
    profile.streakCount > 1 ? `${profile.streakCount} pick streak` : '',
  ].filter(Boolean).join(' · ')

  return (
    <span
      title={tooltipText}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium select-none',
        cfg.bgColor,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs',
        className,
      )}
    >
      <span>{cfg.icon}</span>
      <span className={cfg.color}>{cfg.label}</span>

      {size !== 'sm' && (
        <span className="text-white/40">·</span>
      )}
      {size !== 'sm' && (
        <span className={cfg.color}>{accuracyPct}%</span>
      )}

      {size === 'lg' && (
        <>
          <span className="text-white/40">·</span>
          <span className={weightColor}>{profile.evaluatorWeight.toFixed(2)}x</span>
        </>
      )}
    </span>
  )
}

function getWeightColor(weight: number): string {
  if (weight >= 1.3) return 'text-emerald-400'
  if (weight >= 1.1) return 'text-amber-400'
  if (weight >= 1.0) return 'text-white/60'
  return 'text-red-400'
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function EvaluatorBadgeSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full animate-pulse bg-white/5',
        size === 'sm' ? 'w-16 h-4' : size === 'md' ? 'w-24 h-5' : 'w-32 h-6',
      )}
    />
  )
}
