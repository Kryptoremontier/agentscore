'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

interface AgentResult {
  term_id: string
  label: string
  creator?: { label: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

async function fetchFromIntuition(search: string): Promise<AgentResult[]> {
  const whereConditions = [`{ label: { _ilike: "Agent:%" } }`]
  if (search.trim()) {
    whereConditions.push(`{ label: { _ilike: "%${search.trim()}%" } }`)
  }
  const where = `{ _and: [${whereConditions.join(', ')}] }`

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query SearchAgents {
          atoms(
            where: ${where}
            order_by: { created_at: desc }
            limit: 8
          ) {
            term_id
            label
            creator { label }
            positions_aggregate { aggregate { count sum { shares } } }
          }
        }
      `,
    }),
  })
  const data = await res.json()
  if (data.errors) {
    console.error('[SearchModal] GraphQL errors:', data.errors)
    return []
  }
  return data.data?.atoms ?? []
}

function agentName(label: string) {
  return label.replace(/^Agent:\s*/i, '').split(' - ')[0].trim()
}

function agentScore(agent: AgentResult): number {
  const shares = Number(agent.positions_aggregate?.aggregate?.sum?.shares ?? 0) / 1e18
  // Simple 0-100 from stake amount (capped at 100 tTRUST = score 100)
  return Math.min(100, Math.round(shares))
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AgentResult[]>([])
  const [popular, setPopular] = useState<AgentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset + focus on open; pre-load popular agents
  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setSearched(false)
    setActiveIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)

    if (popular.length === 0) {
      fetchFromIntuition('').then(setPopular).catch(() => {})
    }
  }, [open])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Debounced search on query change
  useEffect(() => {
    if (!open) return
    if (!query.trim()) { setResults([]); setSearched(false); return }

    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const data = await fetchFromIntuition(query)
        setResults(data)
        setActiveIndex(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
        setSearched(true)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  // Keyboard: arrows + enter + esc
  useEffect(() => {
    if (!open) return
    const list = query.trim() ? results : popular
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { onClose(); return }
      if (list.length === 0)     return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, list.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); const hit = list[activeIndex]; if (hit) navigate(hit.term_id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, popular, activeIndex, query])

  function navigate(termId: string) {
    onClose()
    router.push(`/agents?open=${termId}`)
  }

  const displayList = query.trim() ? results : popular
  const sectionLabel = query.trim() ? 'Results' : 'Popular Agents'

  return (
    <AnimatePresence>
      {open && (
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
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50"
          >
            <div className="glass-card overflow-hidden">

              {/* Search input row */}
              <div className="flex items-center gap-4 p-4 border-b border-white/10">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setActiveIndex(0) }}
                  placeholder="Search agents, platforms, addresses..."
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-slate-500"
                />
                {query ? (
                  <button
                    onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus() }}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                ) : (
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Results area */}
              <div className="max-h-[60vh] overflow-y-auto p-2">

                {/* Loading */}
                {loading && (
                  <div className="px-3 py-2 text-xs text-slate-500">Searching...</div>
                )}

                {/* No results */}
                {searched && !loading && results.length === 0 && query.trim() && (
                  <div className="px-3 py-6 text-center text-slate-500 text-sm">
                    No agents found for &ldquo;{query}&rdquo;
                  </div>
                )}

                {/* Agent list — popular (empty query) or search results */}
                {!loading && displayList.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <Shield className="w-3 h-3" />
                      {sectionLabel}
                    </div>

                    {displayList.map((agent, i) => {
                      const name    = agentName(agent.label)
                      const creator = agent.creator?.label?.replace('.eth', '') || null
                      const score   = agentScore(agent)
                      const stakers = agent.positions_aggregate?.aggregate?.count ?? 0

                      return (
                        <button
                          key={agent.term_id}
                          onClick={() => navigate(agent.term_id)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            'w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors text-left group',
                            i === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
                          )}
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5 text-white" />
                          </div>

                          {/* Name + creator */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{name}</div>
                            <div className="text-sm text-slate-400 truncate">
                              {creator ? `by ${creator}` : 'unknown'}{stakers > 0 ? ` · ${stakers} stakers` : ''}
                            </div>
                          </div>

                          {/* Score + arrow */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              'text-sm font-mono font-bold',
                              score >= 70 ? 'text-emerald-400' : 'text-amber-400'
                            )}>
                              {score}
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↵</kbd>
                    Open
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded">esc</kbd>
                  Close
                </span>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
