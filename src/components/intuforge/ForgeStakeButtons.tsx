'use client'

/**
 * ForgeStakeButtons — Support / Oppose staking for IntuForge projects.
 *
 * Uses depositToVault (same function as agents page) with:
 *   Support vault = project atom's term_id
 *   Oppose vault  = counterTermId from [project][is][Intuition Project] triple
 */

import { useState, useRef } from 'react'
import { TrendingUp, TrendingDown, Loader2, Check, X } from 'lucide-react'
import { useWalletClient, usePublicClient, useAccount } from 'wagmi'
import { parseEther } from 'viem'
import { createWriteConfig, depositToVault } from '@/lib/intuition'

interface ForgeStakeButtonsProps {
  atomId: string
  counterTermId?: string | null
  projectName: string
  onStakeSuccess?: () => void
}

type Status = 'idle' | 'amount' | 'pending' | 'success' | 'error'

export function ForgeStakeButtons({
  atomId,
  counterTermId,
  projectName,
  onStakeSuccess,
}: ForgeStakeButtonsProps) {
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [side, setSide] = useState<'support' | 'oppose' | null>(null)
  const [amount, setAmount] = useState('0.01')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const isExecuting = useRef(false)

  function openModal(s: 'support' | 'oppose') {
    if (!isConnected) {
      alert('Connect your wallet to Intuition Testnet first.')
      return
    }
    setSide(s)
    setAmount('0.01')
    setStatus('amount')
    setErrorMsg('')
  }

  function cancel() {
    if (isExecuting.current) return
    setSide(null)
    setStatus('idle')
    setErrorMsg('')
  }

  async function execute() {
    if (!walletClient || !publicClient || !side || isExecuting.current) return

    const vaultId: `0x${string}` | null =
      side === 'support'
        ? (atomId as `0x${string}`)
        : counterTermId
        ? (counterTermId as `0x${string}`)
        : null

    if (!vaultId) {
      setErrorMsg(
        side === 'oppose'
          ? 'Oppose vault not activated yet. Back the project first to set it up.'
          : 'Invalid project vault ID.',
      )
      setStatus('error')
      return
    }

    const amountFloat = parseFloat(amount)
    if (!amountFloat || amountFloat <= 0) {
      setErrorMsg('Enter a valid amount.')
      setStatus('error')
      return
    }

    isExecuting.current = true
    setStatus('pending')
    setErrorMsg('')

    try {
      const cfg = createWriteConfig(walletClient, publicClient)
      await depositToVault(cfg, vaultId, parseEther(amount))
      setStatus('success')
      setTimeout(() => {
        cancel()
        onStakeSuccess?.()
      }, 2500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setErrorMsg(msg)
      setStatus('error')
    } finally {
      isExecuting.current = false
    }
  }

  if (status === 'success') {
    return (
      <div
        className="py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium"
        style={{ background: 'rgba(46,204,113,0.10)', border: '1px solid rgba(46,204,113,0.30)', color: '#2ECC71' }}
      >
        <Check className="w-4 h-4" />
        Staked successfully!
      </div>
    )
  }

  if (status === 'idle') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => openModal('support')}
          className="py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(46,230,214,0.08)', border: '1px solid rgba(46,230,214,0.2)', color: '#2EE6D6' }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          onClick={() => openModal('oppose')}
          className="py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' }}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Oppose
        </button>
      </div>
    )
  }

  // amount / pending / error states — inline modal
  const isBacking = side === 'support'
  const accent       = isBacking ? '#2EE6D6' : '#EF4444'
  const accentBg     = isBacking ? 'rgba(46,230,214,0.08)' : 'rgba(239,68,68,0.08)'
  const accentBorder = isBacking ? 'rgba(46,230,214,0.22)' : 'rgba(239,68,68,0.22)'

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,17,19,0.9)', border: `1px solid ${accentBorder}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: accent }}>
          {isBacking
            ? <><TrendingUp className="w-3.5 h-3.5" /> Back</>
            : <><TrendingDown className="w-3.5 h-3.5" /> Oppose</>
          }
          <span className="text-white/40 font-normal">{projectName}</span>
        </span>
        <button
          onClick={cancel}
          disabled={status === 'pending'}
          className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-30"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <label className="block text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Amount (tTRUST)
        </label>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={status === 'pending'}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors disabled:opacity-40"
          style={{ background: '#12151A', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)' }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
          + 0.02 base fee + 2.5% protocol fee
        </p>
      </div>

      {status === 'error' && errorMsg && (
        <p className="text-xs leading-snug" style={{ color: '#EF4444' }}>{errorMsg}</p>
      )}

      <button
        onClick={execute}
        disabled={status === 'pending' || !amount || parseFloat(amount) <= 0}
        className="w-full py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: accentBg, border: `1px solid ${accentBorder}`, color: accent }}
      >
        {status === 'pending' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Confirming…
          </>
        ) : (
          `Confirm ${isBacking ? 'Back' : 'Oppose'}`
        )}
      </button>
    </div>
  )
}
