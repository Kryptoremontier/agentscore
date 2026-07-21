'use client'

/**
 * AttestStickyBar — mobile-only sticky action bar for the PRIMARY action.
 *
 * Sits directly above the global MobileBottomNav (h-16 = 4rem, z-40,
 * safe-area padded) so the Attest action is always in the viewport on
 * mobile without scrolling. z-[45] beats the nav; the AttestButton modal
 * itself is z-50 and opens above everything.
 */

import { AttestButton } from './AttestButton'

interface AttestStickyBarProps {
  agentId: string
  agentName: string
}

export function AttestStickyBar({ agentId, agentName }: AttestStickyBarProps) {
  return (
    <div
      className="fixed left-0 right-0 z-[45] md:hidden px-4 py-3"
      style={{
        bottom: 'calc(4rem + env(safe-area-inset-bottom))',
        // NO backdrop-filter here — it would create a containing block and trap
        // the AttestButton fixed modal inside this 64px bar. Near-opaque instead.
        background: 'rgba(8,8,14,0.97)',
        borderTop: '1px solid rgba(139,92,246,0.2)',
      }}
    >
      <AttestButton agentId={agentId} agentName={agentName} variant="bar" />
    </div>
  )
}
