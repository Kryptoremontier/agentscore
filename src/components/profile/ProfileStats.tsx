'use client'

import { motion } from 'framer-motion'
import { Shield, TrendingUp, Zap, Award } from 'lucide-react'
import type { UserStats, UserBadge } from '@/types/user'
import { cn } from '@/lib/cn'

interface ProfileStatsProps {
  stats: UserStats
  badges: UserBadge[]
}

function formatStaked(raw: bigint): string {
  const val = Number(raw) / 1e18
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  if (val >= 1) return val.toFixed(2)
  if (val > 0) return val.toFixed(4)
  return '0'
}

function getReputationColor(rep: number): string {
  if (rep >= 80) return 'text-emerald-400'
  if (rep >= 60) return 'text-cyan-400'
  if (rep >= 40) return 'text-amber-400'
  return 'text-rose-400'
}

export function ProfileStats({ stats, badges }: ProfileStatsProps) {
  const items = [
    {
      icon: Shield,
      iconColor: 'text-primary',
      label: 'Agents',
      value: stats.totalAgentsRegistered.toString(),
      sub: 'Registered',
    },
    {
      icon: TrendingUp,
      iconColor: 'text-emerald-400',
      label: 'Staked',
      value: formatStaked(stats.totalTrustStaked),
      sub: 'tTRUST',
      valueColor: 'text-emerald-400',
    },
    {
      icon: Zap,
      iconColor: 'text-cyan-400',
      label: 'Attestations',
      value: stats.totalAttestations.toString(),
      sub: 'Made',
    },
    {
      icon: Award,
      iconColor: 'text-amber-400',
      label: 'Reputation',
      value: stats.reputation.toString(),
      sub: 'Score',
      valueColor: getReputationColor(stats.reputation),
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
    >
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <item.icon className={cn('w-5 h-5', item.iconColor)} />
            <span className="text-sm text-slate-400">{item.label}</span>
          </div>
          <div className={cn('text-3xl font-bold font-mono', item.valueColor)}>
            {item.value}
          </div>
          <div className="text-xs text-slate-500 mt-1">{item.sub}</div>
        </motion.div>
      ))}
    </motion.div>
  )
}
