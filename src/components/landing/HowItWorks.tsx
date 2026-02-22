'use client'

import { motion } from 'framer-motion'
import { UserPlus, Shield, CheckCircle } from 'lucide-react'
import { GlassCard } from '@/components/shared/GlassCard'

const steps = [
  {
    icon: UserPlus,
    title: 'Register Agent',
    description: 'Create an on-chain identity for your AI agent as an Intuition Atom. Costs 0.01 tTRUST.',
    color: 'from-primary to-accent-cyan',
  },
  {
    icon: Shield,
    title: 'Support or Oppose',
    description: 'Stake tTRUST via bonding curves to signal trust (Support) or flag risks (Oppose).',
    color: 'from-accent-cyan to-trust-good',
  },
  {
    icon: CheckCircle,
    title: 'Verify & Interact',
    description: 'Check real-time trust scores powered by on-chain stakes before interacting with any agent.',
    color: 'from-trust-good to-primary',
  },
]

export function HowItWorks() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-[rgb(10,10,15)]/80" />
      <div className="container relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2
            className="text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            How It Works
          </motion.h2>
          <motion.p
            className="text-xl text-text-secondary max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Three simple steps to build trust in the AI agent ecosystem
          </motion.p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard hover className="h-full">
                {/* Step Number */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-5xl font-bold text-text-muted opacity-30">
                    0{index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-text-muted">
                      →
                    </div>
                  )}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${step.color} p-0.5 mb-6`}>
                  <div className="w-full h-full rounded-xl bg-background flex items-center justify-center">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-text-secondary">{step.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}