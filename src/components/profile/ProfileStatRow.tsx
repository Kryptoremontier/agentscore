'use client'

/**
 * The agent header's stat row and its demoted backing line — one component for the /agents modal
 * and the /agents/[id] profile (Etap 5a), rendering lib/agent-profile.ts statRowView. Primary:
 * the people who vouch (people vouching, areas, tTRUST behind vouches, reports — thesis §4).
 * Secondary, muted, never a box: backing on the atom vault, which never changes the tier (thesis §6),
 * and beside it the one backing score (Etap 5b: small, neutral — components/agents/BackingScore).
 * 2×2 on a phone, 1×4 from md. "—" = not read, never 0.
 * Etap 6: a "?" explains "vouch" and "tTRUST" at their first use (in the corner of the People and
 * tTRUST boxes) and the backing score beside it (components/shared/Explainer).
 */

import type { ReactNode } from 'react'
import { TooltipWrapper } from '@/components/ui/tooltip'
import type { StatRowView } from '@/lib/agent-profile'
import { STAT_ROW_TOOLTIP, STAT_PEOPLE, STAT_STAKE, type ExplainerTerm } from '@/lib/people-copy'
import { Explainer } from '@/components/shared/Explainer'

/** The boxes whose label is the word's first use on the modal and the profile. */
const BOX_EXPLAINER: Record<string, ExplainerTerm> = {
  [STAT_PEOPLE(1)]: 'vouch',
  [STAT_PEOPLE(2)]: 'vouch',
  [STAT_STAKE]: 'ttrust',
}

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
          <div key={s.label} className="relative bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-3 text-center" data-testid="stat-box">
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-xs text-[#B5BDC6] mt-0.5">{s.label}</p>
            {/* In the box's corner: the label never reflows for it. */}
            {BOX_EXPLAINER[s.label] && <Explainer term={BOX_EXPLAINER[s.label]} className="absolute top-1.5 right-1.5" />}
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <TooltipWrapper content={STAT_ROW_TOOLTIP}>
            <p className="text-xs text-[#7A838D] cursor-help" data-testid="backers-line">{view.backersLine}</p>
          </TooltipWrapper>
          {backing && (
            <span className="inline-flex items-center gap-1.5">
              {backing}
              <Explainer term="backing" />
            </span>
          )}
        </div>
        {footer}
      </div>
    </div>
  )
}
