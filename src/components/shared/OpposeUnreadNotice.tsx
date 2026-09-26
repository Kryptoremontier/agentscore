/**
 * Shown in place of a trust score whose oppose side couldn't be read (skills/claims
 * modals). A score computed on 0 oppose would pass a failed read off as a measurement.
 */
import { OPPOSE_UNREAD_TOOLTIP } from '@/lib/score-basis'

export function OpposeUnreadNotice({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4 text-sm text-[#7A838D] ${className}`} data-testid="oppose-unread">
      <span className="text-white font-semibold">Trust Score —</span> {OPPOSE_UNREAD_TOOLTIP}
    </div>
  )
}
