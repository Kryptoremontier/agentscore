'use client'

/**
 * "Atom ID: 0x82d87d9517b6...24802c5a" + copy — the agent's term id, inside the collapsed Details on
 * both agent surfaces (Etap 5b). Shortened hex; the button copies the full id. The profile used to print
 * BigInt(term_id).toString(): a 78-digit decimal that pushed a phone's page to 742 px wide.
 */

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { DETAILS_ATOM_ID } from '@/lib/people-copy'

export function shortTermId(termId: string): string {
  return termId.length > 24 ? `${termId.slice(0, 14)}...${termId.slice(-8)}` : termId
}

export function AtomIdLine({ termId, className }: { termId: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <div className={`flex items-center gap-2 text-sm ${className ?? ''}`} data-testid="atom-id">
      <span className="text-[#B5BDC6] w-16 flex-shrink-0">{DETAILS_ATOM_ID}:</span>
      <code className="text-[#B5BDC6] text-xs font-mono" title={termId}>{shortTermId(termId)}</code>
      <button
        type="button"
        onClick={() => { void navigator.clipboard.writeText(termId); setCopied(true) }}
        className="text-[#B5BDC6] hover:text-white transition-colors"
        aria-label="Copy the full Atom ID"
        title="Copy the full Atom ID"
      >
        {copied ? <Check className="w-3 h-3" /> : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        )}
      </button>
    </div>
  )
}
