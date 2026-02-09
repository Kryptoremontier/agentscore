'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface TrustButtonProps {
  agentId: string
  className?: string
}

export function TrustButton({ agentId, className }: TrustButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [action, setAction] = useState<'trust' | 'distrust' | null>(null)
  const [stakeAmount, setStakeAmount] = useState('10')
  const [loading, setLoading] = useState(false)

  const handleAction = (type: 'trust' | 'distrust') => {
    setAction(type)
    setShowModal(true)
  }

  const handleSubmit = async () => {
    setLoading(true)
    // TODO: Implement actual staking logic
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(false)
    setShowModal(false)
    setAction(null)
  }

  return (
    <>
      <div className={cn('flex gap-3', className)}>
        <Button
          size="lg"
          onClick={() => handleAction('trust')}
          className="flex-1 glow-green"
        >
          <Shield className="w-5 h-5 mr-2" />
          Trust Agent
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => handleAction('distrust')}
          className="border-trust-critical text-trust-critical hover:bg-trust-critical/10"
        >
          <AlertTriangle className="w-5 h-5 mr-2" />
          Report Issue
        </Button>
      </div>

      {/* Staking Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {action === 'trust' ? 'Trust Agent' : 'Report Issue'}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {action === 'trust' ? (
                  <p className="text-text-secondary">
                    Stake $TRUST to attest that you trust this agent. Your stake helps
                    others verify agent reliability.
                  </p>
                ) : (
                  <p className="text-text-secondary">
                    Report an issue with this agent. Your stake will signal to others
                    that there may be problems.
                  </p>
                )}

                {/* Stake Amount Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Stake Amount ($TRUST)
                  </label>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    min="1"
                    step="1"
                    className="w-full px-4 py-2 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
                  />
                  <p className="text-sm text-text-muted mt-1">
                    Minimum stake: 1 $TRUST
                  </p>
                </div>

                {action === 'distrust' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Report Type
                    </label>
                    <select className="w-full px-4 py-2 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none">
                      <option value="scam">Scam / Fraud</option>
                      <option value="spam">Spam</option>
                      <option value="injection">Prompt Injection</option>
                      <option value="impersonation">Impersonation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}

                {/* Warning */}
                <div className="p-3 rounded-lg bg-trust-moderate/10 border border-trust-moderate/20">
                  <p className="text-sm text-trust-moderate">
                    ⚠️ Stakes are locked and can be slashed if your attestation is
                    deemed malicious or false.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !stakeAmount || Number(stakeAmount) < 1}
                  className={cn(
                    'flex-1',
                    action === 'trust'
                      ? 'bg-trust-good hover:bg-trust-good/90'
                      : 'bg-trust-critical hover:bg-trust-critical/90'
                  )}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block" />
                      Processing...
                    </>
                  ) : (
                    <>Stake {stakeAmount} $TRUST</>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}