'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, TrendingUp, GitBranch, Users, Zap, Database } from 'lucide-react'

const features = [
  {
    num: '01',
    icon: ShieldCheck,
    title: 'Verify Before Trust',
    description: 'Check any AI agent\'s trust score before interacting. Scores are calculated from real on-chain stakes.',
    tag: 'Security',
    iconColor: '#2ECC71',
    glowRgb: '46,204,113',
    accentColor: '#2ECC71',
  },
  {
    num: '02',
    icon: TrendingUp,
    title: 'Bonding Curve Market',
    description: 'Support or Oppose agents via bonding curves. Buy and sell positions as market sentiment evolves.',
    tag: 'DeFi',
    iconColor: '#38B6FF',
    glowRgb: '56,182,255',
    accentColor: '#38B6FF',
  },
  {
    num: '03',
    icon: GitBranch,
    title: 'On-chain Attestations',
    description: 'Every Support, Oppose and Report creates permanent, verifiable attestations on-chain.',
    tag: 'Provenance',
    iconColor: '#C8963C',
    glowRgb: '200,150,60',
    accentColor: '#C8963C',
  },
  {
    num: '04',
    icon: Users,
    title: 'Community Driven',
    description: 'Trust scores emerge from real users with real stakes — no centralized authority or manipulation.',
    tag: 'Governance',
    iconColor: '#C9A84C',
    glowRgb: '201,168,76',
    accentColor: '#C9A84C',
  },
  {
    num: '05',
    icon: Zap,
    title: 'Intuition Protocol',
    description: 'Built on Intuition\'s L3 with minimal gas fees and near-instant transaction finality.',
    tag: 'Infrastructure',
    iconColor: '#2EE6D6',
    glowRgb: '46,230,214',
    accentColor: '#2EE6D6',
  },
  {
    num: '06',
    icon: Database,
    title: 'Fully On-Chain',
    description: 'Agent identities, stakes, and trust scores — all stored permanently on-chain. Censorship resistant.',
    tag: 'Immutable',
    iconColor: '#FF6B6B',
    glowRgb: '255,107,107',
    accentColor: '#FF6B6B',
  },
]

export function Features() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0D0F11]" />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, rgba(200,150,60,1), transparent 70%)' }} />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, rgba(46,230,214,1), transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.25)', color: '#C8963C' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8963C] animate-pulse" />
            Platform Features
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-none">
            Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8963C] via-[#E8B84B] to-[#C9A84C]">AgentScore</span>?
          </h2>
          <p className="mt-5 text-lg text-[#7A838D] max-w-xl mx-auto leading-relaxed">
            The trust infrastructure the AI economy needs.
            <span className="text-[#B5BDC6]"> Verify, stake, earn.</span>
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, ease: 'easeOut' }}
              whileHover={{ y: -6, scale: 1.015 }}
              className="group relative rounded-2xl overflow-hidden cursor-default transition-all duration-300"
              style={{
                background: 'linear-gradient(145deg, #16191E 0%, #1B1F26 100%)',
                border: `1px solid rgba(${f.glowRgb},0.15)`,
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${f.glowRgb},0.9) 50%, transparent)` }}
              />

              {/* Corner glow */}
              <div
                className="absolute -top-8 -left-8 w-40 h-40 rounded-full pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle, rgba(${f.glowRgb},0.6), transparent 70%)` }}
              />

              <div className="relative p-7">
                {/* Number watermark */}
                <div
                  className="absolute top-4 right-5 text-7xl font-black leading-none select-none pointer-events-none transition-opacity duration-300 opacity-[0.04] group-hover:opacity-[0.07]"
                  style={{ color: f.accentColor, fontVariantNumeric: 'tabular-nums' }}
                >
                  {f.num}
                </div>

                {/* Icon */}
                <div
                  className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: `rgba(${f.glowRgb},0.1)`,
                    border: `1px solid rgba(${f.glowRgb},0.3)`,
                    boxShadow: `0 0 24px rgba(${f.glowRgb},0.2), 0 0 8px rgba(${f.glowRgb},0.15)`,
                  }}
                >
                  <f.icon
                    className="w-6 h-6"
                    style={{ color: f.iconColor, filter: `drop-shadow(0 0 8px rgba(${f.glowRgb},0.7))` }}
                  />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white mb-2.5 leading-snug">{f.title}</h3>

                {/* Description */}
                <p className="text-[#6B7480] leading-relaxed text-sm mb-5">{f.description}</p>

                {/* Bottom tag */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-px flex-1 opacity-30"
                    style={{ background: `rgba(${f.glowRgb},0.6)` }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      color: f.accentColor,
                      background: `rgba(${f.glowRgb},0.1)`,
                      border: `1px solid rgba(${f.glowRgb},0.2)`,
                    }}
                  >
                    {f.tag}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
