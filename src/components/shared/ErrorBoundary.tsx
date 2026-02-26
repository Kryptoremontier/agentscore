'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/GlassCard'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
    // TODO: Send to error reporting service
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <GlassCard className="max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-trust-critical/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-trust-critical" />
            </div>

            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-text-secondary mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <div className="mb-6 text-left w-full">
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded text-xs font-mono text-red-300 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  <strong className="text-red-400">{this.state.error.message}</strong>
                  {'\n\n'}
                  {this.state.error.stack}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Link href="/">
                <Button>
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </Link>
            </div>
          </GlassCard>
        </div>
      )
    }

    return this.props.children
  }
}