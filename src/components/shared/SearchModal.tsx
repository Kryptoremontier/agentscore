'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Shield, Zap, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

import { APP_CONFIG } from '@/lib/app-config'
import { AGENT_WHERE_STR, TRIPLE_SUBJECT_OR_STR, TRIPLE_OBJECT_OR_STR } from '@/lib/gql-filters'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

interface AgentResult {
  term_id: string
  label: string
  creator?: { label: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

async function fetchFromIntuition(search: string): Promise<AgentResult[]> {
  const whereConditions = [AGENT_WHERE_STR]
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
            limit: 6
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
    console.error('[SearchModal] GraphQL errors (agents):', data.errors)
    return []
  }
  return data.data?.atoms ?? []
}

interface ClaimResult {
  term_id: string
  subject: { term_id: string; label: string }
  predicate: { term_id: string; label: string }
  object: { term_id: string; label: string }
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

async function fetchClaimsFromIntuition(search: string): Promise<ClaimResult[]> {
  const searchFilter = search.trim()
    ? `, subject: { label: { _ilike: "%${search.trim()}%" } }`
    : ''
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query SearchClaims {
          triples(
            where: {
              _and: [
                { ${TRIPLE_SUBJECT_OR_STR} }
                { ${TRIPLE_OBJECT_OR_STR} }
              ]
              ${searchFilter}
            }
            order_by: { block_number: desc }
            limit: 5
          ) {
            term_id
            subject { term_id label }
            predicate { term_id label }
            object { term_id label }
            positions_aggregate { aggregate { count sum { shares } } }
          }
        }
      `,
    }),
  })
  const data = await res.json()
  if (data.errors) return []
  return data.data?.triples ?? []
}

async function fetchSkillsFromIntuition(search: string): Promise<AgentResult[]> {
  const whereConditions = [`{ label: { _ilike: "Skill:%" } }`]
  if (search.trim()) {
    whereConditions.push(`{ label: { _ilike: "%${search.trim()}%" } }`)
  }
  const where = `{ _and: [${whereConditions.join(', ')}] }`

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query SearchSkills {
          atoms(
            where: ${where}
            order_by: { created_at: desc }
            limit: 6
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
    console.error('[SearchModal] GraphQL errors (skills):', data.errors)
    return []
  }
  return data.data?.atoms ?? []
}

function agentName(label: string) {
  return label.replace(/^Agent:(?:\w+:)?\s*/i, '').split(' - ')[0].trim()
}

function skillName(label: string) {
  return label.replace(/^Skill:(?:\w+:)?\s*/i, '').split(' - ')[0].trim()
}

function itemScore(item: AgentResult): number {
  const shares = Number(item.positions_aggregate?.aggregate?.sum?.shares ?? 0) / 1e18
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
  const [agentResults, setAgentResults] = useState<AgentResult[]>([])
  const [skillResults, setSkillResults] = useState<AgentResult[]>([])
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([])
  const [popularAgents, setPopularAgents] = useState<AgentResult[]>([])
  const [popularSkills, setPopularSkills] = useState<AgentResult[]>([])
  const [popularClaims, setPopularClaims] = useState<ClaimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset + focus on open; pre-load popular
  useEffect(() => {
    if (!open) return
    setQuery('')
    setAgentResults([])
    setSkillResults([])
    setClaimResults([])
    setSearched(false)
    setActiveIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)

    if (popularAgents.length === 0) {
      fetchFromIntuition('').then(setPopularAgents).catch(() => {})
    }
    if (popularSkills.length === 0) {
      fetchSkillsFromIntuition('').then(setPopularSkills).catch(() => {})
    }
    if (popularClaims.length === 0) {
      fetchClaimsFromIntuition('').then(setPopularClaims).catch(() => {})
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
    if (!query.trim()) {
      setAgentResults([])
      setSkillResults([])
      setClaimResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const [agents, skills, claims] = await Promise.all([
          fetchFromIntuition(query),
          fetchSkillsFromIntuition(query),
          fetchClaimsFromIntuition(query),
        ])
        setAgentResults(agents)
        setSkillResults(skills)
        setClaimResults(claims)
        setActiveIndex(0)
      } catch {
        setAgentResults([])
        setSkillResults([])
        setClaimResults([])
      } finally {
        setLoading(false)
        setSearched(true)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  // Combined list for keyboard navigation
  const displayAgents = query.trim() ? agentResults : popularAgents
  const displaySkills = query.trim() ? skillResults : popularSkills
  const displayClaims = query.trim() ? claimResults : popularClaims
  const combinedList = [
    ...displayAgents.map(a => ({ item: a, type: 'agent' as const })),
    ...displaySkills.map(s => ({ item: s, type: 'skill' as const })),
    ...displayClaims.map(c => ({ item: c, type: 'claim' as const })),
  ]

  // Keyboard: arrows + enter + esc
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { onClose(); return }
      if (combinedList.length === 0) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, combinedList.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter') {
        e.preventDefault()
        const hit = combinedList[activeIndex]
        if (hit) {
          if (hit.type === 'claim') navigate((hit.item as ClaimResult).term_id, 'claim')
          else navigate((hit.item as AgentResult).term_id, hit.type as 'agent' | 'skill')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, combinedList, activeIndex, query])

  function navigate(termId: string, type: 'agent' | 'skill' | 'claim') {
    onClose()
    if (type === 'claim') router.push(`/claims?open=${termId}`)
    else router.push(`/${type === 'agent' ? 'agents' : 'skills'}?open=${termId}`)
  }

  const hasResults = displayAgents.length > 0 || displaySkills.length > 0 || displayClaims.length > 0
  const noResults = searched && !loading && agentResults.length === 0 && skillResults.length === 0 && claimResults.length === 0 && query.trim()

  // Track combined index offsets
  let globalIndex = 0

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
                  placeholder="Search agents, skills, addresses..."
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-slate-500"
                />
                {query ? (
                  <button
                    onClick={() => { setQuery(''); setAgentResults([]); setSkillResults([]); setSearched(false); inputRef.current?.focus() }}
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
                {noResults && (
                  <div className="px-3 py-6 text-center text-slate-500 text-sm">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                )}

                {/* Agents section */}
                {!loading && displayAgents.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <Shield className="w-3 h-3" />
                      {query.trim() ? 'Agents' : 'Popular Agents'}
                    </div>

                    {displayAgents.map((agent) => {
                      const idx = globalIndex++
                      const name    = agentName(agent.label)
                      const creator = agent.creator?.label?.replace('.eth', '') || null
                      const score   = itemScore(agent)
                      const stakers = agent.positions_aggregate?.aggregate?.count ?? 0

                      return (
                        <button
                          key={agent.term_id}
                          onClick={() => navigate(agent.term_id, 'agent')}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={cn(
                            'w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors text-left group',
                            idx === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
                          )}
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{name}</div>
                            <div className="text-sm text-slate-400 truncate">
                              {creator ? `by ${creator}` : 'unknown'}{stakers > 0 ? ` · ${stakers} stakers` : ''}
                            </div>
                          </div>
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

                {/* Skills section */}
                {!loading && displaySkills.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <Zap className="w-3 h-3" />
                      {query.trim() ? 'Skills' : 'Popular Skills'}
                    </div>

                    {displaySkills.map((skill) => {
                      const idx = globalIndex++
                      const name    = skillName(skill.label)
                      const creator = skill.creator?.label?.replace('.eth', '') || null
                      const score   = itemScore(skill)
                      const stakers = skill.positions_aggregate?.aggregate?.count ?? 0

                      return (
                        <button
                          key={skill.term_id}
                          onClick={() => navigate(skill.term_id, 'skill')}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={cn(
                            'w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors text-left group',
                            idx === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
                          )}
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{name}</div>
                            <div className="text-sm text-slate-400 truncate">
                              {creator ? `by ${creator}` : 'unknown'}{stakers > 0 ? ` · ${stakers} stakers` : ''}
                            </div>
                          </div>
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

                {/* Claims section */}
                {!loading && displayClaims.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <MessageSquare className="w-3 h-3" />
                      {query.trim() ? 'Claims' : 'Recent Claims'}
                    </div>
                    {displayClaims.map((claim) => {
                      const idx = globalIndex++
                      const subjName = claim.subject.label.replace(/^(Agent|Skill):\s*/i, '').split(' - ')[0].trim()
                      const objName  = claim.object.label.replace(/^(Agent|Skill):\s*/i, '').split(' - ')[0].trim()
                      const predLabel = claim.predicate.label
                      const score = Math.min(100, Math.round(Number(claim.positions_aggregate?.aggregate?.sum?.shares ?? 0) / 1e18))

                      return (
                        <button
                          key={claim.term_id}
                          onClick={() => navigate(claim.term_id, 'claim')}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={cn(
                            'w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors text-left group',
                            idx === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
                          )}
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center shrink-0 text-base">
                            💬
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate text-sm">
                              <span className="text-indigo-400">{subjName}</span>
                              <span className="text-slate-500 mx-1">{predLabel}</span>
                              <span className="text-emerald-400">{objName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn('text-sm font-mono font-bold', score >= 70 ? 'text-emerald-400' : 'text-amber-400')}>
                              {score}
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

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
