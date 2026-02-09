'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, WifiOff, ServerCrash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  error?: Error | null
  retry?: () => void
  className?: string
}

export function ErrorState({ error, retry, className }: ErrorStateProps) {
  // Determine error type
  const isNetworkError = error?.message?.toLowerCase().includes('network') ||
                       error?.message?.toLowerCase().includes('fetch')
  const isServerError = error?.message?.toLowerCase().includes('500') ||
                       error?.message?.toLowerCase().includes('server')

  const icon = isNetworkError ? WifiOff : isServerError ? ServerCrash : AlertCircle
  const title = isNetworkError
    ? 'Connection Error'
    : isServerError
    ? 'Server Error'
    : 'Something went wrong'
  const description = isNetworkError
    ? 'Please check your internet connection and try again.'
    : isServerError
    ? 'Our servers are having issues. Please try again later.'
    : 'An unexpected error occurred. Please try again.'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center py-12 px-4', className)}
    >
      <div className="glass rounded-xl p-8 max-w-md w-full text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-trust-critical/10 flex items-center justify-center mx-auto mb-4"
        >
          {React.createElement(icon, {
            className: 'w-8 h-8 text-trust-critical',
          })}
        </motion.div>

        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-text-secondary mb-6">{description}</p>

        {error && process.env.NODE_ENV === 'development' && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-text-muted hover:text-text-secondary">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-black/20 rounded text-xs overflow-auto">
              {error.message}
            </pre>
          </details>
        )}

        {retry && (
          <Button onClick={retry} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// Inline error message for forms
export function InlineError({ error, className }: { error: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('overflow-hidden', className)}
    >
      <div className="flex items-center gap-2 text-sm text-trust-critical mt-1">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    </motion.div>
  )
}