'use client'

import { motion } from 'framer-motion'
import { Shield, TrendingUp, Award, Users } from 'lucide-react'
import type { UserStats, UserBadge } from '@/types/user'

interface ProfileStatsProps {
  stats: UserStats
  badges: UserBadge[]
}

export function ProfileStats({ stats, badges }: ProfileStatsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
    >
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-sm text-slate-400">Agents</span>
        </div>
        <div className="text-3xl font-bold font-mono">{stats.totalAgentsRegistered}</div>
        <div className="text-xs text-slate-500 mt-1">Registered</div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <span className="text-sm text-slate-400">Staked</span>
        </div>
        <div className="text-3xl font-bold font-mono text-emerald-400">
          {(Number(stats.totalTrustStaked) / 1e18).toFixed(1)}K
        </div>
        <div className="text-xs text-slate-500 mt-1">$TRUST</div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <span className="text-sm text-slate-400">Attestations</span>
        </div>
        <div className="text-3xl font-bold font-mono">{stats.totalAttestations}</div>
        <div className="text-xs text-slate-500 mt-1">Made</div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-slate-400">Reputation</span>
        </div>
        <div className="text-3xl font-bold font-mono text-amber-400">{stats.reputation}</div>
        <div className="text-xs text-slate-500 mt-1">Score</div>
      </div>
    </motion.div>
  )
}
