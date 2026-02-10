'use client'

import { motion } from 'framer-motion'
import { Shield, TrendingUp, Award, Users, Zap, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

const features = [
  {
    icon: Shield,
    title: 'Verify Before Trust',
    description: 'Check any AI agent\'s reputation score before interacting. Real data, real stakes.',
    color: 'from-emerald-500 to-cyan-500',
  },
  {
    icon: TrendingUp,
    title: 'Bonding Curves',
    description: 'Early supporters earn more. Your conviction in good agents pays off.',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    icon: Award,
    title: 'Expert Badges',
    description: 'Build reputation through quality attestations. Experts carry more weight.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description: 'Trust scores from real users, not centralized authorities.',
    color: 'from-orange-500 to-amber-500',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Built on Base L3. 10,000x cheaper than L1, instant finality.',
    color: 'from-yellow-500 to-lime-500',
  },
  {
    icon: Lock,
    title: 'Fully On-Chain',
    description: 'All attestations stored on Intuition Protocol. Permanent & verifiable.',
    color: 'from-rose-500 to-red-500',
  },
]

export function Features() {
  return (
    <section className="relative py-32 overflow-hidden">

      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/images/backgrounds/symmetric-bg.jpg"
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)] via-transparent to-[rgb(10,10,15)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Why <span className="text-primary">AgentScore</span>?
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
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
              whileHover={{ y: -5, scale: 1.02 }}
              className={cn(
                'group p-8 rounded-2xl',
                'bg-white/5 backdrop-blur-sm border border-white/10',
                'hover:bg-white/10 hover:border-white/20',
                'transition-all duration-300'
              )}
            >
              {/* Icon */}
              <div className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center mb-6',
                'bg-gradient-to-br',
                feature.color
              )}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
