'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { TrustScoreBadge } from '@/components/trust/TrustScoreBadge'
import { getTrustLevel } from '@/types/agent'
import { cn } from '@/lib/cn'
import type { Agent } from '@/types/agent'

interface AgentStatsProps {
  agent: Agent
}

export function AgentStats({ agent }: AgentStatsProps) {
  const trustLevel = getTrustLevel(agent.trustScore)
  const netStake = Number(agent.positiveStake - agent.negativeStake) / 1e18
  const positivePercentage = agent.positiveStake + agent.negativeStake > BigInt(0)
    ? (Number(agent.positiveStake) / Number(agent.positiveStake + agent.negativeStake)) * 100
    : 50

  // Mock trend data (replace with real historical data)
  const trend = agent.trustScore > 70 ? 'up' : agent.trustScore < 30 ? 'down' : 'stable'
  const trendValue = trend === 'up' ? '+5.2' : trend === 'down' ? '-3.8' : '+0.0'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-xl p-8"
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Trust Score */}
        <div className="text-center lg:text-left">
          <h2 className="text-2xl font-bold mb-6">Trust Score</h2>

          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
            <TrustScoreBadge score={agent.trustScore} size="lg" />

            <div className="space-y-4 flex-1">
              {/* Trend */}
              <div className="flex items-center gap-2">
                {trend === 'up' && <TrendingUp className="w-5 h-5 text-trust-good" />}
                {trend === 'down' && <TrendingDown className="w-5 h-5 text-trust-critical" />}
                {trend === 'stable' && <Minus className="w-5 h-5 text-text-muted" />}
                <span className={cn(
                  "font-mono font-semibold",
                  trend === 'up' && "text-trust-good",
                  trend === 'down' && "text-trust-critical",
                  trend === 'stable' && "text-text-muted"
                )}>
                  {trendValue}%
                </span>
                <span className="text-sm text-text-muted">vs last week</span>
              </div>

              {/* Trust Level Description */}
              <div>
                <p className="text-sm text-text-muted mb-1">Trust Level</p>
                <p className="font-semibold capitalize">{trustLevel}</p>
              </div>

              {/* Percentile */}
              <div>
                <p className="text-sm text-text-muted mb-1">Percentile</p>
                <p className="font-semibold">
                  Top {100 - Math.floor(agent.trustScore * 0.8)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stake Breakdown */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Stake Breakdown</h2>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-trust-good">Positive</span>
              <span className="text-trust-critical">Negative</span>
            </div>
            <div className="h-8 bg-white/5 rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-trust-good to-trust-excellent"
                initial={{ width: 0 }}
                animate={{ width: `${positivePercentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium">
                  {positivePercentage.toFixed(1)}% positive
                </span>
              </div>
            </div>
          </div>

          {/* Stake Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-lg p-4">
              <p className="text-sm text-text-muted mb-1">Positive Stake</p>
              <p className="text-xl font-mono font-semibold text-trust-good">
                ${(Number(agent.positiveStake) / 1e18).toFixed(2)}
              </p>
            </div>
            <div className="glass rounded-lg p-4">
              <p className="text-sm text-text-muted mb-1">Negative Stake</p>
              <p className="text-xl font-mono font-semibold text-trust-critical">
                ${(Number(agent.negativeStake) / 1e18).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Net Stake */}
          <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-text-muted mb-1">Net Stake</p>
            <p className={cn(
              "text-2xl font-mono font-bold",
              netStake >= 0 ? "text-trust-good" : "text-trust-critical"
            )}>
              {netStake >= 0 ? '+' : ''}{netStake.toFixed(2)} $TRUST
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}