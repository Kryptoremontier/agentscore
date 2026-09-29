'use client'

/**
 * The agent header's stat row and its demoted Backers line — one component for the /agents modal
 * and the /agents/[id] profile (Etap 5a), rendering lib/agent-profile.ts statRowView. Primary:
 * the attestation unit (attesters, domains, tTRUST attested, reports — thesis §4). Secondary, muted,
 * never a box: backing on the atom vault, which never changes the tier (thesis §6).
 * 2×2 on a phone, 1×4 from md. "—" = not read, never 0.
 */

import type { ReactNode } from 'react'
import { TooltipWrapper } from '@/components/ui/tooltip'
import type { StatRowView } from '@/lib/agent-profile'

export function ProfileStatRow({ view, footer }: { view: StatRowView; footer?: ReactNode }) {
  return (
    <div data-testid="stat-row">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {view.boxes.map((s) => (
          <div key={s.label} className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-3 text-center" data-testid="stat-box">
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-xs text-[#B5BDC6] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <TooltipWrapper content="Backers stake on the agent's atom; attesters stake on a domain claim. Only attestations count toward the tier.">
          <p className="text-xs text-[#7A838D] cursor-help" data-testid="backers-line">{view.backersLine}</p>
        </TooltipWrapper>
        {footer}
      </div>
    </div>
  )
}
