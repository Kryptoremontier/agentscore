'use client'

import { motion } from 'framer-motion'
import { TrendingUp, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { calculateTrustScoreFromStakes } from '@/lib/trust-score-engine'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

interface FeaturedAgent {
  term_id: string
  label: string
  created_at: string
  creator?: { label: string } | null
  positions_aggregate?: {
    aggregate: {
      count: number
      sum: { shares: string } | null
    }
  }
}

export function FeaturedAgents() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [agents, setAgents] = useState<FeaturedAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          atoms(
            where: { label: { _ilike: "Agent:%" } }
            limit: 8
            order_by: { created_at: desc }
          ) {
            term_id
            label
            created_at
            creator { label }
            positions_aggregate {
              aggregate {
                count
                sum { shares }
              }
            }
          }
        }`
      })
    })
      .then(r => r.json())
      .then(d => {
        setAgents(d.data?.atoms || [])
        setLoading(false)
      })
      .catch(() => { setAgents([]); setLoading(false) })
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -350 : 350,
        behavior: 'smooth',
      })
    }
  }

  const getAgentName = (label: string) => {
    return label.replace(/^Agent:\s*/i, '').split(' - ')[0].trim()
  }

  const getAgentDescription = (label: string) => {
    const parts = label.replace(/^Agent:\s*/i, '').split(' - ')
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : null
  }

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[rgb(10,10,15)]/80" />
      <div className="container relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <motion.h2
              className="text-4xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Registered Agents
            </motion.h2>
            <motion.p
              className="text-xl text-text-secondary"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              Real agents on Intuition Testnet — click to explore
            </motion.p>
          </div>

          {agents.length > 3 && (
            <div className="hidden md:flex gap-2">
              <Button size="icon" variant="outline" onClick={() => scroll('left')} className="rounded-full">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => scroll('right')} className="rounded-full">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Live badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <TrendingUp className="w-4 h-4 text-trust-good" />
          <span className="text-sm text-text-secondary">
            {agents.length} agents indexed from testnet
          </span>
        </motion.div>

        {/* Content */}
        <div className="relative">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-white/10 mb-4" />
                  <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-20 glass rounded-2xl">
              <p className="text-6xl mb-4">🤖</p>
              <h3 className="text-2xl font-bold mb-3">No agents registered yet</h3>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Be the first to register AI agents on AgentScore testnet!
              </p>
              <Button asChild>
                <Link href="/register">Register Agent →</Link>
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {agents.map((agent, index) => {
                  const name = getAgentName(agent.label)
                  const description = getAgentDescription(agent.label)
                  const stakers = agent.positions_aggregate?.aggregate?.count || 0
                  const totalSharesWei = BigInt(agent.positions_aggregate?.aggregate?.sum?.shares || '0')
                  const totalStaked = Number(totalSharesWei) / 1e18
                  const trust = calculateTrustScoreFromStakes(totalSharesWei, 0n)
                  const scoreColor = trust.score >= 70
                    ? 'text-emerald-400'
                    : trust.score >= 50 ? 'text-amber-400' : 'text-red-400'
                  const barColor = trust.score >= 70
                    ? 'bg-emerald-500'
                    : trust.score >= 50 ? 'bg-amber-500' : 'bg-red-500'

                  return (
                    <motion.div
                      key={agent.term_id}
                      className="flex-shrink-0 w-[300px]"
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.08 }}
                    >
                      <Link href="/agents">
                        <div className={cn(
                          'group relative p-6 rounded-2xl h-full cursor-pointer',
                          'bg-white/5 backdrop-blur-sm border border-white/10',
                          'hover:bg-white/10 hover:border-white/20',
                          'transition-all duration-300 hover:-translate-y-1'
                        )}>
                          {/* Score badge */}
                          <div className="absolute top-4 right-4">
                            <span className={cn('text-2xl font-bold font-mono', scoreColor)}>
                              {trust.score}
                            </span>
                            <span className="block text-[10px] text-slate-500 text-right">Score</span>
                          </div>

                          {/* Agent identity */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent-cyan/30 flex items-center justify-center mb-4 text-lg">
                            🤖
                          </div>
                          <h4 className="font-semibold text-white group-hover:text-primary transition-colors mb-1 pr-16 truncate">
                            {name}
                          </h4>
                          {description && (
                            <p className="text-sm text-slate-400 mb-4 line-clamp-2">{description}</p>
                          )}
                          {!description && agent.creator?.label && (
                            <p className="text-xs text-slate-500 mb-4">by {agent.creator.label}</p>
                          )}

                          {/* Metrics row */}
                          <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {stakers} staker{stakers !== 1 ? 's' : ''}
                            </span>
                            <span>
                              {totalStaked > 0 ? `${totalStaked.toFixed(4)} tTRUST` : 'No stakes'}
                            </span>
                          </div>

                          {/* Score bar */}
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', barColor)}
                              style={{ width: `${trust.score}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>

              <div className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-background to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            </>
          )}
        </div>

        {/* Explore all link */}
        {agents.length > 0 && (
          <motion.div
            className="text-center mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
            >
              View all {agents.length} agents in Explorer
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  )
}
