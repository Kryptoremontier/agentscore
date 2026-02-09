'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, FileText, Link2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { ReportType } from '@/types/attestation'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  agentId: string
  agentName: string
}

const reportTypes: {
  value: ReportType
  label: string
  description: string
  severity: 'high' | 'medium' | 'low'
  icon: any
}[] = [
  {
    value: 'scam',
    label: 'Scam / Fraud',
    description: 'Agent is attempting to steal funds or credentials',
    severity: 'high',
    icon: AlertTriangle,
  },
  {
    value: 'prompt_injection',
    label: 'Prompt Injection',
    description: 'Agent is vulnerable to or performing prompt injection attacks',
    severity: 'high',
    icon: Shield,
  },
  {
    value: 'spam',
    label: 'Spam / Unwanted Messages',
    description: 'Agent sends excessive or irrelevant messages',
    severity: 'medium',
    icon: FileText,
  },
  {
    value: 'impersonation',
    label: 'Impersonation',
    description: 'Agent is pretending to be another entity',
    severity: 'medium',
    icon: Link2,
  },
  {
    value: 'other',
    label: 'Other Issue',
    description: 'Other problematic behavior not listed above',
    severity: 'low',
    icon: AlertTriangle,
  },
]

const severityConfig = {
  high: { color: 'text-trust-critical', bg: 'bg-trust-critical/10', label: 'High Risk' },
  medium: { color: 'text-trust-low', bg: 'bg-trust-low/10', label: 'Medium Risk' },
  low: { color: 'text-trust-moderate', bg: 'bg-trust-moderate/10', label: 'Low Risk' },
}

export function ReportModal({
  isOpen,
  onClose,
  agentId,
  agentName,
}: ReportModalProps) {
  const [reportType, setReportType] = useState<ReportType | null>(null)
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState('')
  const [stakeAmount, setStakeAmount] = useState('10')
  const [loading, setLoading] = useState(false)

  const selectedReport = reportTypes.find(r => r.value === reportType)

  const handleSubmit = async () => {
    setLoading(true)
    // TODO: Implement actual report submission
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(false)
    onClose()
  }

  const isValid = reportType && description && stakeAmount && Number(stakeAmount) >= 10

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-trust-critical" />
                  Report Agent
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Agent: {agentName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Report Type Selection */}
            <div className="space-y-4 mb-6">
              <label className="block text-sm font-medium">
                What issue are you reporting?
              </label>
              <div className="grid gap-3">
                {reportTypes.map(report => {
                  const severity = severityConfig[report.severity]
                  const Icon = report.icon
                  const isSelected = reportType === report.value

                  return (
                    <button
                      key={report.value}
                      onClick={() => setReportType(report.value)}
                      className={cn(
                        'glass rounded-lg p-4 text-left transition-all',
                        isSelected ? 'ring-2 ring-primary' : 'hover:bg-white/10'
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <span className={cn('p-2 rounded-lg inline-block', severity.bg)}>
                          <Icon className={cn('w-5 h-5', severity.color)} />
                        </span>
                        <span className="flex-1 block">
                          <span className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{report.label}</span>
                            <Badge variant="outline" size="sm" className={severity.color}>
                              {severity.label}
                            </Badge>
                          </span>
                          <span className="text-sm text-text-secondary block">
                            {report.description}
                          </span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 mb-6">
              <label className="block text-sm font-medium">
                Describe the issue <span className="text-trust-critical">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide details about what happened..."
                className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none resize-none"
                rows={4}
              />
              <p className="text-xs text-text-muted">
                Minimum 20 characters. Be specific and factual.
              </p>
            </div>

            {/* Evidence */}
            <div className="space-y-2 mb-6">
              <label className="block text-sm font-medium">
                Evidence (optional)
              </label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Transaction hashes, screenshots, logs, etc..."
                className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none resize-none"
                rows={3}
              />
            </div>

            {/* Stake Amount */}
            <div className="space-y-2 mb-6">
              <label className="block text-sm font-medium">
                Stake Amount (minimum 10 $TRUST)
              </label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="10"
                step="10"
                className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none font-mono"
              />
              <p className="text-xs text-text-muted">
                Higher stakes signal stronger conviction in your report
              </p>
            </div>

            {/* Warning */}
            <div className="glass rounded-lg p-4 mb-6 border border-trust-moderate/20">
              <h4 className="font-medium text-trust-moderate mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Important Notice
              </h4>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• False reports may result in stake slashing</li>
                <li>• Your report will be public and linked to your address</li>
                <li>• Stakes are locked for 30 days minimum</li>
                <li>• Multiple valid reports increase agent penalties</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !isValid}
                className="flex-1 bg-trust-critical hover:bg-trust-critical/90"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Report ({stakeAmount} $TRUST)
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}