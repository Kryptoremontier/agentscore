'use client'

import { motion } from 'framer-motion'
import { Search, Users, BadgeCheck } from 'lucide-react'
import { HOW_IT_WORKS, LANDING_TIERS_LINE, type ExplainerTerm } from '@/lib/people-copy'
import { Explainer } from '@/components/shared/Explainer'
import { AccentWord } from '@/components/shared/AccentWord'

// Etap 5b Run 2: how it works is about people trusting agents — the landing's three steps (copy: HOW_IT_WORKS).
const steps = [
  {
    ...HOW_IT_WORKS.steps[0],
    num: '01',
    icon: Search,
    accentRgb: '200,150,60',
    accentHex: '#C8963C',
    brightHex: '#E8B84B',
    explain: undefined,
  },
  {
    ...HOW_IT_WORKS.steps[1],
    num: '02',
    icon: Users,
    accentRgb: '46,204,113',
    accentHex: '#2ECC71',
    brightHex: '#4AE685',
    // Etap 6: "tTRUST" first appears on the landing here — its "?" sits right after the word.
    explain: { after: 'tTRUST', term: 'ttrust' as ExplainerTerm },
  },
  {
    ...HOW_IT_WORKS.steps[2],
    num: '03',
    icon: BadgeCheck,
    accentRgb: '56,182,255',
    accentHex: '#38B6FF',
    brightHex: '#5AC8FF',
    explain: undefined,
  },
]

/** The description with a "?" right after the first use of `word`. */
function withExplainer(text: string, word: string, term: ExplainerTerm) {
  const at = text.indexOf(word)
  if (at < 0) return text
  const end = at + word.length
  return <>{text.slice(0, end)} <Explainer term={term} className="-mt-0.5" />{text.slice(end)}</>
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative pt-12 pb-24 sm:pt-16 sm:pb-32 overflow-hidden scroll-mt-20">
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
          <p className="eyebrow eyebrow-slash text-accent mb-6">Getting Started</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-display leading-display">
            {/* The landing's one section accent word (Etap 6b) */}
            How It <AccentWord>Works</AccentWord>
          </h2>
          <p className="mt-5 text-lg text-[#7A838D] max-w-xl mx-auto">
            {HOW_IT_WORKS.sub}
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
                <p className="text-[#6B7480] leading-relaxed text-sm mb-5">
                  {step.explain ? withExplainer(step.description, step.explain.after, step.explain.term) : step.description}
                </p>

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

        {/* The tier rule, in one line (Etap 6) */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 text-center text-sm sm:text-base text-[#B5BDC6] max-w-2xl mx-auto"
          data-testid="tiers-line"
        >
          {LANDING_TIERS_LINE}
        </motion.p>
      </div>
    </section>
  )
}
