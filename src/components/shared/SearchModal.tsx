'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Shield, Clock } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

// Mock search results - replace with real data
const recentSearches = ['OpenClaw Bot', 'Moltbook Agent', 'Trust Score API']
const popularAgents = [
  { id: '1', name: 'CodeHelper AI', score: 94, platform: 'moltbook' },
  { id: '2', name: 'DataAnalyst Pro', score: 87, platform: 'openclaw' },
  { id: '3', name: 'ContentWriter X', score: 78, platform: 'farcaster' },
]

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

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
              {/* Search Input */}
              <div className="flex items-center gap-4 p-4 border-b border-white/10">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search agents, platforms, addresses..."
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-slate-500"
                />
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {/* Recent Searches */}
                {!query && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      Recent Searches
                    </div>
                    {recentSearches.map((search) => (
                      <button
                        key={search}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <Search className="w-4 h-4 text-slate-400" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular Agents */}
                <div className="p-2 mt-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <Shield className="w-3 h-3" />
                    {query ? 'Results' : 'Popular Agents'}
                  </div>
                  {popularAgents
                    .filter((agent) =>
                      agent.name.toLowerCase().includes(query.toLowerCase())
                    )
                    .map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        onClick={onClose}
                        className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-slate-400">{agent.platform}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm font-mono font-bold',
                            agent.score >= 70 ? 'text-emerald-400' : 'text-amber-400'
                          )}>
                            {agent.score}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                </div>
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
