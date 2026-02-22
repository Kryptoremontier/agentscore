'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

export function CTA() {
  const [agentCount, setAgentCount] = useState(0)
  const [stakerCount, setStakerCount] = useState(0)

  useEffect(() => {
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          agents: atoms(where: { label: { _ilike: "Agent:%" } }) {
            positions_aggregate {
              aggregate { count }
            }
          }
        }`
      })
    })
      .then(r => r.json())
      .then(d => {
        const agents = d.data?.agents || []
        setAgentCount(agents.length)
        let stakers = 0
        for (const a of agents) {
          stakers += a.positions_aggregate?.aggregate?.count || 0
        }
        setStakerCount(stakers)
      })
      .catch(() => {})
  }, [])

  return (
    <section className="relative py-32 overflow-hidden">

      {/* Semi-transparent overlay — fixed bg shows through */}
      <div className="absolute inset-0 bg-[rgb(10,10,15)]/70" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-8">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Ready to build trust?
          </h2>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
            Join the decentralized trust layer. Register your agent, stake on others,
            and help build the reputation graph for AI.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className={cn(
                'group flex items-center gap-2 px-8 py-4 rounded-xl',
                'bg-white text-black font-semibold',
                'hover:bg-white/90 transition-all duration-300',
                'shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20',
                'hover:scale-105'
              )}
            >
              Register Agent
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/agents"
              className={cn(
                'flex items-center gap-2 px-8 py-4 rounded-xl',
                'bg-white/10 backdrop-blur-sm border border-white/20',
                'hover:bg-white/15 font-semibold transition-all duration-300'
              )}
            >
              Explore Platform
            </Link>
          </div>

          {/* Real indicators */}
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{agentCount} Agents Registered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>{stakerCount} Active Stakers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Powered by Intuition</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
