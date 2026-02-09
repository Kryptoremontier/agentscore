'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { getTrustLevel, getTrustColor, type TrustLevel } from '@/types/agent'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'

interface TrustScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  animated?: boolean
  className?: string
}

const sizeConfig = {
  sm: { container: 40, stroke: 3, fontSize: 'text-sm' },
  md: { container: 64, stroke: 4, fontSize: 'text-xl' },
  lg: { container: 100, stroke: 5, fontSize: 'text-3xl' },
  xl: { container: 160, stroke: 6, fontSize: 'text-5xl' },
}

export function TrustScoreBadge({
  score,
  size = 'md',
  showLabel = true,
  animated = true,
  className,
}: TrustScoreBadgeProps) {
  const level = getTrustLevel(score)
  const color = getTrustColor(level)
  const config = sizeConfig[size]

  const radius = (config.container - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center gap-2', className)} suppressHydrationWarning>
      <div
        className="relative"
        style={{ width: config.container, height: config.container }}
      >
        {/* Background ring */}
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${config.container} ${config.container}`}>
          <circle
            cx={config.container / 2}
            cy={config.container / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={config.stroke}
          />

          {/* Progress ring */}
          <motion.circle
            cx={config.container / 2}
            cy={config.container / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: animated ? 1 : 0, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 8px ${color})`,
            }}
          />
        </svg>

        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={cn('font-mono font-bold', config.fontSize)}
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {animated ? (
              <AnimatedNumber value={score} duration={1} />
            ) : (
              score
            )}
          </motion.span>
        </div>

        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full opacity-20 blur-xl"
          style={{ backgroundColor: color }}
        />
      </div>

      {showLabel && (
        <span className="text-sm text-text-secondary capitalize">
          {level} Trust
        </span>
      )}
    </div>
  )
}

