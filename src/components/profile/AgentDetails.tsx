'use client'

/**
 * "Details" — collapsed by default, on both agent surfaces (the /agents modal and /agents/[id]).
 * Holds what only a developer needs: the Atom ID (the agent's term id, shortened, copies the full
 * id), the ERC-8004 id (CAIP) for registry agents, and whatever the surface adds as children.
 * Etap 5b: none of this is the story a person reads first.
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { AtomIdLine } from '@/components/profile/AtomIdLine'
import { DETAILS_HEADING, DETAILS_CAIP } from '@/lib/people-copy'

export function AgentDetails({ termId, caipIdentity, children, className }: {
  termId: string
  /** The ERC-8004 identity (eip155:…/erc721:0x8004…/id); omitted for other agents. */
  caipIdentity?: string | null
  children?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-5 ${className ?? ''}`} data-testid="agent-details">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span className="text-[#B5BDC6] text-xs font-semibold">{DETAILS_HEADING}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#7A838D]" /> : <ChevronDown className="w-4 h-4 text-[#7A838D]" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <AtomIdLine termId={termId} />
          {caipIdentity && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-[#B5BDC6] w-16 flex-shrink-0">{DETAILS_CAIP}:</span>
              <code className="text-[#B5BDC6] text-xs font-mono break-all min-w-0">{caipIdentity}</code>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
