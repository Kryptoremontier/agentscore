'use client'

/**
 * The /check answer (Etap 7 Run B): one card — name and origin, the three seals (SealRow lg), "N
 * people vouch · for …", the tier chip with its "?", the backing score small, how old the data is,
 * and one action: Vouch for this agent. The /agents card's own derivations (lib/check-agent.ts);
 * the server hands it over encoded (bigints) as /agents does with its list.
 */

import { decodeFromCache } from '@/lib/json-codec'
import { updatedAgoLabel } from '@/lib/agents-page-types'
import type { CheckCard } from '@/lib/check-agent'
import { ORIGIN_LABEL, WHO_VOUCHES_UNREAD } from '@/lib/people-copy'
import { SealRow } from '@/components/agents/SealRow'
import { AgentTierChip } from '@/components/agents/AgentTierChip'
import { BackingScore } from '@/components/agents/BackingScore'
import { Explainer } from '@/components/shared/Explainer'
import { AttestButton } from '@/components/attest/AttestButton'

export function CheckResultCard({ encoded, footer }: { encoded: unknown; footer?: React.ReactNode }) {
  const card = decodeFromCache<CheckCard>(encoded)
  return (
    <article
      className="rounded-2xl border border-[#C8963C]/25 bg-[#111318]/90 p-5 sm:p-6"
      data-testid="check-result"
      data-agent-id={card.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-display leading-display text-white break-words" data-testid="check-name">{card.name}</h2>
          <p className="text-xs text-[#7A838D] mt-1">{ORIGIN_LABEL[card.origin]}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 flex-shrink-0 pt-1">
          <BackingScore value={card.backing} tip={card.backingTip} />
          <Explainer term="backing" />
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-4">
        <AgentTierChip tier={card.tier} loading={false} />
        <Explainer term="tiers" />
      </div>

      <p
        className={`mt-3 text-base sm:text-lg ${card.line.kind === 'some' ? 'text-[#C8963C] font-medium' : 'text-[#B5BDC6]'}`}
        data-testid="check-people"
      >
        {card.line.claim ?? WHO_VOUCHES_UNREAD}
      </p>

      {card.attesters && <SealRow attesters={card.attesters} size="lg" className="mt-4" />}

      <p className="mt-4 text-xs text-[#7A838D]" data-testid="check-age" title={card.dataReadAt}>
        {updatedAgoLabel(card.dataAgeSeconds)}
      </p>

      <div className="mt-5">
        <AttestButton agentId={card.id} agentName={card.name} variant="hero" />
      </div>
      {footer}
    </article>
  )
}
