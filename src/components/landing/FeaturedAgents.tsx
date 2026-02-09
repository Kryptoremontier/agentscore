'use client'

import { motion } from 'framer-motion'
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { AgentCard } from '@/components/agents/AgentCard'
import { Button } from '@/components/ui/button'
import { useRef } from 'react'
import type { Agent } from '@/types/agent'

// Mock data - replace with real data fetching
const mockAgents: Agent[] = [
  {
    id: '1',
    atomId: BigInt(1),
    name: 'CodeHelper AI',
    description: 'Helps developers write better code',
    category: 'coding',
    platform: 'moltbook',
    walletAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date(),
    verificationLevel: 'wallet',
    trustScore: 95,
    positiveStake: BigInt(150000),
    negativeStake: BigInt(5000),
    attestationCount: 234,
    reportCount: 2,
    stakerCount: 89,
    owner: {
      address: '0x1111111111111111111111111111111111111111',
      name: 'Alice Dev',
      expertLevel: 'expert',
    },
  },
  {
    id: '2',
    atomId: BigInt(2),
    name: 'ResearchBot',
    description: 'Academic research assistant',
    category: 'research',
    platform: 'openclaw',
    walletAddress: '0x2345678901234567890123456789012345678901',
    createdAt: new Date(),
    verificationLevel: 'social',
    trustScore: 88,
    positiveStake: BigInt(120000),
    negativeStake: BigInt(15000),
    attestationCount: 167,
    reportCount: 5,
    stakerCount: 56,
    owner: {
      address: '0x2222222222222222222222222222222222222222',
      name: 'Bob Research',
      expertLevel: 'master',
    },
  },
  {
    id: '3',
    atomId: BigInt(3),
    name: 'TradingSignals',
    description: 'Market analysis and signals',
    category: 'trading',
    platform: 'farcaster',
    walletAddress: null,
    createdAt: new Date(),
    verificationLevel: 'none',
    trustScore: 42,
    positiveStake: BigInt(45000),
    negativeStake: BigInt(60000),
    attestationCount: 89,
    reportCount: 23,
    stakerCount: 34,
    owner: {
      address: '0x3333333333333333333333333333333333333333',
      expertLevel: 'newcomer',
    },
  },
  {
    id: '4',
    atomId: BigInt(4),
    name: 'ArtGenerator Pro',
    description: 'Creates unique AI artwork',
    category: 'nft',
    platform: 'twitter',
    walletAddress: '0x3456789012345678901234567890123456789012',
    createdAt: new Date(),
    verificationLevel: 'kyc',
    trustScore: 92,
    positiveStake: BigInt(200000),
    negativeStake: BigInt(18000),
    attestationCount: 312,
    reportCount: 8,
    stakerCount: 120,
    owner: {
      address: '0x4444444444444444444444444444444444444444',
      name: 'Charlie Artist',
      expertLevel: 'legend',
    },
  },
]

export function FeaturedAgents() {
  const scrollRef = useRef<HTMLDivElement>(null)

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
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            suppressHydrationWarning
          >
            {mockAgents.map((agent, index) => (
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
        </div>
      </div>
    </section>
  )
}