'use client'

import { motion } from 'framer-motion'
import { TrustScoreBadge } from '@/components/trust/TrustScoreBadge'
import { getTrustLevel } from '@/types/agent'
import { cn } from '@/lib/cn'
import { formatTTrust } from '@/lib/format'
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
  // Trend and percentile were removed here (thesis §6): "vs last week" was a
  // threshold on the current score, not an actual week-over-week delta, and
  // the only historical series available (/api/v1/agents/:id/timeline
  // scoreHistory) is itself a synthetic eased interpolation between an
  // assumed baseline of 50 and the current score — not real snapshots. No
  // cheap real source exists for either number; fabricating one under a
  // different name isn't a fix. Real trend needs actual periodic score
  // snapshots; real percentile needs a rank over all agents' scores.

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
              {/* Trust Level Description */}
              <div>
                <p className="text-sm text-text-muted mb-1">Trust Level</p>
                <p className="font-semibold capitalize">{trustLevel}</p>
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
                {formatTTrust(agent.positiveStake)}
              </p>
            </div>
            <div className="glass rounded-lg p-4">
              <p className="text-sm text-text-muted mb-1">Negative Stake</p>
              <p className="text-xl font-mono font-semibold text-trust-critical">
                {formatTTrust(agent.negativeStake)}
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
              {netStake >= 0 ? '+' : ''}{formatTTrust(netStake, { fromEther: true })}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}