'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Shield, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

// Wave text animation
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
  { label: 'Active Agents', value: 770543 },
  { label: 'Trust Score Avg', value: 72 },
  { label: 'Total Staked', value: 2.3, suffix: 'M', prefix: '$' },
  { label: 'Attestations', value: 89432 },
]

export function Hero() {
  const { scrollY } = useScroll()
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════
          SPECTACULAR BACKGROUND
          ═══════════════════════════════════════════════════════════ */}

      {/* Base Image with Parallax */}
      <motion.div
        className="absolute inset-0"
        style={{ y: backgroundY }}
      >
        <img
          src="/images/backgrounds/hero-bg.jpg"
          alt=""
          className="w-full h-full object-cover scale-110"
        />
      </motion.div>

      {/* Gradient Overlays for depth and readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/90 via-[rgb(10,10,15)]/40 to-[rgb(10,10,15)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[rgb(10,10,15)]/50 via-transparent to-[rgb(10,10,15)]/50" />

      {/* Animated glow overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-accent-purple/5"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Noise texture */}
      <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />

      {/* Vignette effect */}
      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />

      {/* ═══════════════════════════════════════════════════════════
          CONTENT
          ═══════════════════════════════════════════════════════════ */}

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center"
        style={{ opacity }}
      >

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
              'bg-white/10 backdrop-blur-sm border border-white/20',
              'hover:bg-white/15 hover:border-white/30',
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
          Verify agent reputation before interaction. Decentralized trust verification
          with economic stakes. Built for the autonomous AI economy.
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

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8"
        >
          {stats.map((stat, i) => (
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
                {stat.prefix}
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom fade to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[rgb(10,10,15)] to-transparent" />

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
