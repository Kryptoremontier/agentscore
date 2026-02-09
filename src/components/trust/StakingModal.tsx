'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  calculateSharePrice,
  calculateSharesForStake,
  PLATFORM_FEES
} from '@/types/tokenomics'

interface StakingModalProps {
  isOpen: boolean
  onClose: () => void
  agentId: string
  agentName: string
  currentTrustScore: number
  action: 'trust' | 'distrust'
}

// Mock $TRUST token balance - replace with actual wagmi hook
const MOCK_BALANCE = 1000

export function StakingModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  currentTrustScore,
  action,
}: StakingModalProps) {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const balance = MOCK_BALANCE

  const amountBigInt = useMemo(() => {
    try {
      const num = parseFloat(amount || '0')
      return BigInt(Math.floor(num * 1e18))
    } catch {
      return BigInt(0)
    }
  }, [amount])

  // Mock vault data - replace with real data from Intuition
  const vaultData = {
    totalShares: BigInt(1000e18),
    totalStaked: BigInt(5000e18),
    basePrice: BigInt(1e18),
  }

  const quote = useMemo(() => {
    if (amountBigInt === BigInt(0)) return null

    const shares = calculateSharesForStake(
      amountBigInt,
      vaultData.totalShares,
      vaultData.totalStaked,
      vaultData.basePrice
    )

    const currentPrice = calculateSharePrice(vaultData.totalShares, vaultData.basePrice)
    const fee = (amountBigInt * BigInt(PLATFORM_FEES.stakingFee)) / BigInt(10000)

    return {
      shares,
      pricePerShare: currentPrice,
      fee,
      netAmount: amountBigInt - fee,
    }
  }, [amountBigInt, vaultData])

  const handleSubmit = async () => {
    if (!quote) return
    setIsSubmitting(true)
    try {
      // TODO: Implement actual staking with Intuition SDK
      await new Promise(resolve => setTimeout(resolve, 2000))
      onClose()
    } catch (error) {
      console.error('Staking failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const setPercentage = (percent: number) => {
    const value = (balance * percent) / 100
    setAmount(value.toString())
  }

  const isTrust = action === 'trust'
  const formatToken = (value: bigint) => (Number(value) / 1e18).toFixed(4)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="glass-card overflow-hidden">
              {/* Header */}
              <div className={cn(
                'flex items-center justify-between p-4 border-b border-white/10',
                isTrust ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              )}>
                <h2 className="text-lg font-semibold">
                  {isTrust ? 'Stake Trust' : 'Stake Distrust'} on {agentName}
                </h2>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">

                {/* Agent Mini Card */}
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center text-xl font-bold">
                    {agentName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{agentName}</div>
                    <div className="text-sm text-slate-400">
                      Current score: <span className={cn(
                        'font-mono font-bold',
                        currentTrustScore >= 70 ? 'text-emerald-400' : 'text-amber-400'
                      )}>{currentTrustScore}</span>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-3">
                  <label className="text-sm text-slate-400">Amount to stake</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      className={cn(
                        'w-full px-4 py-4 pr-24 rounded-xl text-2xl font-mono',
                        'bg-white/5 border border-white/10',
                        'focus:outline-none focus:border-primary'
                      )}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      $TRUST
                    </div>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setPercentage(pct)}
                        className="flex-1 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Balance */}
                  <div className="text-sm text-slate-500">
                    Balance: {balance.toFixed(2)} $TRUST
                  </div>
                </div>

                {/* Quote Preview */}
                {quote && quote.shares > BigInt(0) && (
                  <div className="space-y-3 p-4 bg-white/5 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">You will receive</span>
                      <span className="font-mono font-medium">
                        {formatToken(quote.shares)} shares
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Price per share</span>
                      <span className="font-mono">
                        {formatToken(quote.pricePerShare)} $TRUST
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Platform fee ({PLATFORM_FEES.stakingFee / 100}%)</span>
                      <span className="font-mono text-slate-500">
                        -{formatToken(quote.fee)} $TRUST
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between">
                      <span className="text-slate-400">Net amount staked</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {formatToken(quote.netAmount)} $TRUST
                      </span>
                    </div>
                  </div>
                )}

                {/* Bonding Curve Info */}
                <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-300">
                    <p className="font-medium text-primary">Bonding Curve</p>
                    <p className="mt-1">
                      Early supporters get more shares per $TRUST. As more people stake,
                      share price increases, making your position more valuable.
                    </p>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-300">
                    Staked tokens are locked. Withdrawing early may incur additional fees
                    and you may receive less than you staked if price drops.
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!quote || quote.shares === BigInt(0) || isSubmitting}
                  className={cn(
                    'w-full py-4 text-lg',
                    isTrust
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Staking...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5 mr-2" />
                      {isTrust ? 'Stake Trust' : 'Stake Distrust'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}