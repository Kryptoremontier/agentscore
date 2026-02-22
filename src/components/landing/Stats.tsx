'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { Users, Shield, DollarSign, Activity } from 'lucide-react'
import { GlassCard } from '@/components/shared/GlassCard'

const GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

interface AnimatedCounterProps {
  value: number
  suffix?: string
  decimals?: number
}

function AnimatedCounter({ value, suffix = '', decimals = 0 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView && value > 0) {
      const duration = 1500
      const steps = 40
      const stepValue = value / steps
      let current = 0

      const timer = setInterval(() => {
        current += stepValue
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(timer)
        } else {
          setDisplayValue(current)
        }
      }, duration / steps)

      return () => clearInterval(timer)
    }
    return undefined
  }, [isInView, value])

  return (
    <span ref={ref} className="font-mono text-4xl font-bold">
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  )
}

export function Stats() {
  const [stats, setStats] = useState([
    { icon: Users, label: 'Registered Agents', value: 0, suffix: '', color: 'text-accent-cyan', decimals: 0 },
    { icon: Shield, label: 'Attestations', value: 0, suffix: '', color: 'text-trust-good', decimals: 0 },
    { icon: DollarSign, label: 'Total Staked', value: 0, suffix: ' tTRUST', color: 'text-primary', decimals: 4 },
    { icon: Activity, label: 'Active Stakers', value: 0, suffix: '', color: 'text-accent-purple', decimals: 0 },
  ])

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

        setStats(prev => [
          { ...prev[0], value: agents.length },
          { ...prev[1], value: stakers + tripleCount },
          { ...prev[2], value: Number(totalWei) / 1e18 },
          { ...prev[3], value: stakers },
        ])
      } catch {}
    })()
  }, [])

  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-[rgb(10,10,15)]/75" />

      <div className="container relative z-10">
        <div className="text-center mb-16">
          <motion.h2
            className="text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Testnet Statistics
          </motion.h2>
          <motion.p
            className="text-xl text-text-secondary max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Real-time data from Intuition Testnet
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard className="text-center group" hover>
                <div className="mb-4 flex justify-center">
                  <div className={`p-3 rounded-xl bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="mb-2">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
                </div>
                <p className="text-text-secondary text-sm">{stat.label}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex items-center justify-center gap-2 mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-trust-good opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-trust-good" />
          </span>
          <span className="text-sm text-text-muted">Live testnet data</span>
        </motion.div>
      </div>
    </section>
  )
}
