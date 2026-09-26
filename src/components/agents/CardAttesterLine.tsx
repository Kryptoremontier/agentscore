'use client'

/**
 * The /agents card's attester line — the canonical unit (thesis §4) on the list.
 * Prints lib/agent-list.ts cardAttesterLine verbatim (the same count the modal
 * prints). "Attest" opens the agent's modal scrolled to its ATTESTED section.
 * A failed read makes no claim: the CTA alone (REPO_MAP §7 rule 5).
 */

import type { MouseEvent } from 'react'
import type { CardAttesterLine as Line } from '@/lib/agent-list'

export function CardAttesterLine({ line, onAttest, className = '' }: {
  line: Line
  onAttest: () => void
  className?: string
}) {
  const attest = (e: MouseEvent) => {
    e.stopPropagation() // the card's own click opens the modal without scrolling
    onAttest()
  }
  return (
    <p className={`text-xs ${className}`} data-testid="card-attester-line" data-state={line.kind}>
      {line.claim && (
        <span className={line.kind === 'some' ? 'text-[#C8963C] font-medium' : 'text-[#7A838D]'}>{line.claim}</span>
      )}
      {line.claim && line.cta && <span className="text-[#7A838D]"> · </span>}
      {line.cta && (
        <button type="button" onClick={attest} className="text-[#C8963C] font-medium hover:underline">
          Attest
        </button>
      )}
    </p>
  )
}
