'use client'

import Link from 'next/link'
import { ExternalLink, Shield, Bot, Zap, MessageSquare, Github, Twitter, Globe } from 'lucide-react'

const CURRENT_YEAR = new Date().getFullYear()

const navLinks = [
  {
    heading: 'Platform',
    items: [
      { label: 'Agent Explorer', href: '/agents', icon: Bot },
      { label: 'Skills Registry', href: '/skills', icon: Zap },
      { label: 'Claims', href: '/claims', icon: MessageSquare },
      { label: 'Register Agent', href: '/register', icon: Shield },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'My Profile', href: '/profile', icon: null },
      { label: 'My Agents', href: '/profile?tab=agents', icon: null },
      { label: 'Supporting', href: '/profile?tab=supporting', icon: null },
      { label: 'Badges', href: '/profile?tab=badges', icon: null },
    ],
  },
  {
    heading: 'Ecosystem',
    items: [
      { label: 'Intuition Protocol', href: 'https://github.com/0xIntuition', external: true },
      { label: 'Intuition Testnet', href: 'https://testnet.portal.intuition.systems/', external: true },
      { label: 'Intuition Docs', href: 'https://docs.intuition.systems', external: true },
      { label: 'GitHub', href: 'https://github.com/Kryptoremontier/agentscore', external: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      {/* Top separator with glow */}
      <div className="h-px w-full" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(200,150,60,0.4) 30%, rgba(200,150,60,0.6) 50%, rgba(200,150,60,0.4) 70%, transparent 100%)',
      }} />

      {/* Background */}
      <div className="absolute inset-0 bg-[#0C0E11]" />
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Ambient gold glow */}
      <div className="absolute bottom-0 left-1/3 w-[500px] h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(200,150,60,0.04), transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main footer content */}
        <div className="py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Logo */}
            <Link href="/" className="group inline-flex items-center gap-3 w-fit">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,150,60,0.2), rgba(200,150,60,0.05))',
                  border: '1px solid rgba(200,150,60,0.35)',
                  boxShadow: '0 0 16px rgba(200,150,60,0.15)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#C8963C" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M2 17l10 5 10-5" stroke="#C8963C" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M2 12l10 5 10-5" stroke="#C9A84C" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-lg font-bold text-[#C8963C] tracking-tight group-hover:text-[#E8B84B] transition-colors">
                AgentScore
              </span>
            </Link>

            {/* Tagline */}
            <p className="text-sm text-[#6B7480] leading-relaxed max-w-xs">
              Decentralized trust verification for AI agents. Stake{' '}
              <span className="text-[#B5BDC6] font-medium">tTRUST</span> to signal confidence —
              every vote is transparent, on-chain, and permanent.
            </p>

            {/* Testnet badge */}
            <div className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(46,204,113,0.07)',
                border: '1px solid rgba(46,204,113,0.18)',
                color: '#2ECC71',
              }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] animate-pulse" />
              Live on Intuition Testnet
            </div>

            {/* Social links */}
            <div className="flex items-center gap-3 mt-1">
              {[
                { icon: Github, href: 'https://github.com/Kryptoremontier/agentscore', label: 'GitHub' },
                { icon: Twitter, href: 'https://x.com/AgentScoreApp', label: 'X / Twitter' },
                { icon: Globe, href: 'https://intuition.systems', label: 'Intuition' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(200,150,60,0.10)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,150,60,0.3)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  <Icon className="w-3.5 h-3.5 text-[#7A838D]" />
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {navLinks.map(col => (
            <div key={col.heading} className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#C8963C]">
                {col.heading}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.items.map(item => (
                  <li key={item.label}>
                    {'external' in item && item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-1.5 text-sm text-[#6B7480] hover:text-[#B5BDC6] transition-colors duration-200"
                      >
                        {item.label}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="flex items-center gap-1.5 text-sm text-[#6B7480] hover:text-[#B5BDC6] transition-colors duration-200"
                      >
                        {'icon' in item && item.icon && (
                          <item.icon className="w-3.5 h-3.5 text-[#C8963C]/50" />
                        )}
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Bottom bar */}
        <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#4A5260]">

          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span>
              © {CURRENT_YEAR} AgentScore. All rights reserved.
            </span>
            <span className="hidden sm:block opacity-40">·</span>
            <span>
              Built on{' '}
              <a
                href="https://intuition.systems"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C8963C]/70 hover:text-[#C8963C] transition-colors"
              >
                Intuition Protocol
              </a>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'rgba(200,150,60,0.1)', border: '1px solid rgba(200,150,60,0.2)', color: '#C8963C' }}>
              Testnet Alpha
            </span>
            <span className="text-[#4A5260]">
              Not financial advice. Use at your own risk.
            </span>
          </div>
        </div>

      </div>
    </footer>
  )
}
