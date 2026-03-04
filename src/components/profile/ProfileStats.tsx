'use client'

import { motion } from 'framer-motion'
import { Shield, TrendingUp, Zap, Award, Bot, MessageSquare } from 'lucide-react'
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

const STAT_CARDS = (stats: UserStats, badges: UserBadge[]) => [
  {
    icon: Bot,
    label: 'Agents',
    value: stats.totalAgentsRegistered,
    sub: 'Registered',
    color: '#C8963C',
    bg: 'rgba(200,150,60,0.10)',
    border: 'rgba(200,150,60,0.25)',
  },
  {
    icon: Zap,
    label: 'Skills',
    value: stats.totalSkillsRegistered,
    sub: 'Registered',
    color: '#2EE6D6',
    bg: 'rgba(46,230,214,0.08)',
    border: 'rgba(46,230,214,0.20)',
  },
  {
    icon: MessageSquare,
    label: 'Claims',
    value: stats.totalClaimsCreated,
    sub: 'Created',
    color: '#38B6FF',
    bg: 'rgba(56,182,255,0.08)',
    border: 'rgba(56,182,255,0.20)',
  },
  {
    icon: TrendingUp,
    label: 'Staked',
    value: formatStaked(stats.totalTrustStaked),
    sub: 'tTRUST',
    color: '#4ADE80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.20)',
  },
  {
    icon: Shield,
    label: 'Positions',
    value: stats.totalPositions,
    sub: 'Active',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.20)',
  },
  {
    icon: Award,
    label: 'Reputation',
    value: stats.reputation,
    sub: 'Score',
    color: stats.reputation >= 80 ? '#4ADE80' : stats.reputation >= 60 ? '#2EE6D6' : '#C8963C',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
  },
]

export function ProfileStats({ stats, badges }: ProfileStatsProps) {
  const cards = STAT_CARDS(stats, badges)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 + i * 0.04 }}
          className="rounded-2xl p-4 text-center"
          style={{ background: card.bg, border: `1px solid ${card.border}` }}
        >
          <card.icon className="w-4 h-4 mx-auto mb-2" style={{ color: card.color }} />
          <div className="text-2xl font-bold font-mono leading-none" style={{ color: card.color }}>
            {card.value}
          </div>
          <div className="text-[10px] text-[#7A838D] mt-1">{card.label}</div>
          <div className="text-[9px] text-[#4A5260]">{card.sub}</div>
        </motion.div>
      ))}
    </motion.div>
  )
}
