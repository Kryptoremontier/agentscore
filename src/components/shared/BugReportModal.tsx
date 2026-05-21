'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bug, X, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { cn } from '@/lib/cn'

interface BugReportModalProps {
  open: boolean
  onClose: () => void
}

type ToastType = 'success' | 'error'

interface Toast {
  type: ToastType
  message: string
}

export function BugReportModal({ open, onClose }: BugReportModalProps) {
  const { address } = useAccount()

  const [sender, setSender] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Pre-fill sender when address changes or modal opens
  useEffect(() => {
    if (open) {
      setSender(address ?? '')
      setMessage('')
      setToast(null)
      setTimeout(() => textareaRef.current?.focus(), 80)
    }
  }, [open, address])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmedMessage = message.trim()
    if (trimmedMessage.length < 10) {
      setToast({ type: 'error', message: 'Please describe the bug in at least 10 characters.' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: sender.trim() || 'Anonymous',
          message: trimmedMessage,
        }),
      })

      if (res.status === 201) {
        setToast({ type: 'success', message: 'Bug report sent! Thank you.' })
        setMessage('')
        setTimeout(() => onClose(), 1800)
      } else {
        const json = await res.json().catch(() => ({}))
        setToast({ type: 'error', message: (json as { error?: string }).error ?? 'Something went wrong.' })
      }
    } catch {
      setToast({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = message.trim().length >= 10

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const modal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[760px]"
          >
            <div
              className="glass-card overflow-hidden rounded-2xl"
              style={{
                background: 'linear-gradient(180deg, rgba(18,18,24,0.96) 0%, rgba(10,10,15,0.98) 100%)',
                border: '1px solid rgba(200,150,60,0.22)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.62), 0 0 80px rgba(200,150,60,0.08)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6"
                style={{ borderBottom: '1px solid rgba(200,150,60,0.14)' }}
              >
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                    <Bug className="h-3.5 w-3.5" />
                    Report Bug
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    Help improve <span className="bg-gradient-to-r from-[#C9A84C] via-[#C8963C] to-[#A87820] bg-clip-text text-transparent">AgentScore</span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Share what broke, what you expected, and the steps to reproduce it.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:border-[#C8963C]/35 hover:bg-[#C8963C]/10"
                  aria-label="Close bug report modal"
                >
                  <X className="h-4 w-4 text-white/60" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
                {/* Sender */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Your wallet
                  </label>
                  {address ? (
                    <div
                      className="w-full rounded-xl px-3 py-2.5 font-mono text-sm text-slate-300"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(200,150,60,0.14)',
                      }}
                    >
                      {address}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={sender}
                      onChange={e => setSender(e.target.value)}
                      placeholder="Anonymous"
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/25',
                        'bg-transparent outline-none transition-colors',
                      )}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(200,150,60,0.14)',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(200,150,60,0.4)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(200,150,60,0.14)' }}
                    />
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Describe the bug <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="What happened? What did you expect? Steps to reproduce..."
                    rows={8}
                    required
                    className={cn(
                      'w-full rounded-xl px-3 py-3 text-sm text-white/80 placeholder-white/25',
                      'resize-none outline-none transition-colors',
                    )}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(200,150,60,0.14)',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(200,150,60,0.4)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(200,150,60,0.14)' }}
                  />
                  <div className="mt-1 flex justify-end">
                    <span
                      className="text-[10px]"
                      style={{ color: message.trim().length >= 10 ? 'rgba(255,255,255,0.28)' : '#EF4444' }}
                    >
                      {message.trim().length} / 10 min
                    </span>
                  </div>
                </div>

                {/* Toast */}
                <AnimatePresence>
                  {toast && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
                      style={{
                        background: toast.type === 'success'
                          ? 'rgba(34,197,94,0.12)'
                          : 'rgba(239,68,68,0.12)',
                        border: toast.type === 'success'
                          ? '1px solid rgba(34,197,94,0.3)'
                          : '1px solid rgba(239,68,68,0.3)',
                      }}
                    >
                      {toast.type === 'success'
                        ? <CheckCircle className="w-4 h-4 shrink-0 text-green-400" />
                        : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      }
                      <span style={{ color: toast.type === 'success' ? '#4ade80' : '#f87171' }}>
                        {toast.message}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all"
                  style={{
                    background: isValid && !submitting
                      ? 'linear-gradient(90deg, #C8963C 0%, #A87820 100%)'
                      : 'rgba(200,150,60,0.18)',
                    color: isValid && !submitting ? '#0F1113' : 'rgba(255,255,255,0.35)',
                    cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
                    boxShadow: isValid && !submitting ? '0 14px 32px rgba(200,150,60,0.24)' : 'none',
                  }}
                >
                  {submitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                  {submitting ? 'Sending…' : 'Send Bug Report'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
