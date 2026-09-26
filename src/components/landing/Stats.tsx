'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { Users, Shield, DollarSign, Activity } from 'lucide-react'
import { GlassCard } from '@/components/shared/GlassCard'

import { fetchLandingStats, landingStatItems, type LandingStatsState, type LandingStatItem } from '@/lib/landing-stats'

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

const TILE_STYLE: Record<LandingStatItem['key'], { icon: typeof Users; iconColor: string; glowColor: string }> = {
  agents: { icon: Users, iconColor: '#38B6FF', glowColor: 'rgba(56,182,255,0.25)' },
  attesters: { icon: Shield, iconColor: '#2ECC71', glowColor: 'rgba(46,204,113,0.25)' },
  totalStaked: { icon: DollarSign, iconColor: '#C8963C', glowColor: 'rgba(200,150,60,0.25)' },
  activeStakers: { icon: Activity, iconColor: '#2EE6D6', glowColor: 'rgba(46,230,214,0.25)' },
}

export function Stats() {
  // Same source as the Hero (lib/landing-stats.ts → /api/v1/stats). Unknown prints "—", never 0.
  const [statsState, setStatsState] = useState<LandingStatsState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchLandingStats().then(stats => {
      if (!cancelled) setStatsState(stats ? { status: 'ok', stats } : { status: 'error' })
    })
    return () => { cancelled = true }
  }, [])

  const stats = landingStatItems(statsState).map(item => ({ ...item, ...TILE_STYLE[item.key] }))

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
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard className="text-center group" hover>
                <div className="mb-4 flex justify-center">
                  <div
                    className="p-3 rounded-xl group-hover:scale-110 transition-transform duration-300"
                    style={{
                      background: `${stat.glowColor.replace('0.25', '0.10')}`,
                      border: `1px solid ${stat.glowColor.replace('0.25', '0.25')}`,
                      boxShadow: `0 0 16px ${stat.glowColor}`,
                    }}
                  >
                    <stat.icon className="w-6 h-6" style={{ color: stat.iconColor, filter: `drop-shadow(0 0 4px ${stat.glowColor})` }} />
                  </div>
                </div>
                <div className="mb-2">
                  {stat.value != null ? (
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
                  ) : (
                    <span className="font-mono text-4xl font-bold text-text-muted" title={statsState.status === 'error' ? 'Couldn’t read platform stats' : undefined}>—</span>
                  )}
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
