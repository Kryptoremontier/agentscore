'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, Circle, Bug, Clock, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FeedbackEntry } from '@/lib/feedback-store'

type Filter = 'all' | 'open' | 'resolved'

function shortAddress(sender: string): string {
  if (sender === 'Anonymous') return 'Anonymous'
  if (sender.startsWith('0x') && sender.length >= 10) {
    return `${sender.slice(0, 6)}…${sender.slice(-4)}`
  }
  return sender
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function FeedbackAdminClient() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [adminToken, setAdminToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [, startTransition] = useTransition()

  const openCount = entries.filter(e => !e.resolved).length

  const filtered = entries.filter(e => {
    if (filter === 'open') return !e.resolved
    if (filter === 'resolved') return e.resolved
    return true
  })

  const loadEntries = async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        headers: { 'x-admin-token': token },
        cache: 'no-store',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? `GET failed (${res.status})`)
      }
      setEntries(await res.json() as FeedbackEntry[])
      setAdminToken(token)
      sessionStorage.setItem('feedbackAdminToken', token)
    } catch (err) {
      setAdminToken('')
      sessionStorage.removeItem('feedbackAdminToken')
      setError(err instanceof Error ? err.message : 'Unable to load feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('feedbackAdminToken')
    if (saved) {
      setTokenInput(saved)
      void loadEntries(saved)
    }
  }, [])

  const submitToken = (e: React.FormEvent) => {
    e.preventDefault()
    const token = tokenInput.trim()
    if (!token) {
      setError('Enter an admin token.')
      return
    }
    void loadEntries(token)
  }

  const resetToken = () => {
    setAdminToken('')
    setTokenInput('')
    setEntries([])
    setError(null)
    sessionStorage.removeItem('feedbackAdminToken')
  }

  const toggleResolved = (id: string) => {
    const entry = entries.find(e => e.id === id)
    if (!entry || !adminToken) return

    // Optimistic update
    setEntries(prev =>
      prev.map(e => e.id === id ? { ...e, resolved: !e.resolved } : e)
    )

    startTransition(async () => {
      try {
        const res = await fetch(`/api/feedback/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
          body: JSON.stringify({ resolved: !entry.resolved }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(json.error ?? 'PATCH failed')
        }
        const updated = await res.json() as FeedbackEntry
        setEntries(prev => prev.map(e => e.id === id ? updated : e))
      } catch (err) {
        // Revert on failure
        setEntries(prev =>
          prev.map(e => e.id === id ? { ...e, resolved: entry.resolved } : e)
        )
        setError(err instanceof Error ? err.message : 'Unable to update feedback.')
      }
    })
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <div>
      {!adminToken && (
        <form
          onSubmit={submitToken}
          className="rounded-2xl p-5 mb-6"
          style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">
            Admin token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Enter x-admin-token"
              className="min-w-0 flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: '#C8963C' }}
            >
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
          <p className="mt-2 text-xs text-white/25">
            Local development fallback token is <code>dev-admin</code> when FEEDBACK_ADMIN_TOKEN is not set.
          </p>
        </form>
      )}

      {adminToken && (
        <div className="flex justify-end mb-4">
          <button onClick={resetToken} className="text-xs text-white/35 hover:text-white/70">
            Change admin token
          </button>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl p-3 mb-4 text-sm text-red-300"
          style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          {error}
        </div>
      )}

      {!adminToken ? null : (
        <>
      {/* Stats + filter bar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold px-3 py-1 rounded-full"
            style={{
              background: openCount > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: openCount > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
              color: openCount > 0 ? '#f87171' : '#4ade80',
            }}
          >
            {openCount} open bug{openCount !== 1 ? 's' : ''}
          </span>
          <span className="text-sm text-white/30">{entries.length} total</span>
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={filter === f.key ? {
                background: 'rgba(255,255,255,0.10)',
                color: '#fff',
              } : {
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div
          className="rounded-2xl p-12 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Bug className="w-10 h-10 text-white/10" />
          <div className="text-center">
            <div className="text-white/40 font-medium">
              {filter === 'all' ? 'No bug reports yet' : `No ${filter} reports`}
            </div>
            <div className="text-xs text-white/20 mt-1">
              {filter === 'all' ? 'Reports submitted via the sidebar will appear here.' : `Switch to "All" to see other reports.`}
            </div>
          </div>
        </div>
      )}

      {/* Report list */}
      <div className="space-y-3">
        {filtered.map(entry => (
          <div
            key={entry.id}
            className="rounded-2xl p-5 transition-all"
            style={{
              background: entry.resolved ? 'rgba(10,12,16,0.6)' : 'rgba(15,17,19,0.85)',
              border: entry.resolved
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(239,68,68,0.15)',
            }}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <User className="w-3.5 h-3.5 text-white/40" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-mono text-white/70 truncate">
                    {shortAddress(entry.sender)}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/25 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDate(entry.createdAt)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {entry.resolved && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
                  >
                    Resolved
                  </span>
                )}
                <button
                  onClick={() => toggleResolved(entry.id)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all',
                    entry.resolved
                      ? 'text-white/30 hover:text-white/60'
                      : 'text-green-400 hover:text-green-300',
                  )}
                  style={{
                    background: entry.resolved ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.08)',
                    border: entry.resolved ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(34,197,94,0.2)',
                  }}
                  title={entry.resolved ? 'Mark as open' : 'Mark as resolved'}
                >
                  {entry.resolved
                    ? <Circle className="w-3 h-3" />
                    : <CheckCircle2 className="w-3 h-3" />
                  }
                  {entry.resolved ? 'Reopen' : 'Resolve'}
                </button>
              </div>
            </div>

            {/* Message */}
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: entry.resolved ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.75)' }}
            >
              {entry.message}
            </p>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  )
}
