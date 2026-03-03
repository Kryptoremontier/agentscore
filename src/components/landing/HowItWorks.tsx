'use client'

import { motion } from 'framer-motion'
import { Layers, TrendingUp, ScanLine } from 'lucide-react'

const steps = [
  {
    num: '01',
    icon: Layers,
    title: 'Register on Chain',
    description: 'Create permanent on-chain identities for AI Agents and Skills as Intuition Atoms. Define relationships between them as verifiable Claims (triples).',
    accentRgb: '200,150,60',
    accentHex: '#C8963C',
    brightHex: '#E8B84B',
    label: 'Registry',
    bullets: ['Agents', 'Skills', 'Claims'],
  },
  {
    num: '02',
    icon: TrendingUp,
    title: 'Stake & Signal',
    description: 'Back your conviction with tTRUST. Support entities you trust or Oppose those you deem risky — bonding curves make every position transparent and tradeable.',
    accentRgb: '46,204,113',
    accentHex: '#2ECC71',
    brightHex: '#4AE685',
    label: 'Staking',
    bullets: ['Support', 'Oppose', 'Trade'],
  },
  {
    num: '03',
    icon: ScanLine,
    title: 'Verify & Decide',
    description: 'Query live trust scores derived entirely from on-chain stakes. Make informed decisions before deploying or integrating any AI agent or skill.',
    accentRgb: '56,182,255',
    accentHex: '#38B6FF',
    brightHex: '#5AC8FF',
    label: 'Verification',
    bullets: ['Trust Score', 'History', 'Attestations'],
  },
]

export function HowItWorks() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0D0F11 0%, #0F1113 40%, #0D0F11 100%)',
        }}
      />
      {/* Subtle horizontal grid lines */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(0deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '100% 80px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.2)', color: '#2ECC71' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] animate-pulse" />
            Getting Started
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-none">
            How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8963C] via-[#E8B84B] to-[#2ECC71]">Works</span>
          </h2>
          <p className="mt-5 text-lg text-[#7A838D] max-w-xl mx-auto">
            Three steps to build trust in the AI agent ecosystem
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative grid md:grid-cols-3 gap-6">

          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-[72px] left-[calc(16.67%+32px)] right-[calc(16.67%+32px)] h-px z-0"
            style={{ background: 'linear-gradient(90deg, rgba(200,150,60,0.4), rgba(46,204,113,0.4) 50%, rgba(56,182,255,0.4))' }}>
            {/* Arrow markers */}
            <div className="absolute left-[calc(33%-6px)] top-1/2 -translate-y-1/2 text-[#B5BDC6] text-xs opacity-50">›</div>
            <div className="absolute left-[calc(66%-6px)] top-1/2 -translate-y-1/2 text-[#B5BDC6] text-xs opacity-50">›</div>
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, ease: 'easeOut' }}
              whileHover={{ y: -6 }}
              className="group relative rounded-3xl overflow-hidden transition-all duration-300"
              style={{
                background: 'linear-gradient(145deg, #141720 0%, #1A1E27 100%)',
                border: `1px solid rgba(${step.accentRgb},0.2)`,
                boxShadow: `0 4px 40px rgba(${step.accentRgb},0.05)`,
              }}
            >
              {/* Top gradient bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, ${step.accentHex}, ${step.brightHex})` }}
              />

              {/* Ambient glow */}
              <div
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: `radial-gradient(circle, rgba(${step.accentRgb},0.12), transparent 70%)` }}
              />

              <div className="relative p-8">
                {/* Step number */}
                <div className="flex items-center justify-between mb-8">
                  <span
                    className="text-6xl font-black leading-none select-none"
                    style={{
                      background: `linear-gradient(135deg, rgba(${step.accentRgb},0.25), rgba(${step.accentRgb},0.05))`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {step.num}
                  </span>
                  {/* Label tag */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{
                      color: step.accentHex,
                      background: `rgba(${step.accentRgb},0.1)`,
                      border: `1px solid rgba(${step.accentRgb},0.25)`,
                    }}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-7 transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, rgba(${step.accentRgb},0.15), rgba(${step.accentRgb},0.05))`,
                    border: `1px solid rgba(${step.accentRgb},0.35)`,
                    boxShadow: `0 0 28px rgba(${step.accentRgb},0.2), inset 0 1px 0 rgba(255,255,255,0.05)`,
                  }}
                >
                  <step.icon
                    className="w-8 h-8"
                    style={{
                      color: step.accentHex,
                      filter: `drop-shadow(0 0 10px rgba(${step.accentRgb},0.8))`,
                    }}
                  />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>

                {/* Description */}
                <p className="text-[#6B7480] leading-relaxed text-sm mb-5">{step.description}</p>

                {/* Bullet tags */}
                <div className="flex flex-wrap gap-1.5">
                  {step.bullets.map(b => (
                    <span
                      key={b}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{
                        color: step.accentHex,
                        background: `rgba(${step.accentRgb},0.08)`,
                        border: `1px solid rgba(${step.accentRgb},0.2)`,
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>

                {/* Bottom accent line */}
                <div
                  className="mt-7 h-px opacity-20 group-hover:opacity-40 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, rgba(${step.accentRgb},1), transparent)` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
