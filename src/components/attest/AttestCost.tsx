/**
 * The trust dialog's cost, before the first wallet window (Etap 9b): one line — "0.04 tTRUST
 * behind it · fee X tTRUST · total Y tTRUST, plus gas" — with the fee read live from the FeeProxy
 * (lib/attest-service.ts previewAttestCost). When the fee can't be read the dialog says so and
 * offers a retry; it never shows, or signs, a guessed fee.
 */

import { formatEther } from 'viem'
import type { AttestCostPreview } from '@/lib/attest-service'
import { FEE_UNREAD, FEE_RETRY, trustCostLine } from '@/lib/people-copy'

/** Fixed fee + percentage fee, over every transaction of the plan. Creation costs are not a fee. */
export const feeOf = (p: Pick<AttestCostPreview, 'fixedFeeWei' | 'percentageFeeWei'>) => p.fixedFeeWei + p.percentageFeeWei

export function AttestCostLine({ preview }: { preview: AttestCostPreview }) {
  return (
    <p className="text-xs font-medium text-white" data-testid="trust-cost-line">
      {trustCostLine(formatEther(preview.stakeWei), formatEther(feeOf(preview)), formatEther(preview.totalWei))}
    </p>
  )
}

export function FeeUnread({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }} data-testid="fee-unread">
      <p className="text-xs" style={{ color: '#FCA5A5' }}>{FEE_UNREAD}</p>
      <button type="button" onClick={onRetry} className="btn-secondary h-9 px-3 text-xs flex-shrink-0">{FEE_RETRY}</button>
    </div>
  )
}
