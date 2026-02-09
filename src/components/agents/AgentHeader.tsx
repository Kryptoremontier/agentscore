'use client'

import { motion } from 'framer-motion'
import { Shield, ExternalLink, Copy, CheckCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { Agent } from '@/types/agent'

interface AgentHeaderProps {
  agent: Agent
}

export function AgentHeader({ agent }: AgentHeaderProps) {
  const isVerified = agent.verificationLevel !== 'none'

  const handleCopyAddress = () => {
    if (agent.walletAddress) {
      navigator.clipboard.writeText(agent.walletAddress)
      // TODO: Show toast notification
    }
  }

  const handleCopyAtomId = () => {
    navigator.clipboard.writeText(agent.atomId.toString())
    // TODO: Show toast notification
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
                {isVerified && (
                  <Badge variant="success" size="lg">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-text-secondary">
                <Badge variant="secondary">{agent.platform}</Badge>
                <span className="text-sm">
                  Registered {agent.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

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

            {/* Atom ID */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-muted">Atom ID:</span>
              <code className="font-mono text-text-secondary">
                {agent.atomId.toString()}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyAtomId}
                className="h-6 w-6 p-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Quick Stats */}
        <div className="lg:w-80">
          <div className="grid grid-cols-2 gap-4">
            {/* Attestations */}
            <div className="glass rounded-lg p-4 text-center">
              <p className="text-2xl font-bold font-mono">{agent.attestationCount}</p>
              <p className="text-sm text-text-muted">Attestations</p>
            </div>

            {/* Stakers */}
            <div className="glass rounded-lg p-4 text-center">
              <p className="text-2xl font-bold font-mono">{agent.stakerCount}</p>
              <p className="text-sm text-text-muted">Stakers</p>
            </div>

            {/* Total Stake */}
            <div className="glass rounded-lg p-4 text-center">
              <p className="text-2xl font-bold font-mono">
                ${formatStake(agent.positiveStake + agent.negativeStake)}
              </p>
              <p className="text-sm text-text-muted">Total Stake</p>
            </div>

            {/* Reports */}
            <div className={cn(
              "glass rounded-lg p-4 text-center",
              agent.reportCount > 0 && "border-trust-low"
            )}>
              <p className="text-2xl font-bold font-mono">{agent.reportCount}</p>
              <p className="text-sm text-text-muted">Reports</p>
            </div>
          </div>

          {/* Warning if high report count */}
          {agent.reportCount > 10 && (
            <div className="mt-4 p-3 rounded-lg bg-trust-low/10 border border-trust-low/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-trust-low flex-shrink-0 mt-0.5" />
              <p className="text-sm text-trust-low">
                This agent has received multiple reports. Exercise caution.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function formatStake(stake: bigint): string {
  const value = Number(stake) / 1e18 // Assuming 18 decimals
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(2)
}