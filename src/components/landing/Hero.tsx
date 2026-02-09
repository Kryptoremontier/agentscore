'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Shield } from 'lucide-react'
import { cn } from '@/lib/cn'

// Wave text animation - każda litera animuje się osobno
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

// Animated counter
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = value / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      setCurrent(Math.min(Math.round(increment * step), value))
      if (step >= steps) clearInterval(timer)
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  return (
    <span className="font-mono tabular-nums">
      {current.toLocaleString()}{suffix}
    </span>
  )
}

const stats = [
  { label: 'Active Agents', value: 770543, suffix: '' },
  { label: 'Avg Trust Score', value: 72.8, suffix: '' },
  { label: 'Total Staked', value: 2.3, suffix: 'M', prefix: '$' },
  { label: 'Attestations', value: 89432, suffix: '' },
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />

      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-purple/20 rounded-full blur-[128px] animate-float-delay-2" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent-cyan/10 rounded-full blur-[100px] animate-float-delay-1" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">

        {/* Announcement Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/docs"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full',
              'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20',
              'text-sm font-medium transition-all duration-300 group'
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Built on Intuition Protocol</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Headline */}
        <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
          <WaveText text="Trust Score for" className="block text-white" />
          <WaveText text="AI Agents" className="block gradient-text-animated mt-2" />
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto"
        >
          Verify agent reputation before interaction. Decentralized trust verification
          built on Intuition Protocol with economic attestations.
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
              'transition-all duration-300 btn-glow glow-blue'
            )}
          >
            Explore Agents
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/register"
            className={cn(
              'flex items-center gap-2 px-8 py-4 rounded-xl',
              'glass glass-hover font-semibold'
            )}
          >
            Register Your Agent
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass-card p-6 text-center"
            >
              <div className="text-2xl sm:text-3xl font-bold text-white">
                {stat.prefix}
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Trust Score Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-20 flex justify-center"
        >
          <div className="relative">
            {/* Glow */}
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />

            {/* Score Ring */}
            <div className="relative glass-card p-8">
              <div className="flex items-center gap-8">
                {/* Large Score */}
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={283}
                      initial={{ strokeDashoffset: 283 }}
                      animate={{ strokeDashoffset: 283 * (1 - 0.87) }}
                      transition={{ duration: 1.5, delay: 1.2, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold font-mono text-emerald-400">87</span>
                  </div>
                </div>

                {/* Info */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Sample Agent</span>
                    <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">Verified</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Trust score based on 1,247 attestations
                  </div>
                  <div className="mt-3 flex gap-4 text-sm">
                    <span className="text-emerald-400">+$45.2K staked</span>
                    <span className="text-slate-400">128 stakers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[rgb(10,10,15)] to-transparent" />
    </section>
  )
}
