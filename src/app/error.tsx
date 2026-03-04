'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 bg-[#0F1113]">
      <div className="max-w-md w-full bg-[#171A1D] border border-[#ef4444]/20 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-[#ef4444]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-[#B5BDC6] mb-4">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mb-6 p-4 bg-black/40 rounded-lg text-left text-xs text-red-300 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button onClick={reset} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Link href="/">
            <Button className="gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
