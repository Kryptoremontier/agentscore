'use client'

/**
 * The /agents people line — the canonical unit (thesis §4) on the list, on the grid
 * card and the list row alike: "1 person vouches · for Knowledge / Productivity". Prints
 * lib/agent-list.ts attesterLineOf verbatim (the same count the modal prints). "Vouch"
 * opens the agent's modal scrolled to its "Who vouches" section. A failed read makes no
 * claim: the CTA alone (REPO_MAP §7 rule 5).
 *
 * The line reserves one 18 px text line: while the bulk read is in flight it holds a
 * fixed-height skeleton bar and no text, so nothing below it moves when the read answers.
 */

import type { MouseEvent } from 'react'
import type { CardAttesterLine as Line } from '@/lib/agent-list'
import { VOUCH_SHORT, vouchFor } from '@/lib/people-copy'

/**
 * One line, reserved while loading: text-xs (the app's inherited line-height is 1.5 → 18 px) on
 * the list row; text-sm on the grid card, where it is the headline (Etap 5b).
 * min-height, not height: on a very narrow row the answer may wrap rather than hide "Vouch".
 */
const ATTESTER_LINE_CLASS = {
  xs: 'text-xs leading-[18px] min-h-[18px]',
  sm: 'text-sm leading-5 min-h-[20px]',
} as const

export function CardAttesterLine({ line, agentName, onAttest, size = 'xs', className = '' }: {
  line: Line
  /** Names the button for screen readers — ~270 cards each carry a "Vouch". */
  agentName: string
  onAttest: () => void
  /** 'sm' on the grid card (the headline), 'xs' on the list row. */
  size?: keyof typeof ATTESTER_LINE_CLASS
  className?: string
}) {
  const attest = (e: MouseEvent) => {
    e.stopPropagation() // the card's own click opens the modal without scrolling
    onAttest()
  }
  return (
    <p className={`${ATTESTER_LINE_CLASS[size]} ${className}`} data-testid="card-attester-line" data-state={line.kind} aria-busy={line.kind === 'loading' || undefined}>
      {line.kind === 'loading' && (
        <span aria-hidden className="inline-block align-middle h-2.5 w-24 rounded bg-white/[0.08] animate-pulse" />
      )}
      {line.claim && (
        <span className={line.kind === 'some' ? 'text-[#C8963C] font-medium' : 'text-[#7A838D]'}>{line.claim}</span>
      )}
      {line.claim && line.cta && <span className="text-[#7A838D]"> · </span>}
      {line.cta && (
        <button type="button" onClick={attest} aria-label={vouchFor(agentName)} aria-haspopup="dialog" className="text-[#C8963C] font-medium hover:underline">
          {VOUCH_SHORT}
        </button>
      )}
    </p>
  )
}
