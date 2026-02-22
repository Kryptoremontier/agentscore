'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

interface PlatformStats {
  agents: number
  attestations: number
  stakers: number
  totalStaked: number
}

function WaveText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: i * 0.03,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  )
}

function AnimatedNumber({ value, suffix = '', prefix = '', decimals = 0 }: {
  value: number; suffix?: string; prefix?: string; decimals?: number
}) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (value === 0) return
    const duration = 1500
    const steps = 40
    const increment = value / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      const next = increment * step
      setCurrent(next >= value ? value : next)
      if (step >= steps) clearInterval(timer)
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  return (
    <span className="font-mono tabular-nums">
      {prefix}{decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString()}{suffix}
    </span>
  )
}

export function Hero() {
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3])
  const [stats, setStats] = useState<PlatformStats>({ agents: 0, attestations: 0, stakers: 0, totalStaked: 0 })

  useEffect(() => {
    (async () => {
      try {
        const agentsRes = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{
              agents: atoms(where: { label: { _ilike: "Agent:%" } }) {
                term_id
                positions_aggregate {
                  aggregate { count sum { shares } }
                }
              }
            }`
          })
        })
        const agentsData = await agentsRes.json()
        const agents = agentsData.data?.agents || []
        let stakers = 0
        let totalWei = 0n
        const termIds: string[] = []
        for (const a of agents) {
          stakers += a.positions_aggregate?.aggregate?.count || 0
          totalWei += BigInt(a.positions_aggregate?.aggregate?.sum?.shares || '0')
          termIds.push(a.term_id)
        }

        let tripleCount = 0
        if (termIds.length > 0) {
          const triplesRes = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `query($ids: [String!]!) {
                triples_aggregate(where: { subject_id: { _in: $ids } }) {
                  aggregate { count }
                }
              }`,
              variables: { ids: termIds }
            })
          })
          const triplesData = await triplesRes.json()
          tripleCount = triplesData.data?.triples_aggregate?.aggregate?.count || 0
        }

        setStats({
          agents: agents.length,
          attestations: stakers + tripleCount,
          stakers,
          totalStaked: Number(totalWei) / 1e18,
        })
      } catch {}
    })()
  }, [])

  const statItems = [
    { label: 'Registered Agents', value: stats.agents, decimals: 0 },
    { label: 'Attestations', value: stats.attestations, decimals: 0 },
    { label: 'Total Staked', value: stats.totalStaked, decimals: 4, suffix: ' tTRUST' },
    { label: 'Active Stakers', value: stats.stakers, decimals: 0 },
  ]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Gradient overlays on top of the fixed page background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/70 via-transparent to-[rgb(10,10,15)]/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-[rgb(10,10,15)]/40 via-transparent to-[rgb(10,10,15)]/40" />

      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-accent-purple/5"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.7)]" />

      {/* ═══════════════════════════════════════════════════════════
          CONTENT
          ═══════════════════════════════════════════════════════════ */}
      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center"
        style={{ opacity }}
      >
        {/* Network Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/agents"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full',
              'bg-white/10 backdrop-blur-sm border border-white/20',
              'hover:bg-white/15 hover:border-white/30',
              'text-sm font-medium transition-all duration-300 group'
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live on Intuition Testnet</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Headline */}
        <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
          <WaveText text="Trust Layer for" className="block text-white drop-shadow-2xl" />
          <span className="block mt-2">
            <WaveText
              text="AI Agents"
              className="bg-gradient-to-r from-white via-primary to-accent-cyan bg-clip-text text-transparent drop-shadow-2xl"
            />
          </span>
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto drop-shadow-lg"
        >
          Decentralized trust verification with economic stakes — every vote is on-chain,
          every score is real. Built on Intuition Protocol.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/agents"
            className={cn(
              'group flex items-center gap-2 px-8 py-4 rounded-xl',
              'bg-primary hover:bg-primary/90 text-white font-semibold',
              'transition-all duration-300',
              'shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30',
              'hover:scale-105'
            )}
          >
            Explore Agents
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/register"
            className={cn(
              'flex items-center gap-2 px-8 py-4 rounded-xl',
              'bg-white/10 backdrop-blur-sm border border-white/20',
              'hover:bg-white/15 hover:border-white/30',
              'font-semibold transition-all duration-300',
              'hover:scale-105'
            )}
          >
            Register Your Agent
          </Link>
        </motion.div>

        {/* Real Stats from Testnet */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8"
        >
          {statItems.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 + i * 0.1 }}
              className={cn(
                'p-6 rounded-2xl text-center',
                'bg-white/5 backdrop-blur-md border border-white/10',
                'hover:bg-white/10 hover:border-white/20 transition-all duration-300'
              )}
            >
              <div className="text-2xl sm:text-3xl font-bold text-white">
                <AnimatedNumber
                  value={stat.value}
                  suffix={stat.suffix}
                  decimals={stat.decimals}
                />
              </div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom fade — subtle transition to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[rgb(10,10,15)]/70 to-transparent" />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
          <div className="w-1.5 h-3 bg-white/40 rounded-full" />
        </div>
      </motion.div>
    </section>
  )
}
