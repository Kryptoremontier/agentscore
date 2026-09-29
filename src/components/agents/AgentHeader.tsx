'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Shield, ExternalLink, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Agent } from '@/types/agent'
import type { AgentTierResult } from '@/lib/agent-tier'
import { AgentTierChip } from '@/components/agents/AgentTierChip'
import { AtomIdLine } from '@/components/profile/AtomIdLine'

interface AgentHeaderProps {
  agent: Agent
  /** The agent tier (attestations only, lib/agent-tier.ts); null = loading or unknown. */
  tier: AgentTierResult | null
  tierLoading: boolean
  /** Primary action slot rendered directly under the agent name — the hero CTA. */
  action?: ReactNode
  /** The stat row + Backers line (components/profile/ProfileStatRow) — the modal's, full width. */
  stats?: ReactNode
}

export function AgentHeader({ agent, action, stats, tier, tierLoading }: AgentHeaderProps) {
  const handleCopyAddress = () => {
    if (agent.walletAddress) {
      navigator.clipboard.writeText(agent.walletAddress)
      // TODO: Show toast notification
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-8"
    >
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Agent Info */}
        <div className="flex-1">
          <div className="flex items-start gap-4 mb-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center flex-shrink-0">
              <Shield className="w-10 h-10 text-white" />
            </div>

            {/* Name & Platform */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{agent.name}</h1>
                {/* Was a "Verified" badge on every scored agent (verificationLevel is hardcoded
                    'wallet'). The tier comes only from attestations (thesis §6). */}
                <AgentTierChip tier={tier} loading={tierLoading} size="lg" />
              </div>

              <div className="flex items-center gap-3 text-text-secondary">
                <Badge variant="secondary">{agent.platform}</Badge>
                <span className="text-sm">
                  Registered {formatDate(agent.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Primary action — hero CTA under the name, above the fold */}
          {action && <div className="mb-6 sm:max-w-xs">{action}</div>}

          {/* Description */}
          {agent.description && (
            <p className="text-text-secondary mb-6">
              {agent.description}
            </p>
          )}

          {/* Addresses */}
          <div className="space-y-3">
            {/* Wallet Address */}
            {agent.walletAddress && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-text-muted">Wallet:</span>
                <code className="font-mono text-text-secondary">
                  {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAddress}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <a
                  href={`https://basescan.org/address/${agent.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            )}

            {/* Atom ID — shortened hex + copy-full, as the modal shows it (Etap 5a) */}
            <AtomIdLine termId={agent.id} />
          </div>
        </div>
      </div>

      {/* The modal's stat row and Backers line — same component, same data (Etap 5a) */}
      {stats && <div className="mt-6">{stats}</div>}
    </motion.div>
  )
}
