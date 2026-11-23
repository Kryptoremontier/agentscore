'use client'

/**
 * "Your trust" (Etap 9c) — on the agent modal, /agents/[id] and /check/[id], when a wallet is
 * connected: every trust context this wallet trusts the agent for, its amount, and "Withdraw".
 *
 * Withdraw opens a confirm step with the contract's live preview of what comes back (re-read every
 * 15 s while open). No preview, no signing: a failed read disables the button. The withdrawal is a
 * redeem straight on MultiVault (lib/your-trust.ts) — no FeeProxy, no fee. Afterwards "N people
 * trust it" and the tier come from a new read, with its age.
 *
 * Trust words only in this block — no market words (src/lib/__tests__/your-trust.test.ts reads it).
 */

import { useEffect, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Loader2, Check, AlertTriangle } from 'lucide-react'
import { createWriteConfig } from '@/lib/intuition'
import { ATTEST_CHAIN_ID } from '@/lib/attest-gate'
import { formatTTrust } from '@/lib/format'
import {
  readYourTrust, previewWithdraw, withdrawTrust, waitForTrustNow,
  type YourTrustRow, type TrustNow,
} from '@/lib/your-trust'
import {
  YOUR_TRUST_HEADING, YOUR_TRUST_NOTE, YOUR_TRUST_UNREAD, WITHDRAW, WITHDRAW_KEEP, yourTrustAmount,
  withdrawPreview, WITHDRAW_PREVIEW_READING, WITHDRAW_PREVIEW_FAILED, WITHDRAW_RETRY, withdrawSign,
  WITHDRAW_PENDING, WITHDRAW_CANCELLED, WITHDRAW_FAILED, withdrawDone, WITHDRAW_COUNTING,
  WITHDRAW_COUNT_UNREAD, WITHDRAW_INDEXING, readAgo, trustNowLine, VOUCH_WRONG_NETWORK, TIER_LABEL,
} from '@/lib/people-copy'
import { requestRefresh } from '@/lib/refresh-client'
import { ContextIcon } from './ContextIcon'

export type PreviewState = { status: 'reading' } | { status: 'ok'; wei: bigint } | { status: 'failed' }

export type WithdrawResult =
  | { status: 'counting'; contextLabel: string }
  | { status: 'counted'; contextLabel: string; now: TrustNow }
  | { status: 'count-unread'; contextLabel: string }

/** tTRUST with enough digits to tell small amounts apart (0.00495 vs 0.00490). */
export const trustAmount = (wei: bigint) => formatTTrust(wei, { decimals: wei < 10n ** 16n ? 5 : 4 })

export const rowKey = (r: Pick<YourTrustRow, 'tripleId' | 'curveId'>) => `${r.tripleId.toLowerCase()}:${r.curveId}`

/** The sign button is enabled only with a preview read from the contract, nothing pending, on the right network. */
export function canSignWithdraw(preview: PreviewState | null, pending: boolean, wrongNetwork: boolean): boolean {
  return !!preview && preview.status === 'ok' && !pending && !wrongNetwork
}

export interface YourTrustViewProps {
  /** null = not read yet (nothing drawn); 'unread' = the read failed. */
  rows: YourTrustRow[] | 'unread' | null
  openKey: string | null
  preview: PreviewState | null
  pending: boolean
  wrongNetwork: boolean
  error: string | null
  result: WithdrawResult | null
  /** "now" for the age of the after-withdraw read (ms). */
  now: number
  onOpen?: (key: string) => void
  onCancel?: () => void
  onConfirm?: () => void
  onRetryPreview?: () => void
}

/** The block itself — pure (props in, markup out). Hidden when the wallet trusts nothing here and nothing just happened. */
export function YourTrustView(p: YourTrustViewProps) {
  if (p.rows === null) return null
  if (Array.isArray(p.rows) && p.rows.length === 0 && !p.result) return null
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111318]/85 p-4" data-testid="your-trust" aria-label={YOUR_TRUST_HEADING}>
      <p className="eyebrow text-[#7A838D]">{YOUR_TRUST_HEADING}</p>
      <p className="mt-2 text-sm text-[#B5BDC6]" data-testid="your-trust-note">{YOUR_TRUST_NOTE}</p>

      {p.rows === 'unread' && (
        <p className="mt-3 text-sm text-[#B5BDC6]" data-testid="your-trust-unread">{YOUR_TRUST_UNREAD}</p>
      )}

      {Array.isArray(p.rows) && p.rows.length > 0 && (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {p.rows.map((row) => {
            const key = rowKey(row)
            const open = p.openKey === key
            return (
              <li key={key} className="py-3" data-testid="your-trust-row" data-context={row.context.label}>
                <div className="flex items-center gap-3">
                  <ContextIcon label={row.context.label} className="w-4 h-4 shrink-0 text-[#C8963C]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{row.context.label}</p>
                    <p className="text-xs text-[#7A838D]" data-testid="your-trust-amount">{yourTrustAmount(trustAmount(row.shares))}</p>
                  </div>
                  {!open && (
                    <button
                      type="button"
                      className="btn-secondary !min-h-[40px] !px-4 !py-2 text-sm"
                      onClick={() => p.onOpen?.(key)}
                      disabled={p.pending}
                      data-testid="withdraw-open"
                    >
                      {WITHDRAW}
                    </button>
                  )}
                </div>
                {open && <WithdrawConfirm row={row} {...p} />}
              </li>
            )
          })}
        </ul>
      )}

      {p.result && <ResultLine result={p.result} now={p.now} />}
    </section>
  )
}

function WithdrawConfirm({ row, preview, pending, wrongNetwork, error, onCancel, onConfirm, onRetryPreview }: YourTrustViewProps & { row: YourTrustRow }) {
  const enabled = canSignWithdraw(preview, pending, wrongNetwork)
  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-3" data-testid="withdraw-confirm">
      {(!preview || preview.status === 'reading') && (
        <p className="text-xs flex items-center gap-1.5 text-[#7A838D]" data-testid="withdraw-preview" data-state="reading">
          <Loader2 className="w-3 h-3 animate-spin" /> {WITHDRAW_PREVIEW_READING}
        </p>
      )}
      {preview?.status === 'ok' && (
        <p className="text-sm text-white" data-testid="withdraw-preview" data-state="ok">{withdrawPreview(trustAmount(preview.wei))}</p>
      )}
      {preview?.status === 'failed' && (
        <div className="text-xs text-[#F59E0B] flex items-start gap-1.5" data-testid="withdraw-preview" data-state="failed">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {WITHDRAW_PREVIEW_FAILED}{' '}
            <button type="button" className="underline hover:text-white" onClick={onRetryPreview}>{WITHDRAW_RETRY}</button>
          </span>
        </div>
      )}
      {wrongNetwork && <p className="text-xs text-[#F59E0B]">{VOUCH_WRONG_NETWORK}</p>}
      {pending && (
        <p className="text-xs flex items-center gap-1.5 text-[#B5BDC6]"><Loader2 className="w-3 h-3 animate-spin" /> {WITHDRAW_PENDING}</p>
      )}
      {error && !pending && <p className="text-xs text-[#EF4444]" data-testid="withdraw-error">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" className="btn-primary flex-1 !px-4" disabled={!enabled} onClick={onConfirm} data-testid="withdraw-sign">
          {withdrawSign(row.context.label)}
        </button>
        <button type="button" className="btn-secondary !px-4" disabled={pending} onClick={onCancel} data-testid="withdraw-keep">
          {WITHDRAW_KEEP}
        </button>
      </div>
    </div>
  )
}

function ResultLine({ result, now }: { result: WithdrawResult; now: number }) {
  return (
    <div className="mt-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.25)' }} data-testid="withdraw-result" data-state={result.status}>
      <p className="flex items-start gap-2 text-[#2ECC71]"><Check className="w-4 h-4 mt-0.5 shrink-0" /> {withdrawDone(result.contextLabel)}</p>
      {result.status === 'counting' && (
        <p className="mt-1 text-xs text-[#B5BDC6] flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> {WITHDRAW_COUNTING}</p>
      )}
      {result.status === 'count-unread' && <p className="mt-1 text-xs text-[#B5BDC6]">{WITHDRAW_COUNT_UNREAD}</p>}
      {result.status === 'counted' && (
        <>
          <p className="mt-1 text-xs text-white" data-testid="withdraw-now" title={new Date(result.now.readAt).toISOString()}>
            {trustNowLine(result.now.people, TIER_LABEL[result.now.tier.tier], readAgo(Math.max(0, (now - result.now.readAt) / 1000)))}
          </p>
          {!result.now.caughtUp && <p className="mt-1 text-xs text-[#7A838D]">{WITHDRAW_INDEXING}</p>}
        </>
      )}
    </div>
  )
}

function isUserRejection(err: unknown): boolean {
  const e = err as { code?: number; name?: string; cause?: { code?: number; name?: string }; shortMessage?: string } | null
  return e?.code === 4001 || e?.cause?.code === 4001 || e?.name === 'UserRejectedRequestError' || e?.cause?.name === 'UserRejectedRequestError' || /reject|denied/i.test(e?.shortMessage ?? '')
}

const PREVIEW_REFRESH_MS = 15_000

/** The block with the wallet: reads, previews, signs. `onChanged` lets the page re-read itself after a withdrawal. */
export function YourTrust({ agentId, onChanged, className }: { agentId: string; onChanged?: () => void; className?: string }) {
  const { address, isConnected, chainId } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [mounted, setMounted] = useState(false)
  const [rows, setRows] = useState<YourTrustRow[] | 'unread' | null>(null)
  const [reload, setReload] = useState(0)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewNonce, setPreviewNonce] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WithdrawResult | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { setMounted(true) }, [])

  // A new agent or wallet: start over.
  useEffect(() => {
    setRows(null); setOpenKey(null); setPreview(null); setError(null); setResult(null)
  }, [agentId, address])

  // This wallet's trust in this agent.
  useEffect(() => {
    let cancelled = false
    if (!isConnected || !address || !publicClient) return
    readYourTrust(publicClient, agentId, address)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setRows('unread') })
    return () => { cancelled = true }
  }, [isConnected, address, publicClient, agentId, reload])

  const openRow = Array.isArray(rows) ? rows.find((r) => rowKey(r) === openKey) ?? null : null

  // The live preview of what comes back, while the confirm step is open.
  useEffect(() => {
    let cancelled = false
    if (!openRow || !publicClient) return
    const read = () => previewWithdraw(publicClient, openRow)
      .then((wei) => { if (!cancelled) setPreview({ status: 'ok', wei }) })
      .catch(() => { if (!cancelled) setPreview({ status: 'failed' }) })
    setPreview({ status: 'reading' })
    read()
    const timer = setInterval(read, PREVIEW_REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRow?.tripleId, openRow?.curveId, openRow?.shares, publicClient, previewNonce])

  // The after-withdraw read's age, ticking.
  useEffect(() => {
    if (result?.status !== 'counted') return
    const t = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [result?.status])

  async function signWithdrawal() {
    if (!openRow || !walletClient || !publicClient || !address) return
    if (!canSignWithdraw(preview, pending, chainId !== ATTEST_CHAIN_ID)) return
    const row = openRow
    setPending(true)
    setError(null)
    try {
      const { receipt } = await withdrawTrust(createWriteConfig(walletClient, publicClient), row)
      if (receipt.status !== 'success') throw new Error('reverted')
    } catch (err) {
      setPending(false)
      setError(isUserRejection(err) ? WITHDRAW_CANCELLED : WITHDRAW_FAILED)
      return
    }
    setPending(false)
    requestRefresh(agentId) // the receipt is confirmed: refill what this withdrawal changed (Etap 9d)
    setOpenKey(null)
    setPreview(null)
    setResult({ status: 'counting', contextLabel: row.context.label })
    setReload((n) => n + 1)
    onChanged?.()
    try {
      const fresh = await waitForTrustNow(agentId, address, row.context.termId)
      setNow(Date.now())
      setResult({ status: 'counted', contextLabel: row.context.label, now: fresh })
      if (fresh.caughtUp) onChanged?.()
    } catch {
      setResult({ status: 'count-unread', contextLabel: row.context.label })
    }
  }

  if (!mounted || !isConnected || !address) return null
  return (
    <div className={className}>
      <YourTrustView
        rows={rows}
        openKey={openKey}
        preview={preview}
        pending={pending}
        wrongNetwork={chainId !== ATTEST_CHAIN_ID}
        error={error}
        result={result}
        now={now}
        onOpen={(k) => { setError(null); setOpenKey(k) }}
        onCancel={() => { setOpenKey(null); setPreview(null); setError(null) }}
        onConfirm={signWithdrawal}
        onRetryPreview={() => setPreviewNonce((n) => n + 1)}
      />
    </div>
  )
}
