'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Layers, Search, Trophy, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { APP_CONFIG } from '@/lib/app-config'
import {
  aggregateDomains,
  scoreDomainAgents,
  cleanDomainName,
  type Domain,
  type DomainAgent,
  type DomainTripleData,
} from '@/lib/domain-scoring'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

// ─── Tier color helpers ───────────────────────────────────────────────────────

function levelColor(level: string): string {
  if (level === 'excellent') return '#10b981'
  if (level === 'good') return '#34d399'
  if (level === 'moderate') return '#f59e0b'
  if (level === 'low') return '#f97316'
  return '#ef4444'
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#34d399'
  if (score >= 40) return '#f59e0b'
  if (score >= 20) return '#f97316'
  return '#ef4444'
}

function rankColor(rank: number): string {
  if (rank === 1) return '#C8963C'
  if (rank === 2) return 'rgba(255,255,255,0.7)'
  if (rank === 3) return '#d97706'
  return 'rgba(255,255,255,0.3)'
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchDomainTriples(): Promise<DomainTripleData[]> {
  if (!GRAPHQL_URL) return []
  try {
    // Step 1: fetch all hasAgentSkill triples
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetAllDomainTriples {
            triples(
              where: {
                _or: [
                  { predicate: { label: { _eq: "hasAgentSkill" } } }
                  { predicate: { label: { _eq: "has-agent-skill" } } }
                  { predicate: { label: { _eq: "isTrustedFor" } } }
                ]
              }
              limit: 500
            ) {
              term_id
              counter_term_id
              subject { term_id label }
              predicate { label }
              object { term_id label }
            }
          }
        `,
      }),
    })
    const data = await res.json()
    if (data.errors) throw new Error(data.errors[0].message)

    const triples: Array<{
      term_id: string
      counter_term_id: string | null
      subject: { term_id: string; label: string }
      predicate: { label: string }
      object: { term_id: string; label: string }
    }> = data?.data?.triples || []

    if (triples.length === 0) return []

    // Step 2: collect vault IDs for position fetch
    const vaultIds: string[] = []
    for (const t of triples) {
      vaultIds.push(t.term_id)
      if (t.counter_term_id) vaultIds.push(t.counter_term_id)
    }

    // Step 3: batch-fetch positions
    const posRes = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetDomainPositions($vaultIds: [String!]!) {
            positions(where: { term_id: { _in: $vaultIds } }) {
              term_id
              shares
            }
          }
        `,
        variables: { vaultIds },
      }),
    })
    const posData = await posRes.json()
    const positions: Array<{ term_id: string; shares: string }> = posData?.data?.positions || []

    // Step 4: aggregate shares+count per vault
    const vaultMap = new Map<string, { totalShares: bigint; count: number }>()
    for (const pos of positions) {
      if (!pos.shares) continue
      const prev = vaultMap.get(pos.term_id) || { totalShares: 0n, count: 0 }
      try {
        vaultMap.set(pos.term_id, {
          totalShares: prev.totalShares + BigInt(pos.shares),
          count: prev.count + 1,
        })
      } catch { /* skip malformed */ }
    }

    // Step 5: build DomainTripleData[]
    return triples.map(t => {
      const forVault = vaultMap.get(t.term_id) || { totalShares: 0n, count: 0 }
      const againstVault = t.counter_term_id
        ? (vaultMap.get(t.counter_term_id) || { totalShares: 0n, count: 0 })
        : { totalShares: 0n, count: 0 }

      return {
        tripleId: t.term_id,
        agentId: t.subject?.term_id || '',
        agentName: t.subject?.label || 'Unknown',
        skillId: t.object?.term_id || '',
        skillName: t.object?.label || 'Unknown',
        supportShares: forVault.totalShares,
        opposeShares: againstVault.totalShares,
        supportPositionCount: forVault.count,
        opposePositionCount: againstVault.count,
      }
    })
  } catch (err) {
    console.warn('[fetchDomainTriples] Failed:', err)
    return []
  }
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function DomainCard({
  domain,
  selected,
  onClick,
}: {
  domain: Domain
  selected: boolean
  onClick: () => void
}) {
  const barPct = Math.min(domain.topAgentScore, 100)
  const color = scoreColor(domain.topAgentScore)

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 rounded-xl transition-all duration-200 group"
      style={{
        background: selected ? 'rgba(200,150,60,0.08)' : 'transparent',
        borderLeft: selected ? '2px solid #C8963C' : '2px solid transparent',
        paddingTop: selected ? '10px' : '8px',
        paddingBottom: selected ? '10px' : '8px',
      }}
    >
      {/* Always visible: name + score dot */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white truncate group-hover:text-white/90">
          {domain.name}
        </p>
        {domain.topAgentScore > 0 && (
          <span
            className="text-xs font-bold tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded-md"
            style={{ color, background: `${color}18` }}
          >
            {domain.topAgentScore}
          </span>
        )}
      </div>

      {/* Expanded details — only when selected */}
      {selected && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {domain.agentCount} {domain.agentCount === 1 ? 'agent' : 'agents'}
            {domain.totalStakers > 0 && ` · ${domain.totalStakers} stakers`}
          </p>
          {domain.topAgent && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              #1: <span style={{ color }}>{domain.topAgent}</span>
            </p>
          )}
          {domain.topAgentScore > 0 && (
            <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{ width: `${barPct}%`, background: color }}
              />
            </div>
          )}
        </div>
      )}
    </button>
  )
}

function AgentRankRow({ agent, index }: { agent: DomainAgent; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const color = scoreColor(agent.domainScore)
  const rColor = rankColor(agent.rank)
  const barPct = Math.min(agent.domainScore, 100)
  const hasStats = agent.stakerCount > 0 || agent.supportShares > 0n || agent.opposeShares > 0n

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="rounded-xl px-4 py-2.5 transition-colors duration-150 cursor-pointer select-none"
      style={{ background: expanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Always visible row */}
      <div className="flex items-center gap-3">
        {/* rank */}
        <span
          className="text-sm font-bold w-6 text-center flex-shrink-0 tabular-nums"
          style={{ color: rColor }}
        >
          #{agent.rank}
        </span>

        {/* avatar */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: `${color}18`, color }}
        >
          {agent.agentName.slice(0, 2).toUpperCase()}
        </div>

        {/* name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">
            {agent.agentName}
          </span>
        </div>

        {/* score badge */}
        <span
          className="text-sm font-bold flex-shrink-0 tabular-nums px-2 py-0.5 rounded-md"
          style={{ color, background: `${color}18` }}
        >
          {agent.domainScore}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2.5 ml-[52px] space-y-1.5">
          {/* progress bar */}
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${barPct}%`, background: color }}
            />
          </div>

          {/* stats */}
          {hasStats && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {agent.stakerCount > 0 && <span>{agent.stakerCount} stakers</span>}
              {agent.stakerCount > 0 && agent.supportShares > 0n && <span>·</span>}
              {agent.supportShares > 0n && (
                <span>
                  <span style={{ color: '#10b981' }}>{agent.supportRatio}%</span> support
                  {agent.opposeShares > 0n && (
                    <> · <span style={{ color: '#ef4444' }}>{(100 - agent.supportRatio).toFixed(1)}%</span> oppose</>
                  )}
                </span>
              )}
            </div>
          )}

          {/* link */}
          <Link
            href={`/agents?open=${agent.agentId}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: '#8B5CF6' }}
          >
            View agent →
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DomainsPage() {
  return (
    <Suspense fallback={
      <PageBackground>
        <div className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-4">
              <div className="h-10 w-64 bg-white/10 rounded-lg" />
              <div className="h-12 bg-white/5 rounded-xl" />
            </div>
          </div>
        </div>
      </PageBackground>
    }>
      <DomainsPageContent />
    </Suspense>
  )
}

function DomainsPageContent() {
  const [allTriples, setAllTriples] = useState<DomainTripleData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'stake' | 'agents' | 'alpha'>('stake')
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchDomainTriples()
      .then(triples => {
        setAllTriples(triples)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  // Derive domains from all triples
  const allDomains = useMemo(() => aggregateDomains(allTriples), [allTriples])

  // Filter + sort
  const filteredDomains = useMemo(() => {
    let result = allDomains
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(d => d.name.toLowerCase().includes(lower))
    }
    if (sortBy === 'agents') {
      result = [...result].sort((a, b) => b.agentCount - a.agentCount)
    } else if (sortBy === 'alpha') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    }
    // 'stake' is already sorted by aggregateDomains
    return result
  }, [allDomains, searchTerm, sortBy])

  // Ranked agents for selected domain
  const domainAgents = useMemo<DomainAgent[]>(() => {
    if (!selectedDomain) return []
    const domainTriples = allTriples.filter(t => t.skillId === selectedDomain.id)
    return scoreDomainAgents(domainTriples)
  }, [selectedDomain, allTriples])

  // Auto-select first domain when loaded
  useEffect(() => {
    if (!selectedDomain && filteredDomains.length > 0) {
      setSelectedDomain(filteredDomains[0])
    }
  }, [filteredDomains, selectedDomain])

  return (
    <PageBackground>
      <div className="pt-20 pb-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="pt-6 pb-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <Layers className="w-6 h-6" style={{ color: '#8B5CF6' }} />
                <h1 className="text-2xl font-bold text-white">Agent Domains</h1>
              </div>
              <button
                onClick={load}
                disabled={loading}
                title="Refresh domains"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.20)', color: '#8B5CF6' }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Explore AI agent rankings by expertise domain. Each domain is a skill with its own agent leaderboard.
            </p>

            {/* Stats row */}
            {!loading && allDomains.length > 0 && (
              <div className="mt-4 flex items-center gap-6">
                <div>
                  <p className="text-xl font-bold text-white">{allDomains.length}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Active Domains</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {new Set(allTriples.map(t => t.agentId)).size}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Ranked Agents</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {allTriples.reduce((s, t) => s + t.supportPositionCount + t.opposePositionCount, 0)}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Total Stakers</p>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex gap-4 min-h-[600px]">

            {/* ── Left: Domain list ── */}
            <div
              className="w-72 flex-shrink-0 rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Search + sort */}
              <div className="p-3 space-y-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <input
                    type="text"
                    placeholder="Search domains..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-purple-500"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>

                <div className="flex gap-1">
                  {(['stake', 'agents', 'alpha'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className="flex-1 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: sortBy === s ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                        color: sortBy === s ? '#8B5CF6' : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${sortBy === s ? 'rgba(139,92,246,0.3)' : 'transparent'}`,
                      }}
                    >
                      {s === 'stake' ? 'Active' : s === 'agents' ? 'Agents' : 'A-Z'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Domain cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {loading && (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    ))}
                  </div>
                )}

                {!loading && filteredDomains.length === 0 && (
                  <div className="py-12 text-center px-4">
                    <Layers className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {searchTerm ? 'No domains found' : 'No domains yet'}
                    </p>
                    {!searchTerm && (
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Create a claim{' '}
                        <Link href="/claims?create=true" className="underline" style={{ color: '#8B5CF6' }}>
                          [Agent] [hasAgentSkill] [Skill]
                        </Link>
                      </p>
                    )}
                  </div>
                )}

                {!loading && filteredDomains.map(domain => (
                  <DomainCard
                    key={domain.id}
                    domain={domain}
                    selected={selectedDomain?.id === domain.id}
                    onClick={() => setSelectedDomain(domain)}
                  />
                ))}
              </div>
            </div>

            {/* ── Right: Domain detail ── */}
            <div className="flex-1 min-w-0 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {!selectedDomain && !loading && (
                <div className="flex flex-col items-center justify-center h-full py-24">
                  <Trophy className="w-12 h-12 mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <p className="text-base font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Select a domain to see rankings
                  </p>
                </div>
              )}

              {selectedDomain && (
                <div className="p-6">
                  {/* Domain header */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                        <h2 className="text-2xl font-bold text-white">{selectedDomain.name}</h2>
                      </div>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {selectedDomain.agentCount} {selectedDomain.agentCount === 1 ? 'agent' : 'agents'} ranked
                        {selectedDomain.totalStakers > 0 && ` · ${selectedDomain.totalStakers} stakers`}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-4 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

                  {/* Agent ranking */}
                  {domainAgents.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        No agents ranked in this domain yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                        style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Agent Ranking
                      </p>
                      {domainAgents.map((agent, i) => (
                        <AgentRankRow key={agent.agentId} agent={agent} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </PageBackground>
  )
}
