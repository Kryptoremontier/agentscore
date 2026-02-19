'use client'

import { motion } from 'framer-motion'
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { AgentCard } from '@/components/agents/AgentCard'
import { Button } from '@/components/ui/button'
import { useRef, useState, useEffect } from 'react'
import type { Agent } from '@/types/agent'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

export function FeaturedAgents() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([])

  useEffect(() => {
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          atoms(limit: 4, order_by: { created_at: desc }) {
            id: term_id
            atomId: term_id
            name: label
            description: label
            category: type
            platform: type
            walletAddress: creator_id
            createdAt: created_at
            trustScore: term_id
            positiveStake: term_id
            negativeStake: term_id
            attestationCount: term_id
            reportCount: term_id
            stakerCount: term_id
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
      const atoms = d.data?.atoms || []
      // Convert GraphQL data to Agent type
      const convertedAgents: Agent[] = atoms.map((atom: any) => ({
        id: atom.id,
        atomId: BigInt(1),
        name: atom.name,
        description: atom.description || 'No description',
        category: atom.category,
        platform: atom.platform as any,
        walletAddress: atom.walletAddress,
        createdAt: new Date(atom.createdAt),
        verificationLevel: 'none' as any,
        trustScore: atom.positions_aggregate?.aggregate?.count || 0,
        positiveStake: BigInt(atom.positions_aggregate?.aggregate?.sum?.shares || 0),
        negativeStake: BigInt(0),
        attestationCount: atom.positions_aggregate?.aggregate?.count || 0,
        reportCount: 0,
        stakerCount: atom.positions_aggregate?.aggregate?.count || 0,
        owner: {
          address: atom.walletAddress || '0x0',
          expertLevel: 'newcomer' as any,
        },
      }))
      setFeaturedAgents(convertedAgents)
    })
    .catch(() => setFeaturedAgents([]))
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <motion.h2
              className="text-4xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Featured Agents
            </motion.h2>
            <motion.p
              className="text-xl text-text-secondary"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              Top trusted agents in the ecosystem
            </motion.p>
          </div>

          {/* Navigation Buttons */}
          <div className="hidden md:flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => scroll('left')}
              className="rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => scroll('right')}
              className="rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Trending Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <TrendingUp className="w-4 h-4 text-trust-good" />
          <span className="text-sm text-text-secondary">
            Trending this week
          </span>
        </motion.div>

        {/* Agent Carousel */}
        <div className="relative">
          {featuredAgents.length === 0 ? (
            <div className="text-center py-20 glass rounded-2xl">
              <p className="text-6xl mb-4">🤖</p>
              <h3 className="text-2xl font-bold mb-3">No agents registered yet</h3>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Be the first to register AI agents on AgentScore testnet!
              </p>
              <Button asChild>
                <a href="/test-intuition">
                  Register Agents →
                </a>
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                suppressHydrationWarning
              >
                {featuredAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    className="flex-shrink-0 w-[350px]"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <AgentCard agent={agent} />
                  </motion.div>
                ))}
              </div>

              {/* Gradient Overlays */}
              <div className="absolute left-0 top-0 bottom-4 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            </>
          )}
        </div>
      </div>
    </section>
  )
}