'use client'

/**
 * /admin/fees (Etap 9c): the FeeProxy's deposit fee and its admins, read live, and the form that sets
 * the fixed fee. The admin signs in their own wallet (wagmi); no key is handled here and nothing is
 * signed on a server. A failed read shows an error, never a number; the button is enabled only for a
 * wallet the contract itself lists as an admin (lib/fee-admin-reads.ts fixedFeeForm).
 */

import { useEffect, useState } from 'react'
import { useAccount, usePublicClient, useSendTransaction } from 'wagmi'
import { Loader2, RefreshCw, Check, AlertTriangle, ExternalLink, Undo2 } from 'lucide-react'
import { FEE_PROXY, FEE_CHAIN_ID, FEE_ADMINS } from '@/lib/fee-admin'
import {
  readFeeNow, readFeeAdmins, readIsFeeAdmin, fixedFeeForm, feeTTrust, feePercent, FEE_FORM,
  type AdminCheck, type FeeRead,
} from '@/lib/fee-admin-reads'
import { INTUITION_TESTNET } from '@/lib/intuition'
import { readAgo } from '@/lib/people-copy'

type AdminsRead = { status: 'reading' } | { status: 'ok'; value: string[] } | { status: 'failed' }
type Done = { hash: `0x${string}`; previous: bigint; next: bigint }

const KNOWN: Record<string, string> = {
  [FEE_ADMINS.adminWallet.toLowerCase()]: 'admin wallet',
  [FEE_ADMINS.feeRecipient.toLowerCase()]: 'fee recipient',
}

export function FeesAdminClient() {
  const { address, chainId, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: FEE_CHAIN_ID })
  const { sendTransactionAsync } = useSendTransaction()
  const [fee, setFee] = useState<FeeRead>({ status: 'reading' })
  const [admins, setAdmins] = useState<AdminsRead>({ status: 'reading' })
  const [adminCheck, setAdminCheck] = useState<AdminCheck>('checking')
  const [nonce, setNonce] = useState(0)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    if (!publicClient) return
    setFee({ status: 'reading' })
    setAdmins({ status: 'reading' })
    readFeeNow(publicClient)
      .then((value) => { if (!cancelled) setFee({ status: 'ok', value, readAt: Date.now() }) })
      .catch(() => { if (!cancelled) setFee({ status: 'failed' }) })
    readFeeAdmins(publicClient)
      .then((value) => { if (!cancelled) setAdmins({ status: 'ok', value }) })
      .catch(() => { if (!cancelled) setAdmins({ status: 'failed' }) })
    return () => { cancelled = true }
  }, [publicClient, nonce])

  useEffect(() => {
    let cancelled = false
    if (!isConnected || !address) { setAdminCheck('disconnected'); return }
    if (!publicClient) return
    setAdminCheck('checking')
    readIsFeeAdmin(publicClient, address)
      .then((yes) => { if (!cancelled) setAdminCheck(yes ? 'yes' : 'no') })
      .catch(() => { if (!cancelled) setAdminCheck('failed') })
    return () => { cancelled = true }
  }, [isConnected, address, publicClient, nonce])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])

  // Undo = the value before the last change signed here (Etap 9d), not the value read after it.
  const form = fixedFeeForm({ fee, admin: adminCheck, input, chainId, pending, previousWei: done?.previous ?? null })

  async function sign() {
    if (!form.enabled || !form.tx || form.newWei === null || fee.status !== 'ok' || !publicClient) return
    const previous = fee.value.fixedFee
    const next = form.newWei
    setPending(true)
    setError(null)
    try {
      const hash = await sendTransactionAsync({ ...form.tx, chainId: FEE_CHAIN_ID })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The transaction reverted.')
      setDone({ hash, previous, next })
      setInput('')
      setNonce((n) => n + 1) // read the fee again
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string }
      setError(e?.shortMessage ?? e?.message ?? 'The transaction failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* The fee now */}
      <section className="rounded-2xl border border-white/10 bg-[#111318]/85 p-5" data-testid="fees-now">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-[#7A838D]">Deposit fee now</p>
          <button type="button" onClick={() => setNonce((n) => n + 1)} className="text-xs text-[#7A838D] hover:text-white inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Read again
          </button>
        </div>
        {fee.status === 'reading' && (
          <p className="mt-3 text-sm text-[#7A838D] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the FeeProxy…</p>
        )}
        {fee.status === 'failed' && (
          <p className="mt-3 text-sm text-[#F59E0B] flex items-start gap-1.5" data-testid="fees-unread"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {FEE_FORM.feeUnread}</p>
        )}
        {fee.status === 'ok' && (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <dt className="text-xs text-[#7A838D]">Fixed, per deposit</dt>
                <dd className="mt-1 text-lg font-semibold text-white font-mono" data-testid="fee-fixed">{feeTTrust(fee.value.fixedFee)}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <dt className="text-xs text-[#7A838D]">Percentage</dt>
                <dd className="mt-1 text-lg font-semibold text-white font-mono" data-testid="fee-percent">{feePercent(fee.value.bps)}</dd>
                <dd className="text-[11px] text-[#7A838D]">{fee.value.bps.toString()} / 10,000</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-[#7A838D]" data-testid="fees-age" title={new Date(fee.readAt).toISOString()}>
              Read live from <span className="font-mono">{FEE_PROXY.slice(0, 6)}…{FEE_PROXY.slice(-4)}</span> · {readAgo((now - fee.readAt) / 1000)}
            </p>
          </>
        )}
      </section>

      {/* The admins */}
      <section className="rounded-2xl border border-white/10 bg-[#111318]/85 p-5" data-testid="fees-admins">
        <p className="eyebrow text-[#7A838D]">Whitelisted admins</p>
        {admins.status === 'reading' && (
          <p className="mt-3 text-sm text-[#7A838D] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the admin list…</p>
        )}
        {admins.status === 'failed' && <p className="mt-3 text-sm text-[#F59E0B]" data-testid="fees-admins-unread">{FEE_FORM.adminsUnread}</p>}
        {admins.status === 'ok' && (
          <ul className="mt-3 space-y-1.5">
            {admins.value.map((a) => (
              <li key={a} className="flex flex-wrap items-center gap-x-2 text-sm" data-testid="fees-admin">
                <span className="font-mono text-white break-all">{a}</span>
                {KNOWN[a.toLowerCase()] && <span className="text-xs text-[#7A838D]">{KNOWN[a.toLowerCase()]}</span>}
                {address && a.toLowerCase() === address.toLowerCase() && <span className="text-xs text-[#2ECC71]">you</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-[#7A838D]">From the contract&apos;s AdminWhitelistUpdated events, each confirmed with whitelistedAdmins() now.</p>
      </section>

      {/* Set the fixed fee */}
      <section className="rounded-2xl border border-[#C8963C]/25 bg-[#111318]/90 p-5 space-y-4" data-testid="fees-form">
        <div>
          <p className="eyebrow text-[#7A838D]">Set the fixed fee</p>
          <p className="mt-1 text-xs text-[#7A838D]">setDepositFixedFee(uint256) on the FeeProxy, signed in your own wallet. The trust dialog shows a new fee within a minute.</p>
        </div>
        <label className="block">
          <span className="text-xs text-[#B5BDC6]">New fixed fee (tTRUST)</span>
          <input
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0"
            className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
            style={{ background: '#12151A', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)' }}
            data-testid="fee-input"
          />
        </label>

        {fee.status === 'ok' && (
          <div className="rounded-lg px-3 py-2.5 space-y-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} data-testid="fee-change">
            <div className="flex justify-between"><span className="text-[#7A838D]">Now</span><span className="font-mono text-white">{feeTTrust(fee.value.fixedFee)}</span></div>
            <div className="flex justify-between"><span className="text-[#7A838D]">New</span><span className="font-mono text-white" data-testid="fee-new">{form.newWei !== null ? feeTTrust(form.newWei) : '—'}</span></div>
            {form.undo && (
              <p className="pt-1.5 border-t border-white/[0.07] text-[#B5BDC6] flex items-start gap-1.5" data-testid="fee-undo">
                <Undo2 className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>Undo: set it back to {feeTTrust(form.undo.wei)} — setDepositFixedFee({form.undo.wei.toString()}).</span>
              </p>
            )}
            {form.tx && (
              <p className="pt-1 text-[10px] text-[#7A838D] break-all font-mono" data-testid="fee-calldata">to {form.tx.to} · data {form.tx.data}</p>
            )}
          </div>
        )}

        {form.reason && <p className="text-xs text-[#F59E0B]" data-testid="fee-form-reason">{form.reason}</p>}
        {error && <p className="text-xs text-[#EF4444]" data-testid="fee-form-error">{error}</p>}

        <button type="button" className="btn-primary w-full" disabled={!form.enabled} onClick={sign} data-testid="fee-sign">
          {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirm in your wallet…</> : 'Sign in your wallet'}
        </button>

        {done && (
          <div className="rounded-xl px-3 py-2.5 text-sm space-y-1" style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.25)' }} data-testid="fee-done">
            <p className="text-[#2ECC71] flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Sent: {feeTTrust(done.previous)} → {feeTTrust(done.next)}. The fee above is read again from the contract.</p>
            <p className="text-xs text-[#B5BDC6]">
              Undo: set it back to {feeTTrust(done.previous)}.{' '}
              <button type="button" className="underline hover:text-white" onClick={() => setInput(done.previous === 0n ? '0' : feeTTrust(done.previous).replace(' tTRUST', ''))}>Put it in the form</button>
            </p>
            <a href={`${INTUITION_TESTNET.explorer}/tx/${done.hash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline text-[#8B5CF6]">
              View the transaction <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </section>
    </div>
  )
}
