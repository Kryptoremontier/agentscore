'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Loader } from '@/components/ui/loader'

interface PageLoaderProps {
  loading: boolean
  fullScreen?: boolean
}

export function PageLoader({ loading, fullScreen = false }: PageLoaderProps) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0'}
        >
          <div className="h-full flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/20 animate-ping absolute" />
                <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center relative">
                  <Loader className="w-10 h-10 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-text-secondary animate-pulse">Loading...</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Inline loader for sections
export function SectionLoader() {
  return (
    <div className="py-8 flex justify-center">
      <div className="flex items-center gap-3">
        <Loader className="w-5 h-5 animate-spin text-primary" />
        <span className="text-text-secondary">Loading...</span>
      </div>
    </div>
  )
}

// Dots loader for buttons/inline
export function DotsLoader({ className }: { className?: string }) {
  return (
    <span className={className}>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
      >
        •
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
      >
        •
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
      >
        •
      </motion.span>
    </span>
  )
}