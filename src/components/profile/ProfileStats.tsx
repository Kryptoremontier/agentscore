'use client'

import { motion } from 'framer-motion'
import { Bot, Zap, MessageSquare, TrendingUp, Shield, Award } from 'lucide-react'
import type { UserStats, UserBadge } from '@/types/user'

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

function reputationColor(rep: number): string {
  if (rep >= 80) return '#2ECC71'
  if (rep >= 60) return '#C8963C'
  if (rep >= 40) return '#EAB308'
  return '#7A838D'
}

export function ProfileStats({ stats, badges }: ProfileStatsProps) {
  const items = [
    { icon: Bot,          label: 'Agents',     sub: 'Registered', value: stats.totalAgentsRegistered },
    { icon: Zap,          label: 'Skills',     sub: 'Registered', value: stats.totalSkillsRegistered },
    { icon: MessageSquare,label: 'Claims',     sub: 'Created',    value: stats.totalClaimsCreated },
    { icon: TrendingUp,   label: 'Staked',     sub: 'tTRUST',     value: formatStaked(stats.totalTrustStaked) },
    { icon: Shield,       label: 'Positions',  sub: 'Active',     value: stats.totalPositions },
    { icon: Award,        label: 'Reputation', sub: 'Score',      value: stats.reputation,
      valueColor: reputationColor(stats.reputation) },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="rounded-xl mb-5 overflow-hidden"
      style={{ background: 'rgba(13,15,17,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0"
        style={{ '--tw-divide-opacity': 1, borderColor: 'rgba(255,255,255,0.06)' } as React.CSSProperties}>
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center justify-center gap-1 py-4 px-3"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <item.icon className="w-3.5 h-3.5 mb-0.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <span
              className="text-xl font-bold font-mono leading-none tabular-nums"
              style={{ color: item.valueColor ?? 'rgba(255,255,255,0.85)' }}
            >
              {item.value}
            </span>
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {item.label}
            </span>
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
              {item.sub}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
