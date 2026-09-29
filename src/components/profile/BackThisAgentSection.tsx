'use client'

/**
 * "Back this agent" — backing (a tTRUST stake on the agent's atom vault) as a secondary, collapsed
 * section under the attestation unit (thesis §4/§6). One component, two surfaces: the /agents
 * modal puts its Buy/Sell panel inside; the /agents/[id] profile links to that panel ("Back with
 * tTRUST"). Backing is not attesting — it never changes the tier, and it is never called "trust"
 * (the profile's old gold "Trust Agent" button was a stake that never happened: a 2 s timeout).
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export const BACKING_IS_NOT_ATTESTING = "Stake tTRUST on this agent's atom vault. Backing is not attesting — it does not change the tier."

interface BackThisAgentSectionProps {
  /** Controlled (the modal collapses it per agent); uncontrolled when omitted. */
  open?: boolean
  onToggle?: () => void
  children: ReactNode
  className?: string
}

export function BackThisAgentSection({ open, onToggle, children, className }: BackThisAgentSectionProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const toggle = onToggle ?? (() => setOwnOpen((v) => !v))
  return (
    <div className={`bg-[#0F1113] border border-[#C8963C]/12 rounded-2xl p-5 ${className ?? ''}`} data-testid="back-this-agent">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-2 text-left" aria-expanded={isOpen}>
        <span className="text-[#B5BDC6] text-xs font-semibold">Back this agent</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-[#7A838D]" /> : <ChevronDown className="w-4 h-4 text-[#7A838D]" />}
      </button>
      {isOpen && (
        <>
          <p className="text-[#7A838D] text-xs mt-2 mb-3">{BACKING_IS_NOT_ATTESTING}</p>
          {children}
        </>
      )}
    </div>
  )
}
