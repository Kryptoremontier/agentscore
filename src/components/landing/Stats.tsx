'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { Users, Shield, DollarSign, Activity } from 'lucide-react'
import { GlassCard } from '@/components/shared/GlassCard'

const stats = [
  {
    icon: Users,
    label: 'Active Agents',
    value: 770543,
    suffix: '',
    color: 'text-accent-cyan',
  },
  {
    icon: Shield,
    label: 'Trust Attestations',
    value: 1245678,
    suffix: '',
    color: 'text-trust-good',
  },
  {
    icon: DollarSign,
    label: 'Total Staked',
    value: 2.3,
    suffix: 'M',
    decimals: 1,
    color: 'text-primary',
  },
  {
    icon: Activity,
    label: 'Daily Interactions',
    value: 89234,
    suffix: '',
    color: 'text-accent-purple',
  },
]

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
    if (isInView) {
      const duration = 2000 // 2 seconds
      const steps = 60
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
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  )
}

export function Stats() {
  return (
    <section className="py-24 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 mesh-gradient opacity-10" />

      <div className="container relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2
            className="text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Platform Statistics
          </motion.h2>
          <motion.p
            className="text-xl text-text-secondary max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Real-time metrics from the AgentScore ecosystem
          </motion.p>
        </div>

        {/* Stats Grid */}
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
                {/* Icon */}
                <div className="mb-4 flex justify-center">
                  <div className={`p-3 rounded-xl bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>

                {/* Value */}
                <div className="mb-2">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                  />
                </div>

                {/* Label */}
                <p className="text-text-secondary text-sm">{stat.label}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Live indicator */}
        <motion.div
          className="flex items-center justify-center gap-2 mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-trust-good opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-trust-good"></span>
          </span>
          <span className="text-sm text-text-muted">Live data</span>
        </motion.div>
      </div>
    </section>
  )
}