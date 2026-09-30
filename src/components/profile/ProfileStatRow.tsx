'use client'

/**
 * The agent header's stat row and its demoted backing line — one component for the /agents modal
 * and the /agents/[id] profile (Etap 5a), rendering lib/agent-profile.ts statRowView. Primary:
 * the people who vouch (people vouching, areas, tTRUST behind vouches, reports — thesis §4).
 * Secondary, muted, never a box: backing on the atom vault, which never changes the tier (thesis §6),
 * and beside it the one backing score (Etap 5b: small, neutral — components/agents/BackingScore).
 * 2×2 on a phone, 1×4 from md. "—" = not read, never 0.
 */

import type { ReactNode } from 'react'
import { TooltipWrapper } from '@/components/ui/tooltip'
import type { StatRowView } from '@/lib/agent-profile'
import { STAT_ROW_TOOLTIP } from '@/lib/people-copy'

export function ProfileStatRow({ view, backing, footer }: {
  view: StatRowView
  /** The backing score (<BackingScore variant="line" …>), right of the backing line. */
  backing?: ReactNode
  footer?: ReactNode
}) {
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <TooltipWrapper content={STAT_ROW_TOOLTIP}>
            <p className="text-xs text-[#7A838D] cursor-help" data-testid="backers-line">{view.backersLine}</p>
          </TooltipWrapper>
          {backing}
        </div>
        {footer}
      </div>
    </div>
  )
}
