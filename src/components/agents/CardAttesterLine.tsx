'use client'

/**
 * The /agents attester line — the canonical unit (thesis §4) on the list, on the grid
 * card and the list row alike. Prints lib/agent-list.ts attesterLineOf verbatim (the
 * same count the modal prints). "Attest" opens the agent's modal scrolled to its
 * ATTESTED section. A failed read makes no claim: the CTA alone (REPO_MAP §7 rule 5).
 *
 * The line reserves one 18 px text line: while the bulk read is in flight it holds a
 * fixed-height skeleton bar and no text, so nothing below it moves when the read answers.
 */

import type { MouseEvent } from 'react'
import type { CardAttesterLine as Line } from '@/lib/agent-list'

/**
 * One text-xs line (the app's inherited line-height is 1.5 → 18 px), reserved while loading.
 * min-height, not height: on a very narrow row the answer may wrap rather than hide "Attest".
 */
const ATTESTER_LINE_CLASS = 'text-xs leading-[18px] min-h-[18px]'

export function CardAttesterLine({ line, agentName, onAttest, className = '' }: {
  line: Line
  /** Names the button for screen readers — ~270 cards each carry an "Attest". */
  agentName: string
  onAttest: () => void
  className?: string
}) {
  const attest = (e: MouseEvent) => {
    e.stopPropagation() // the card's own click opens the modal without scrolling
    onAttest()
  }
  return (
    <p className={`${ATTESTER_LINE_CLASS} ${className}`} data-testid="card-attester-line" data-state={line.kind} aria-busy={line.kind === 'loading' || undefined}>
      {line.kind === 'loading' && (
        <span aria-hidden className="inline-block align-middle h-2.5 w-24 rounded bg-white/[0.08] animate-pulse" />
      )}
      {line.claim && (
        <span className={line.kind === 'some' ? 'text-[#C8963C] font-medium' : 'text-[#7A838D]'}>{line.claim}</span>
      )}
      {line.claim && line.cta && <span className="text-[#7A838D]"> · </span>}
      {line.cta && (
        <button type="button" onClick={attest} aria-label={`Attest ${agentName}`} aria-haspopup="dialog" className="text-[#C8963C] font-medium hover:underline">
          Attest
        </button>
      )}
    </p>
  )
}
