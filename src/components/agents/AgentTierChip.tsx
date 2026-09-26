'use client'

/**
 * The agent tier chip for the modal and /agents/[id] — attestations only
 * (thesis §6 "Agent tiers", lib/agent-tier.ts calculateAgentTier). Always
 * shown: "Unverified · 1/3 attesters", "Trusted · 2/3 attesters", "Verified".
 * While the attestation read is in flight: "—/3 attesters". When it failed:
 * says so — never a default "Unverified".
 */

import { TrustTierBadge } from '@/components/agents/TrustTierBadge'
import { TooltipWrapper } from '@/components/ui/tooltip'
import { AGENT_TIER_LADDER, AGENT_TIER_TOOLTIP, type AgentTierResult } from '@/lib/agent-tier'

export function AgentTierChip({ tier, loading, size = 'md' }: {
  /** null = not known: loading, or the attestation read failed. */
  tier: AgentTierResult | null
  loading: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const needed = AGENT_TIER_LADDER.verified.minAttesters
  return (
    <TooltipWrapper content={AGENT_TIER_TOOLTIP}>
      <span className="inline-flex items-center gap-1.5 cursor-help" data-testid="agent-tier-chip">
        {tier ? (
          <>
            <TrustTierBadge tier={tier.display} size={size} />
            {tier.tier !== 'verified' && (
              <span className="text-[10px] text-[#7A838D]">· {tier.attesters}/{needed} attesters</span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-[#7A838D]">
            {loading ? `—/${needed} attesters` : 'Tier unavailable — couldn’t read attestations'}
          </span>
        )}
      </span>
    </TooltipWrapper>
  )
}
