'use client'

/**
 * The landing's closing call (Etap 5b Run 2): the same two ways in as the first screen — vouch for
 * an agent, or build on it. No numbers here any more: the one number is on the first screen.
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Code2, BadgeCheck } from 'lucide-react'
import { LANDING_CTA_VOUCH, LANDING_CTA_DEVELOPERS } from '@/lib/people-copy'
import { INTUITION_HUB_URL } from '@/lib/intuition-links'

export function CTA() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Semi-transparent overlay — fixed bg shows through */}
      <div className="absolute inset-0 bg-[rgb(10,10,15)]/70" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C8963C]/15 mb-8">
            <BadgeCheck className="w-8 h-8 text-[#C8963C]" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-display leading-display">
            Know an agent that delivers?
          </h2>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
            Vouch for it in the area it is good at. It takes a wallet and a little testnet tTRUST —
            free from the{' '}
            <a href={INTUITION_HUB_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
              Intuition Hub
            </a>{' '}
            — and your name stays on it.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/agents" className="btn-primary group px-8">
              {LANDING_CTA_VOUCH}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/docs" className="btn-secondary">
              <Code2 className="w-5 h-5" />
              {LANDING_CTA_DEVELOPERS}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
