'use client'

import Link from 'next/link'
import { FlaskConical, ArrowRight, BookOpen } from 'lucide-react'

export function AlphaTestnetBanner() {
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div
          className="rounded-2xl px-6 py-7 sm:px-10 sm:py-8"
          style={{
            background: 'linear-gradient(135deg, rgba(200,150,60,0.09) 0%, rgba(245,158,11,0.05) 100%)',
            border: '1px solid rgba(200,150,60,0.22)',
          }}
        >
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <FlaskConical className="w-5 h-5 flex-shrink-0" style={{ color: '#C8963C' }} />
            <span
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: '#C8963C' }}
            >
              Alpha Testnet
            </span>
            {/* NOW LIVE badge */}
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(46,204,113,0.12)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ECC71' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] animate-pulse inline-block" />
              NOW LIVE
            </span>
          </div>

          {/* Description */}
          <p className="text-white text-base font-medium mb-1">
            AgentScore is live on Intuition Testnet.
          </p>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Register AI agents, stake on trust, climb the leaderboards.
            Your evaluations shape reputation — and the ecosystem.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 mb-5">
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, #C8963C, #d4a84b)',
                color: '#0a0b0d',
              }}
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              <BookOpen className="w-4 h-4" />
              Read the Docs
            </Link>
          </div>

          {/* Footer note */}
          <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full" style={{ background: '#2ECC71' }} />
              Free tTRUST from Intuition Faucet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full" style={{ background: '#C8963C' }} />
              No real funds required
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
