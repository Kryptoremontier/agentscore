'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, TrendingUp, GitBranch, Users, Zap, Database, Star, Search, BarChart3, Cpu } from 'lucide-react'
import { cn } from '@/lib/cn'

const features = [
  {
    icon: ShieldCheck,
    title: 'Verify Before Trust',
    description: 'Check any AI agent\'s trust score before interacting. Scores are calculated from real on-chain stakes.',
    iconColor: '#2ECC71',
    glowColor: 'rgba(46,204,113,0.25)',
    borderColor: 'rgba(46,204,113,0.2)',
    bgColor: 'rgba(46,204,113,0.08)',
  },
  {
    icon: TrendingUp,
    title: 'Bonding Curve Market',
    description: 'Support or Oppose agents via bonding curves. Buy and sell positions as trust evolves.',
    iconColor: '#38B6FF',
    glowColor: 'rgba(56,182,255,0.25)',
    borderColor: 'rgba(56,182,255,0.2)',
    bgColor: 'rgba(56,182,255,0.08)',
  },
  {
    icon: GitBranch,
    title: 'On-chain Attestations',
    description: 'Every Support, Oppose and Report creates permanent, verifiable attestations on-chain.',
    iconColor: '#C8963C',
    glowColor: 'rgba(200,150,60,0.25)',
    borderColor: 'rgba(200,150,60,0.2)',
    bgColor: 'rgba(200,150,60,0.08)',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description: 'Trust scores from real users with real stakes — no centralized authority.',
    iconColor: '#C9A84C',
    glowColor: 'rgba(201,168,76,0.25)',
    borderColor: 'rgba(201,168,76,0.2)',
    bgColor: 'rgba(201,168,76,0.08)',
  },
  {
    icon: Zap,
    title: 'Intuition Protocol',
    description: 'Built on Intuition\'s L3 with minimal gas fees and near-instant finality.',
    iconColor: '#2EE6D6',
    glowColor: 'rgba(46,230,214,0.25)',
    borderColor: 'rgba(46,230,214,0.2)',
    bgColor: 'rgba(46,230,214,0.08)',
  },
  {
    icon: Database,
    title: 'Fully On-Chain',
    description: 'Agent identities, stakes, and trust scores — all stored permanently on-chain.',
    iconColor: '#FF4D4F',
    glowColor: 'rgba(255,77,79,0.25)',
    borderColor: 'rgba(255,77,79,0.2)',
    bgColor: 'rgba(255,77,79,0.08)',
  },
]

export function Features() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#0F1113]/80 backdrop-blur-[1px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Why <span className="text-[#C8963C]">AgentScore</span>?
          </h2>
          <p className="mt-4 text-lg text-[#B5BDC6] max-w-2xl mx-auto">
            The trust infrastructure the AI economy needs. Verify, stake, earn.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="group relative p-7 rounded-2xl transition-all duration-300 cursor-default"
              style={{
                background: `linear-gradient(135deg, #171A1D 0%, #1E2229 100%)`,
                border: `1px solid ${feature.borderColor}`,
              }}
            >
              {/* Glow corner effect */}
              <div
                className="absolute top-0 left-0 w-32 h-32 rounded-2xl pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at top left, ${feature.glowColor}, transparent 70%)` }}
              />

              {/* Icon */}
              <div
                className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: feature.bgColor,
                  border: `1px solid ${feature.borderColor}`,
                  boxShadow: `0 0 20px ${feature.glowColor}, 0 0 8px ${feature.glowColor}`,
                }}
              >
                <feature.icon
                  className="w-7 h-7"
                  style={{ color: feature.iconColor, filter: `drop-shadow(0 0 6px ${feature.glowColor})` }}
                />
              </div>

              {/* Content */}
              <h3
                className="relative text-xl font-semibold mb-3 transition-colors duration-300"
                style={{ color: 'white' }}
              >
                {feature.title}
              </h3>
              <p className="relative text-[#7A838D] leading-relaxed text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
