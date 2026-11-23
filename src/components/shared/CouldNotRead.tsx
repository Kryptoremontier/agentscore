'use client'

/**
 * "Couldn't read" (Etap 9d): one agent's read failed or timed out. Says it is our read failing, not
 * the agent missing, when it was attempted, and offers "Try again". Never cached: the pages that
 * show it are dynamic, and the API answers it with 503 `read_failed` and no-store.
 */

import { RefreshCw } from 'lucide-react'
import { AGENT_UNREAD, AGENT_UNREAD_RETRY, agentUnreadTriedAt } from '@/lib/people-copy'

export function CouldNotRead({ attemptedAt, onRetry, retrying = false, className = '' }: {
  /** ISO time of the failed attempt. */
  attemptedAt: string
  onRetry: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-5 ${className}`} role="alert" data-testid="agent-unread">
      <p className="text-white">{AGENT_UNREAD}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onRetry} disabled={retrying} className="btn-secondary !min-h-[40px] !px-4 !py-2 text-sm" data-testid="agent-unread-retry">
          <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} /> {AGENT_UNREAD_RETRY}
        </button>
        <time className="text-xs text-[#7A838D]" dateTime={attemptedAt} data-testid="agent-unread-at">{agentUnreadTriedAt(attemptedAt)}</time>
      </div>
    </div>
  )
}
