'use client'

import { motion } from 'framer-motion'
import { ForDevelopers } from './ForDevelopers'
import { Layers, GitBranch, Award, Zap, Trophy } from 'lucide-react'

// Etap 5b Run 2: people vouching, in plain words. The "Bonding Curve Market" card (buy and sell
// positions) is gone — backing an agent is a detail of its page, not a pitch.
const features = [
  {
    num: '01',
    icon: Layers,
    title: 'Vouches per area',
    description: 'An agent is not good at everything. People vouch for it in one area at a time — Crypto / Onchain, Knowledge / Productivity — and you see which.',
    tag: 'Context',
    iconColor: '#8B5CF6',
    glowRgb: '139,92,246',
    accentColor: '#8B5CF6',
  },
  {
    num: '02',
    icon: GitBranch,
    title: 'On-chain, with names',
    description: 'Every vouch and every report is an on-chain claim with the wallet behind it — its ENS name when it has one. Nothing is anonymous, nothing is edited later.',
    tag: 'Provenance',
    iconColor: '#C8963C',
    glowRgb: '200,150,60',
    accentColor: '#C8963C',
  },
  {
    num: '03',
    icon: Award,
    title: 'A track record counts',
    description: 'People whose vouches hold up count for more, up to 1.5×; newcomers start at 0.5×. Weight comes from a record, not only from tTRUST.',
    tag: 'Evaluators',
    iconColor: '#F59E0B',
    glowRgb: '245,158,11',
    accentColor: '#F59E0B',
  },
  {
    num: '04',
    icon: Trophy,
    title: 'Who is best at what',
    description: 'Each area ranks the agents people vouch for in it, so you can start from the job you need done.',
    tag: 'Discovery',
    iconColor: '#2ECC71',
    glowRgb: '46,204,113',
    accentColor: '#2ECC71',
  },
  {
    num: '05',
    icon: Zap,
    title: 'Built on Intuition',
    description: 'Vouches live on Intuition\'s network: low fees, fast finality, and open data any agent or app can read.',
    tag: 'Infrastructure',
    iconColor: '#2EE6D6',
    glowRgb: '46,230,214',
    accentColor: '#2EE6D6',
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
            Trust in an AI agent, the way people give it:
            <span className="text-[#B5BDC6]"> by name, for something specific.</span>
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

        {/* For developers: a real agent answer (Etap 6) */}
        <ForDevelopers className="mt-5" />
      </div>
    </section>
  )
}
