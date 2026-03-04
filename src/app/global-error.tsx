'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: '#0F1113', color: '#fff', fontFamily: 'system-ui', margin: 0, padding: 24, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: '#9ca3af', marginBottom: 20 }}>
            The application encountered an error. Try refreshing the page.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{ background: 'rgba(239,68,68,0.1)', padding: 16, borderRadius: 8, overflow: 'auto', textAlign: 'left', fontSize: 12, color: '#fca5a5' }}>
              {error.message}
            </pre>
          )}
          <button
            onClick={() => reset()}
            style={{ marginTop: 16, padding: '12px 24px', background: '#C8963C', color: '#000', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
