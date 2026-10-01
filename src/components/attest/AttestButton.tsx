'use client'

/**
 * AttestButton — "Vouch for this agent" (Etap 5b: vouch in the UI = attestation in the protocol).
 *
 * Opens a modal implementing the Etap 1 write path (attest-service.ts):
 *   pick canonical domain → honest cost preview → wallet signature →
 *   pending → success (explorer link) / clean error states.
 *
 * Domain picker is CONSTRAINED to the 8 canonical buckets from
 * canonical-domains.ts — no free text; constrained objects are the
 * data-cleanliness mechanism at the source.
 *
 * TESTNET ONLY — attest-service hard-guards chainId 13579; this component
 * additionally disables the confirm button on a wrong network.
 *
 * Etap 5a — the path before the picker never dead-ends (lib/attest-gate.ts): a disconnected
 * click opens the app's wallet-connect modal and, once connected, this agent's attest flow;
 * connected on another network → one button, "Switch to Intuition Testnet"; 0 tTRUST → where to
 * get it free (the Hub link the landing uses). It used to end in a native browser dialog.
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Award, Loader2, Check, AlertTriangle, ExternalLink, Wallet, Droplets } from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient, useBalance, useSwitchChain } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { createWriteConfig, INTUITION_TESTNET } from '@/lib/intuition'
import { CANONICAL_DOMAINS_REGISTRY, type CanonicalDomainDef } from '@/lib/canonical-domains'
import {
  resolveAttestPlan,
  previewAttestCost,
  attestAgentSkill,
  AttestError,
  ATTEST_CHAIN_ID,
  type AttestPlan,
  type AttestCostPreview,
  type AttestResult,
} from '@/lib/attest-service'
import { attestStep, balanceReadOf, type AttestStep } from '@/lib/attest-gate'
import { INTUITION_HUB_URL } from '@/lib/intuition-links'
import { useConnectModal } from '@/components/wallet/ConnectModal'
import {
  VOUCH_CTA, vouchFor, connectToVouch, VOUCH_WRONG_NETWORK, VOUCH_AREA_LABEL, VOUCH_PICK_AREA, vouchIn,
  firstVouchNote, VOUCH_SUCCESS, VOUCH_INDEXING, VOUCHED_FOR,
} from '@/lib/people-copy'

interface AttestButtonProps {
  /** Agent atom term_id (the /agents/[id] URL param IS the term_id). */
  agentId: string
  agentName: string
  className?: string
  /**
   * Trigger styling only — the modal flow is identical for every variant.
   * 'hero'   = filled primary action, full width (empty-state CTA),
   * 'inline' = filled primary action, compact (the Attested section's header on desktop),
   * 'bar'    = large trigger for the mobile sticky action bar,
   * 'card'   = original subtle outline (default, backwards compatible).
   */
  variant?: 'hero' | 'inline' | 'bar' | 'card'
}

// Etap 6b: the one primary style (globals.css .btn-primary — paper fill, ink text, 2px corners,
// ≥ 44px) for the vouch action wherever it appears; the card's subtle trigger is the secondary.
const TRIGGER_STYLES: Record<NonNullable<AttestButtonProps['variant']>, { className: string }> = {
  hero: { className: 'btn-primary w-full md:text-base' },
  inline: { className: 'btn-primary whitespace-nowrap' },
  bar: { className: 'btn-primary w-full' },
  card: { className: 'btn-secondary w-full' },
}

type Status = 'pick' | 'preview' | 'pending' | 'success' | 'error'

const fmt = (wei: bigint) => parseFloat(formatEther(wei)).toFixed(4)

export function AttestButton({ agentId, agentName, className, variant = 'card' }: AttestButtonProps) {
  const { isConnected, address, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { openConnectModal } = useConnectModal()

  const [open, setOpen] = useState(false)
  // At 0 tTRUST the balance is re-read while this flow is open: coming back from the Hub, the
  // step moves on by itself. One retry: an RPC outage shouldn't hold "Checking…" through the
  // default three (the step then doesn't block — lib/attest-gate.ts).
  const balanceQuery = useBalance({
    address,
    query: { retry: 1, refetchInterval: (q) => (open && q.state.data?.value === 0n ? 8_000 : false) },
  })
  const balanceData = balanceQuery.data
  const [status, setStatus] = useState<Status>('pick')
  const [domain, setDomain] = useState<CanonicalDomainDef | null>(null)
  const [amount, setAmount] = useState('0.01')
  const [plan, setPlan] = useState<AttestPlan | null>(null)
  const [preview, setPreview] = useState<AttestCostPreview | null>(null)
  const [progressStep, setProgressStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<(AttestResult & { domain: CanonicalDomainDef; stake: string }) | null>(null)

  const step: AttestStep = attestStep({ connected: isConnected, chainId, balance: balanceReadOf(balanceQuery) })
  const wrongNetwork = step === 'wrong-network'

  const stakeWei = useMemo(() => {
    try {
      const f = parseFloat(amount)
      if (!f || f <= 0) return null
      return parseEther(amount)
    } catch {
      return null
    }
  }, [amount])

  // Resolve the plan when a domain is picked (read-only on-chain reads)
  useEffect(() => {
    let cancelled = false
    if (!open || !domain || !publicClient || wrongNetwork) return
    setPlan(null)
    setPreview(null)
    resolveAttestPlan(publicClient, agentId as `0x${string}`, domain)
      .then(p => { if (!cancelled) { setPlan(p); setErrorMsg('') } })
      .catch(err => {
        if (cancelled) return
        setErrorMsg(err instanceof AttestError ? err.message : 'Failed to load on-chain state.')
      })
    return () => { cancelled = true }
  }, [open, domain, publicClient, wrongNetwork, agentId])

  // Honest cost preview — recomputed when the plan or stake changes
  useEffect(() => {
    let cancelled = false
    if (!open || !plan || !publicClient || !stakeWei || wrongNetwork) {
      setPreview(null)
      return
    }
    previewAttestCost(publicClient, plan, stakeWei, address)
      .then(c => { if (!cancelled) setPreview(c) })
      .catch(err => {
        if (cancelled) return
        setPreview(null)
        setErrorMsg(err instanceof AttestError ? err.message : 'Failed to compute cost preview.')
      })
    return () => { cancelled = true }
  }, [open, plan, publicClient, stakeWei, wrongNetwork, address])

  function reset() {
    setStatus('pick')
    setDomain(null)
    setPlan(null)
    setPreview(null)
    setErrorMsg('')
    setProgressStep('')
  }

  function close() {
    if (status === 'pending') return
    setOpen(false)
    reset()
  }

  async function execute() {
    if (!walletClient || !publicClient || !domain || !stakeWei) return
    setStatus('pending')
    setErrorMsg('')
    try {
      const cfg = createWriteConfig(walletClient, publicClient)
      const res = await attestAgentSkill(
        cfg,
        agentId as `0x${string}`,
        domain,
        stakeWei,
        step => setProgressStep(step),
      )
      setResult({ ...res, domain, stake: amount })
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof AttestError ? err.message : 'Transaction failed.')
      setStatus('error')
    }
  }

  const balanceStr = balanceData ? parseFloat(formatEther(balanceData.value)).toFixed(3) : '—'
  const isFirstInDomain = plan != null && plan.path !== 'deposit'

  return (
    <div className={className}>
      <button
        onClick={() => {
          if (!isConnected) {
            // Connect first, then straight into this agent's vouch flow.
            openConnectModal({ reason: connectToVouch(agentName), onConnected: () => setOpen(true) })
            return
          }
          setOpen(true)
        }}
        data-testid="attest-cta"
        className={TRIGGER_STYLES[variant].className}
      >
        <Award className="w-4 h-4" />
        {VOUCH_CTA}
      </button>

      {/* Task 4 — minimal read-back: persistent confirmation after success */}
      {result && !open && (
        <div
          className="mt-3 rounded-xl px-4 py-3 text-sm flex items-start gap-2.5"
          style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.25)' }}
        >
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#2ECC71' }} />
          <div className="min-w-0">
            <p style={{ color: '#2ECC71' }}>
              {VOUCHED_FOR} <span className="font-semibold">{agentName}</span> in{' '}
              <span className="font-semibold">{result.domain.emoji} {result.domain.label}</span>
              {' '}· stake {result.stake} tTRUST
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              On-chain confirmed · may take a minute to appear in stats (indexing)
              {' · '}
              <a
                href={`${INTUITION_TESTNET.explorer}/tx/${result.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5"
                style={{ color: '#8B5CF6' }}
              >
                view tx <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              // Centered by margins, not translate: framer-motion writes `transform` inline, which
              // overrode -translate-x-1/2 and left the dialog right of center on desktop.
              className="fixed inset-x-4 top-[8%] md:inset-x-0 md:mx-auto md:w-full md:max-w-md z-50"
            >
              <div className="glass-card overflow-hidden rounded-2xl" style={{ background: 'rgba(15,17,19,0.95)', border: '1px solid rgba(139,92,246,0.2)' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10" style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Award className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                    {vouchFor(agentName)}
                  </h2>
                  <button onClick={close} disabled={status === 'pending'} className="p-1 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30">
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Before the picker: the one step between this person and signing (lib/attest-gate.ts) */}
                  {step !== 'ready' && (status === 'pick' || status === 'preview' || status === 'error') && (
                    <AttestStepPanel step={step} agentName={agentName} />
                  )}

                  {/* ── Success ── */}
                  {status === 'success' && result && (
                    <div className="space-y-3 text-center py-4">
                      <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center" style={{ background: 'rgba(46,204,113,0.15)' }}>
                        <Check className="w-6 h-6" style={{ color: '#2ECC71' }} />
                      </div>
                      <p className="text-sm text-white">
                        {VOUCH_SUCCESS} <span className="font-semibold">{result.domain.emoji} {result.domain.label}</span> · stake {result.stake} tTRUST
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{VOUCH_INDEXING}</p>
                      <a
                        href={`${INTUITION_TESTNET.explorer}/tx/${result.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline"
                        style={{ color: '#8B5CF6' }}
                      >
                        View transaction on explorer <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={close}
                        className="block w-full py-2 rounded-xl text-sm font-medium mt-2"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                      >
                        Done
                      </button>
                    </div>
                  )}

                  {/* ── Pending ── */}
                  {status === 'pending' && (
                    <div className="space-y-3 text-center py-6">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: '#8B5CF6' }} />
                      <p className="text-sm text-white">{progressStep || 'Waiting for wallet…'}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Confirm in your wallet. Do not close this window.
                      </p>
                    </div>
                  )}

                  {/* ── Pick + preview ── */}
                  {step === 'ready' && (status === 'pick' || status === 'preview' || status === 'error') && (
                    <>
                      {/* Domain picker — constrained to the 8 canonical buckets */}
                      <div>
                        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{VOUCH_AREA_LABEL}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CANONICAL_DOMAINS_REGISTRY.map(d => (
                            <button
                              key={d.termId}
                              onClick={() => { setDomain(d); setStatus('preview'); setErrorMsg('') }}
                              className="px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all truncate"
                              style={domain?.termId === d.termId
                                ? { background: `${d.color}20`, border: `1px solid ${d.color}60`, color: d.color }
                                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                            >
                              {d.emoji} {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stake amount */}
                      {domain && (
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              Stake (tTRUST)
                            </label>
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              Balance: {balanceStr} tTRUST
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: '#12151A', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)' }}
                          />
                        </div>
                      )}

                      {/* Honest cost preview — displayed BEFORE signing = charged */}
                      {domain && preview && (
                        <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {isFirstInDomain && (
                            <p className="text-[10px] pb-1" style={{ color: '#F59E0B' }}>{firstVouchNote(domain.label, preview.txCount)}</p>
                          )}
                          <Row label="Your stake" value={`${fmt(preview.stakeWei)} tTRUST`} />
                          {preview.creationCostWei > 0n && (
                            <Row label="One-time creation cost" value={`${fmt(preview.creationCostWei)} tTRUST`} />
                          )}
                          <Row label="Fixed fee" value={`${fmt(preview.fixedFeeWei)} tTRUST`} />
                          <Row label="Protocol fee (2.5%)" value={`${fmt(preview.percentageFeeWei)} tTRUST`} />
                          <div className="flex justify-between text-[11px] pt-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Total charged</span>
                            <span className="font-mono font-semibold" style={{ color: '#8B5CF6' }}>
                              {fmt(preview.totalWei)} tTRUST
                            </span>
                          </div>
                          {preview.approvalPending && (
                            <p className="text-[10px] pt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              plus a one-time approval transaction (first use)
                            </p>
                          )}
                        </div>
                      )}
                      {domain && !preview && !errorMsg && (
                        <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          <Loader2 className="w-3 h-3 animate-spin" /> Reading on-chain state…
                        </p>
                      )}

                      {/* Error */}
                      {errorMsg && (
                        <p className="text-xs leading-snug flex items-start gap-1.5" style={{ color: '#EF4444' }}>
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {errorMsg}
                        </p>
                      )}

                      {/* Confirm */}
                      <button
                        onClick={execute}
                        disabled={!domain || !stakeWei || !preview || wrongNetwork}
                        className="btn-primary w-full"
                      >
                        {domain ? vouchIn(domain.label) : VOUCH_PICK_AREA}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** One step, one way forward. data-step is what the harness reads. */
function AttestStepPanel({ step, agentName }: { step: Exclude<AttestStep, 'ready'>; agentName: string }) {
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: switching, isError: switchFailed } = useSwitchChain()
  const box = 'rounded-xl p-4 space-y-3 text-sm'
  const primary = 'btn-primary w-full'

  if (step === 'disconnected') {
    return (
      <div className={box} style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }} data-testid="attest-step" data-step={step}>
        <p className="text-white">{connectToVouch(agentName)}</p>
        <button className={primary} onClick={() => openConnectModal({ reason: connectToVouch(agentName) })}>
          <Wallet className="w-4 h-4" /> Connect wallet
        </button>
      </div>
    )
  }
  if (step === 'wrong-network') {
    return (
      <div className={box} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }} data-testid="attest-step" data-step={step}>
        <p className="text-white">{VOUCH_WRONG_NETWORK}</p>
        <button className={primary} disabled={switching} onClick={() => switchChain({ chainId: ATTEST_CHAIN_ID })}>
          {switching ? <><Loader2 className="w-4 h-4 animate-spin" /> Switching…</> : 'Switch to Intuition Testnet'}
        </button>
        {switchFailed && (
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your wallet didn&apos;t switch. Pick Intuition Testnet (chain {ATTEST_CHAIN_ID}) in the wallet itself.
          </p>
        )}
      </div>
    )
  }
  if (step === 'checking-balance') {
    return (
      <p className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }} data-testid="attest-step" data-step={step}>
        <Loader2 className="w-3 h-3 animate-spin" /> Checking your tTRUST balance…
      </p>
    )
  }
  return (
    <div className={box} style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.25)' }} data-testid="attest-step" data-step={step}>
      <p className="text-white">You need a little testnet tTRUST to vouch — it&apos;s free.</p>
      <a href={INTUITION_HUB_URL} target="_blank" rel="noopener noreferrer" className={primary}>
        <Droplets className="w-4 h-4" /> Get free tTRUST from Intuition Hub <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>This moves on by itself once the tTRUST arrives.</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      <span className="font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{value}</span>
    </div>
  )
}
