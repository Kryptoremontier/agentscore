'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, ChevronLeft, ChevronRight, Users, Bot, Zap, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { calculateTrustScoreFromStakes } from '@/lib/trust-score-engine'

import { APP_CONFIG } from '@/lib/app-config'
import { TRIPLE_SUBJECT_OR_STR, TRIPLE_OBJECT_OR_STR, AGENT_PREFIX, SKILL_PREFIX } from '@/lib/gql-filters'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

interface FeaturedItem {
  term_id: string
  label: string
  created_at: string
  creator?: { label: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
  as_subject_triples?: Array<{ counter_term_id: string }> | null
}

interface FeaturedClaim {
  term_id: string
  created_at: string
  subject: { label: string } | null
  predicate: { label: string } | null
  object: { label: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

type Tab = 'agents' | 'skills' | 'claims'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; accentRgb: string; accentHex: string; prefix: string }[] = [
  { id: 'agents', label: 'Agents', icon: Bot,          accentRgb: '200,150,60',  accentHex: '#C8963C', prefix: AGENT_PREFIX },
  { id: 'skills', label: 'Skills', icon: Zap,          accentRgb: '46,230,214',  accentHex: '#2EE6D6', prefix: SKILL_PREFIX },
  { id: 'claims', label: 'Claims', icon: MessageSquare, accentRgb: '56,182,255', accentHex: '#38B6FF', prefix: '' },
]

const stripPrefix = (label: string, prefix: string) =>
  label.replace(new RegExp(`^${prefix}\\s*`, 'i'), '').split(' - ')[0].trim()

const getDescription = (label: string, prefix: string) => {
  const parts = label.replace(new RegExp(`^${prefix}\\s*`, 'i'), '').split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : null
}

export function FeaturedAgents() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('agents')
  const [items, setItems] = useState<FeaturedItem[]>([])
  const [claims, setClaims] = useState<FeaturedClaim[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = async (tab: Tab) => {
    setLoading(true)
    try {
      if (tab === 'claims') {
        const hasScope = TRIPLE_SUBJECT_OR_STR && TRIPLE_OBJECT_OR_STR
        const whereClause = hasScope
          ? `where: { _and: [ { ${TRIPLE_SUBJECT_OR_STR} }, { ${TRIPLE_OBJECT_OR_STR} } ] }`
          : 'where: {}'
        const res = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `{
            triples(
              ${whereClause}
              limit: 8
              order_by: { created_at: desc }
            ) {
              term_id created_at
              subject { label }
              predicate { label }
              object { label }
              positions_aggregate { aggregate { count sum { shares } } }
            }
          }` }),
        })
        const d = await res.json()
        setClaims(d.data?.triples || [])
        setItems([])
      } else {
        const prefix = TABS.find(t => t.id === tab)!.prefix
        const res = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `{
            atoms(
              where: { label: { _ilike: "${prefix}%" } }
              limit: 8 order_by: { created_at: desc }
            ) {
              term_id label created_at
              creator { label }
              positions_aggregate { aggregate { count sum { shares } } }
              as_subject_triples(
                where: { predicate_id: { _eq: "0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba" } }
                limit: 1
              ) { counter_term_id }
            }
          }` }),
        })
        const d = await res.json()
        const atoms: FeaturedItem[] = d.data?.atoms || []

        // Batch-fetch oppose vault shares for accurate card Trust Score
        const counterTermIds = atoms
          .map(a => a.as_subject_triples?.[0]?.counter_term_id)
          .filter(Boolean) as string[]
        if (counterTermIds.length > 0) {
          try {
            const opposeRes = await fetch(GRAPHQL_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `{ positions(where: { term_id: { _in: ${JSON.stringify(counterTermIds)} } }) { term_id shares } }`
              })
            })
            const opposeData = await opposeRes.json()
            const opposeMap = new Map<string, bigint>()
            for (const pos of opposeData.data?.positions ?? []) {
              const prev = opposeMap.get(pos.term_id) || 0n
              try { opposeMap.set(pos.term_id, prev + BigInt(pos.shares)) } catch { /* skip */ }
            }
            for (const atom of atoms) {
              const ctid = atom.as_subject_triples?.[0]?.counter_term_id
              if (ctid && opposeMap.has(ctid)) {
                ;(atom as any).__opposeWei = opposeMap.get(ctid) || 0n
              }
            }
          } catch { /* non-critical, falls back to opposeWei=0 */ }
        }
        setItems(atoms)
        setClaims([])
      }
    } catch { setItems([]); setClaims([]) }
    setLoading(false)
  }

  useEffect(() => { fetchItems(activeTab) }, [activeTab])

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' })

  const tabCfg = TABS.find(t => t.id === activeTab)!
  const totalCount = activeTab === 'claims' ? claims.length : items.length

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#0C0E10]/90" />
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-xs font-semibold uppercase tracking-widest"
                style={{ background: `rgba(${tabCfg.accentRgb},0.08)`, border: `1px solid rgba(${tabCfg.accentRgb},0.2)`, color: tabCfg.accentHex }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: tabCfg.accentHex }} />
                Live on Intuition Testnet
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
                Explore the{' '}
                <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: `linear-gradient(90deg, ${tabCfg.accentHex}, ${tabCfg.accentHex}aa)` }}>
                  Registry
                </span>
              </h2>
              <p className="mt-2 text-[#7A838D] text-lg">
                Real on-chain data from Intuition Testnet — click any card to explore
              </p>
            </div>

            {/* Scroll arrows */}
            {totalCount > 3 && (
              <div className="hidden md:flex gap-2 shrink-0">
                <button onClick={() => scroll('left')}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `rgba(${tabCfg.accentRgb},0.4)`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <ChevronLeft className="w-4 h-4 text-[#B5BDC6]" />
                </button>
                <button onClick={() => scroll('right')}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `rgba(${tabCfg.accentRgb},0.4)`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <ChevronRight className="w-4 h-4 text-[#B5BDC6]" />
                </button>
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1.5 mt-8 p-1.5 rounded-2xl w-fit"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={active ? {
                    background: `linear-gradient(135deg, rgba(${tab.accentRgb},0.2), rgba(${tab.accentRgb},0.08))`,
                    border: `1px solid rgba(${tab.accentRgb},0.4)`,
                    color: tab.accentHex,
                    boxShadow: `0 0 16px rgba(${tab.accentRgb},0.1)`,
                  } : {
                    border: '1px solid transparent',
                    color: '#7A838D',
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: active ? tab.accentHex : '#7A838D' }} />
                  {tab.label}
                </button>
              )
            })}

            {/* Live count badge */}
            {!loading && (
              <div className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#7A838D]"
                style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                <TrendingUp className="w-3 h-3" style={{ color: tabCfg.accentHex }} />
                <span>{totalCount} indexed</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? (
              <div className="flex gap-5 overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[280px] h-44 rounded-2xl animate-pulse"
                    style={{ background: `rgba(${tabCfg.accentRgb},0.04)`, border: `1px solid rgba(${tabCfg.accentRgb},0.08)` }} />
                ))}
              </div>
            ) : totalCount === 0 ? (
              <div className="text-center py-16 rounded-2xl"
                style={{ background: `rgba(${tabCfg.accentRgb},0.04)`, border: `1px solid rgba(${tabCfg.accentRgb},0.1)` }}>
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: `rgba(${tabCfg.accentRgb},0.12)`, border: `1px solid rgba(${tabCfg.accentRgb},0.25)` }}>
                    <tabCfg.icon className="w-7 h-7" style={{ color: tabCfg.accentHex }} />
                  </div>
                </div>
                <p className="text-[#B5BDC6] font-semibold mb-1">No {tabCfg.label.toLowerCase()} registered yet</p>
                <p className="text-[#7A838D] text-sm">Be the first to add one on AgentScore</p>
              </div>
            ) : (
              <div className="relative">
                <div
                  ref={scrollRef}
                  className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {activeTab === 'claims'
                    ? claims.filter(c => c.subject && c.predicate && c.object).map((claim, i) => {
                        const stakers = claim.positions_aggregate?.aggregate?.count || 0
                        const sharesWei = BigInt(claim.positions_aggregate?.aggregate?.sum?.shares || '0')
                        const totalStaked = Number(sharesWei) / 1e18
                        const subjectLabel = claim.subject?.label ?? '—'
                        const predicateLabel = claim.predicate?.label ?? '—'
                        const objectLabel = claim.object?.label ?? '—'
                        return (
                          <motion.div key={claim.term_id}
                            className="flex-shrink-0 w-[300px]"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                          >
                            <Link href="/claims">
                              <div className="group p-5 rounded-2xl h-full cursor-pointer transition-all duration-300 hover:-translate-y-1"
                                style={{ background: 'linear-gradient(135deg,#171A1D,#1E2229)', border: '1px solid rgba(56,182,255,0.12)' }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(56,182,255,0.35)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(56,182,255,0.12)')}
                              >
                                {/* Triple pills */}
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                    style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.28)', color: '#C8963C' }}>
                                    <Bot className="w-3 h-3" />
                                    {subjectLabel.replace(/^Agent:\s*/i, '').split(' - ')[0].slice(0, 18)}
                                  </span>
                                  <span className="flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                    style={{ background: 'rgba(46,230,214,0.10)', border: '1px solid rgba(46,230,214,0.25)', color: '#2EE6D6' }}>
                                    {predicateLabel.slice(0, 16)}
                                  </span>
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                    style={{ background: 'rgba(56,182,255,0.10)', border: '1px solid rgba(56,182,255,0.25)', color: '#38B6FF' }}>
                                    {objectLabel.replace(/^(Agent|Skill):\s*/i, '').split(' - ')[0].slice(0, 18)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-auto">
                                  <span className="flex items-center gap-1 text-xs text-[#7A838D]">
                                    <Users className="w-3 h-3" /> {stakers} staker{stakers !== 1 ? 's' : ''}
                                  </span>
                                  <span className="text-xs text-[#7A838D]">
                                    {totalStaked > 0 ? `${totalStaked.toFixed(4)} tTRUST` : 'No stakes'}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        )
                      })
                    : items.map((item, i) => {
                        const cfg = TABS.find(t => t.id === activeTab)!
                        const name = stripPrefix(item.label, cfg.prefix)
                        const description = getDescription(item.label, cfg.prefix)
                        const stakers = item.positions_aggregate?.aggregate?.count || 0
                        const sharesWei = BigInt(item.positions_aggregate?.aggregate?.sum?.shares || '0')
                        const totalStaked = Number(sharesWei) / 1e18
                        const opposeWei: bigint = (item as any).__opposeWei ?? 0n
                        const trust = calculateTrustScoreFromStakes(sharesWei, opposeWei)
                        const scoreColor = trust.score >= 70 ? '#2ECC71' : trust.score >= 50 ? '#EAB308' : '#EF4444'
                        const IconComp = cfg.icon
                        return (
                          <motion.div key={item.term_id}
                            className="flex-shrink-0 w-[280px]"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                          >
                            <Link href={`/${activeTab}`}>
                              <div className="group relative p-5 rounded-2xl h-full cursor-pointer transition-all duration-300 hover:-translate-y-1"
                                style={{
                                  background: 'linear-gradient(135deg,#171A1D,#1E2229)',
                                  border: `1px solid rgba(${cfg.accentRgb},0.12)`,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = `rgba(${cfg.accentRgb},0.35)`)}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = `rgba(${cfg.accentRgb},0.12)`)}
                              >
                                {/* Score */}
                                <div className="absolute top-4 right-4 text-right">
                                  <span className="text-2xl font-bold font-mono" style={{ color: scoreColor }}>{trust.score}</span>
                                  <span className="block text-[10px] text-[#4A5260]">Score</span>
                                </div>

                                {/* Icon */}
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                  style={{ background: `rgba(${cfg.accentRgb},0.12)`, border: `1px solid rgba(${cfg.accentRgb},0.28)`, boxShadow: `0 0 14px rgba(${cfg.accentRgb},0.15)` }}>
                                  <IconComp className="w-5 h-5" style={{ color: cfg.accentHex }} />
                                </div>

                                <h4 className="font-semibold text-white group-hover:text-[#C8963C] transition-colors mb-1 pr-14 truncate text-sm">
                                  {name}
                                </h4>
                                {description
                                  ? <p className="text-xs text-[#6B7480] mb-3 line-clamp-2">{description}</p>
                                  : item.creator?.label
                                    ? <p className="text-xs text-[#4A5260] mb-3">by {item.creator.label}</p>
                                    : <div className="mb-3" />
                                }

                                <div className="flex items-center gap-3 text-xs text-[#7A838D] mb-2.5">
                                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {stakers} staker{stakers !== 1 ? 's' : ''}</span>
                                  <span>{totalStaked > 0 ? `${totalStaked.toFixed(4)} tTRUST` : 'No stakes'}</span>
                                </div>

                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${trust.score}%`, backgroundColor: scoreColor }} />
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        )
                      })
                  }
                </div>
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-3 w-10 bg-gradient-to-r from-[#0C0E10] to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-3 w-10 bg-gradient-to-l from-[#0C0E10] to-transparent pointer-events-none" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* "View all" link */}
        {totalCount > 0 && (
          <motion.div
            className="text-center mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link
              href={`/${activeTab}`}
              className="inline-flex items-center gap-2 font-semibold transition-colors text-sm"
              style={{ color: tabCfg.accentHex }}
            >
              View all {totalCount} {tabCfg.label.toLowerCase()} in Explorer
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  )
}
