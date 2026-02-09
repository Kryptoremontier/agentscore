'use client'

import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { EXPERT_WEIGHT } from '@/types/user'
import type { Attestation, AttestationPredicate } from '@/types/attestation'

interface AttestationCardProps {
  attestation: Attestation
  index?: number
}

const predicateConfig: Record<AttestationPredicate, {
  icon: any
  color: string
  label: string
}> = {
  trusts: {
    icon: ThumbsUp,
    color: 'text-trust-good',
    label: 'Trusts',
  },
  distrusts: {
    icon: ThumbsDown,
    color: 'text-trust-critical',
    label: 'Distrusts',
  },
  reported_for_scam: {
    icon: AlertTriangle,
    color: 'text-trust-critical',
    label: 'Reported for Scam',
  },
  reported_for_spam: {
    icon: AlertTriangle,
    color: 'text-trust-low',
    label: 'Reported for Spam',
  },
  reported_for_injection: {
    icon: AlertTriangle,
    color: 'text-trust-critical',
    label: 'Reported for Injection',
  },
  verified_by: {
    icon: CheckCircle,
    color: 'text-trust-excellent',
    label: 'Verified By',
  },
  vouches_for: {
    icon: CheckCircle,
    color: 'text-trust-good',
    label: 'Vouches For',
  },
}

export function AttestationCard({ attestation, index = 0 }: AttestationCardProps) {
  const config = predicateConfig[attestation.predicate]
  const Icon = config.icon
  const isPositive = ['trusts', 'verified_by', 'vouches_for'].includes(attestation.predicate)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass rounded-lg p-4"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          'p-2 rounded-lg',
          isPositive ? 'bg-trust-good/10' : 'bg-trust-critical/10'
        )}>
          <Icon className={cn('w-5 h-5', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">
                  <span className="text-text-secondary">
                    {attestation.staker.name || formatAddress(attestation.staker.address)}
                  </span>
                  {' '}
                  <span className={config.color}>{config.label.toLowerCase()}</span>
                  {' '}
                  <span className="text-text-secondary">this agent</span>
                </p>
                {attestation.staker.expertLevel && attestation.staker.expertLevel !== 'newcomer' && (
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full font-medium',
                    'bg-gradient-to-r text-white capitalize',
                    attestation.staker.expertLevel === 'legend' ? 'from-yellow-400 to-amber-600' :
                    attestation.staker.expertLevel === 'master' ? 'from-purple-400 to-violet-600' :
                    attestation.staker.expertLevel === 'expert' ? 'from-blue-400 to-cyan-600' :
                    'from-emerald-400 to-green-600'
                  )}>
                    {EXPERT_WEIGHT[attestation.staker.expertLevel]}x
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted mt-1">
                {attestation.createdAt.toLocaleDateString()} at{' '}
                {attestation.createdAt.toLocaleTimeString()}
              </p>
            </div>

            {/* Stake Amount */}
            <Badge
              variant={isPositive ? 'success' : 'destructive'}
              className="flex-shrink-0"
            >
              {isPositive ? '+' : '-'}{formatStake(attestation.stakeAmount)} $TRUST
            </Badge>
          </div>

          {/* Object */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Claim:</span>
            <Badge variant="outline" size="sm">
              {attestation.object.label}
            </Badge>
          </div>

          {/* Transaction Link */}
          <a
            href={`https://basescan.org/tx/${attestation.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover mt-2"
          >
            View transaction
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  )
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatStake(stake: bigint): string {
  const value = Number(stake) / 1e18
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(2)
}