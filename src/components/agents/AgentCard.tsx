'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, ExternalLink, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AgentAvatar } from './AgentAvatar'
import type { Agent } from '@/types/agent'

interface AgentCardProps {
  agent: Agent
  index?: number
}

export function AgentCard({ agent, index = 0 }: AgentCardProps) {
  const trustColor = agent.trustScore >= 70
    ? 'text-emerald-400'
    : agent.trustScore >= 50
      ? 'text-amber-400'
      : 'text-red-400'

  const trustBg = agent.trustScore >= 70
    ? 'from-emerald-500/20 to-cyan-500/20'
    : agent.trustScore >= 50
      ? 'from-amber-500/20 to-orange-500/20'
      : 'from-red-500/20 to-rose-500/20'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link href={`/agents/${agent.id}`}>
        <div className={cn(
          'relative glass-card glass-card-hover p-6 h-full',
          'overflow-hidden'
        )}>
          {/* Gradient glow on hover */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            trustBg
          )} />

          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <AgentAvatar
                  avatar={agent.avatar}
                  name={agent.name}
                  size="md"
                  trustScore={agent.trustScore}
                  verified={agent.verificationLevel !== 'none'}
                />

                <div>
                  <h3 className="font-semibold text-lg group-hover:text-white transition-colors">
                    {agent.name}
                  </h3>
                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-white/5 rounded-full">
                    {agent.platform}
                  </span>
                </div>
              </div>

              {/* Trust Score */}
              <div className="text-right">
                <div className={cn('text-2xl font-bold font-mono', trustColor)}>
                  {agent.trustScore}
                </div>
                <div className="text-xs text-slate-500">Trust Score</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Stakes:</span>
                <span className="font-mono text-white">
                  ${formatNumber(Number(agent.positiveStake))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Attestations:</span>
                <span className="font-mono text-white">{agent.attestationCount}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
                'transition-colors'
              )}>
                <Shield className="w-4 h-4" />
                Trust
              </button>
              <span className="flex items-center gap-1 text-sm text-slate-400 group-hover:text-white transition-colors">
                View Details
                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}
