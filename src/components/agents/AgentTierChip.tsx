'use client'

/**
 * The agent tier chip for the modal and /agents/[id] — attestations only
 * (thesis §6 "Agent tiers", lib/agent-tier.ts calculateAgentTier). Always
 * shown: the chip (Unverified / Trusted / Verified) and, below Verified, a
 * subtitle "1 of 3 people needed to verify". While the read is in flight:
 * "— of 3 people needed to verify". When it failed: says so — never a
 * default "Unverified".
 */

import { TrustTierBadge } from '@/components/agents/TrustTierBadge'
import { TooltipWrapper } from '@/components/ui/tooltip'
import { AGENT_TIER_LADDER, type AgentTierResult } from '@/lib/agent-tier'
import { TIER_TOOLTIP, TIER_UNREAD, tierProgress } from '@/lib/people-copy'

export function AgentTierChip({ tier, loading, size = 'md' }: {
  /** null = not known: loading, or the attestation read failed. */
  tier: AgentTierResult | null
  loading: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const needed = AGENT_TIER_LADDER.verified.minAttesters
  return (
    <TooltipWrapper content={TIER_TOOLTIP}>
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 cursor-help" data-testid="agent-tier-chip">
        {tier ? (
          <>
            <TrustTierBadge tier={tier.display} size={size} />
            {tier.tier !== 'verified' && (
              <span className="text-[10px] text-[#7A838D]" data-testid="tier-progress">{tierProgress(tier.attesters, needed)}</span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-[#7A838D]">
            {loading ? tierProgress(null, needed) : TIER_UNREAD}
          </span>
        )}
      </span>
    </TooltipWrapper>
  )
}
