'use client'

/**
 * AttestEmptyState — honest empty state as growth engine (thesis §6).
 *
 * Shown when an agent has ZERO attestations: instead of hiding the gap,
 * surface it as the reason to act — "be the first". Mounts the same
 * AttestButton flow as every other attest entry point.
 */

import { ShieldQuestion } from 'lucide-react'
import { AttestButton } from './AttestButton'

interface AttestEmptyStateProps {
  agentId: string
  agentName: string
  className?: string
}

export function AttestEmptyState({ agentId, agentName, className }: AttestEmptyStateProps) {
  return (
    <div
      className={`rounded-2xl p-5 ${className ?? ''}`}
      style={{ background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.35)' }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(139,92,246,0.12)' }}
        >
          <ShieldQuestion className="w-5 h-5" style={{ color: '#8B5CF6' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white mb-0.5">
            Unverified — no attestations yet
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Nobody has attested this agent&apos;s competence in any domain.
            Be the first — your stake becomes its first on-chain trust signal.
          </p>
        </div>
      </div>
      <AttestButton agentId={agentId} agentName={agentName} variant="hero" />
    </div>
  )
}
