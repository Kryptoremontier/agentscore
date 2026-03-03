'use client'

import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { Bot, Zap, MessageSquare, TrendingUp, ShieldCheck, Database, GitBranch, Users, Layers, ScanLine, ChevronRight } from 'lucide-react'

// ─── Sub-components ──────────────────────────────────────────────────────────

function DocCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`}
      style={{ background: 'linear-gradient(135deg,#13161A,#1A1E24)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {children}
    </div>
  )
}

function SectionTitle({ icon: Icon, color, label }: { icon: React.ElementType; color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <h2 className="text-lg font-bold text-white">{label}</h2>
    </div>
  )
}

function Tag({ text, rgb }: { text: string; rgb: string }) {
  return (
    <span className="inline-flex text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
      style={{ color: `rgb(${rgb})`, background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.25)` }}>
      {text}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <PageBackground image="wave" opacity={0.2}>
      <div className="pt-28 pb-20">
        <div className="container max-w-4xl">

          {/* Hero header */}
          <div className="mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-semibold uppercase tracking-widest"
              style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.2)', color: '#C8963C' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8963C] animate-pulse" />
              Platform Documentation
            </div>
            <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
              How{' '}
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg,#C8963C,#E8B84B)' }}>
                AgentScore
              </span>{' '}
              Works
            </h1>
            <p className="text-[#7A838D] text-xl max-w-2xl leading-relaxed">
              A decentralized trust and reputation layer for AI agents and skills,
              built on top of the Intuition Protocol on Ethereum.
            </p>
          </div>

          <div className="grid gap-5">

            {/* ── What is AgentScore ── */}
            <DocCard>
              <SectionTitle icon={Database} color="#C8963C" label="What is AgentScore?" />
              <p className="text-[#9BA5B0] leading-relaxed mb-5">
                AgentScore is an open, on-chain reputation system that lets anyone evaluate AI agents and
                skills using real economic signals. By staking <span className="text-white font-semibold">tTRUST</span> tokens
                you permanently record your confidence on the blockchain — every signal is transparent, auditable, and tradeable.
              </p>
              <div className="flex flex-wrap gap-2">
                <Tag text="On-chain" rgb="200,150,60" />
                <Tag text="Permissionless" rgb="46,230,214" />
                <Tag text="Intuition Protocol" rgb="56,182,255" />
                <Tag text="Testnet Alpha" rgb="200,150,60" />
              </div>
            </DocCard>

            {/* ── Three entity types ── */}
            <DocCard>
              <SectionTitle icon={Layers} color="#C8963C" label="Three types of on-chain entities" />
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: Bot,
                    rgb: '200,150,60',
                    hex: '#C8963C',
                    title: 'Agents',
                    desc: 'AI agent identities stored as Intuition Atoms. Each agent has a unique on-chain ID, a Trust Score, and a staking vault.',
                    link: '/agents',
                  },
                  {
                    icon: Zap,
                    rgb: '46,230,214',
                    hex: '#2EE6D6',
                    title: 'Skills',
                    desc: 'Specific capabilities an agent exposes (e.g. "Code Generation", "RAG Search"). Staked and scored independently.',
                    link: '/skills',
                  },
                  {
                    icon: MessageSquare,
                    rgb: '56,182,255',
                    hex: '#38B6FF',
                    title: 'Claims',
                    desc: 'Verifiable statements (triples) about agents and skills — e.g. "Agent X has Skill Y". Supported or opposed by stakeholders.',
                    link: '/claims',
                  },
                ].map(e => (
                  <Link key={e.title} href={e.link}
                    className="group block rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: `rgba(${e.rgb},0.05)`, border: `1px solid rgba(${e.rgb},0.15)` }}
                    onMouseEnter={ev => (ev.currentTarget.style.borderColor = `rgba(${e.rgb},0.35)`)}
                    onMouseLeave={ev => (ev.currentTarget.style.borderColor = `rgba(${e.rgb},0.15)`)}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                      style={{ background: `rgba(${e.rgb},0.12)`, border: `1px solid rgba(${e.rgb},0.28)` }}>
                      <e.icon className="w-4.5 h-4.5" style={{ color: e.hex }} />
                    </div>
                    <div className="font-bold text-white text-sm mb-1.5 flex items-center gap-1.5">
                      {e.title}
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: e.hex }} />
                    </div>
                    <p className="text-[#6B7480] text-xs leading-relaxed">{e.desc}</p>
                  </Link>
                ))}
              </div>
            </DocCard>

            {/* ── How trust scores work ── */}
            <DocCard>
              <SectionTitle icon={TrendingUp} color="#2ECC71" label="How Trust Scores work" />
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)' }}>
                  <div className="text-sm font-bold text-[#2ECC71] mb-1.5">Support — Boost the score</div>
                  <p className="text-[#9BA5B0] text-sm leading-relaxed">
                    Stake tTRUST in favour of an entity. Raises its Trust Score.
                    Your position is recorded in the <strong className="text-white">support vault</strong> and earns
                    proportional shares of the bonding curve.
                  </p>
                </div>
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="text-sm font-bold text-red-400 mb-1.5">Oppose — Lower the score</div>
                  <p className="text-[#9BA5B0] text-sm leading-relaxed">
                    Stake tTRUST against an entity. Lowers its Trust Score.
                    Recorded in the <strong className="text-white">counter vault</strong> — equally tradeable.
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-[#9BA5B0]">
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C8963C] shrink-0" />
                  Score range <strong className="text-white">0–100</strong>, anchored at 50 until sufficient stake accumulates
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C8963C] shrink-0" />
                  <strong className="text-white">Bonding curves</strong> — price per share rises as more stake enters a vault
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C8963C] shrink-0" />
                  <strong className="text-white">Time decay</strong> — older signals decay gradually (half-life ~90 days)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C8963C] shrink-0" />
                  Positions can be <strong className="text-white">sold (redeemed)</strong> at any time at current curve price
                </li>
              </ul>
            </DocCard>

            {/* ── Trust tiers ── */}
            <DocCard>
              <SectionTitle icon={ShieldCheck} color="#38B6FF" label="Trust Tiers" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { tier: 'Unverified', icon: '○', rgb: '120,131,141', desc: 'No signals yet',  detail: '0 stakers' },
                  { tier: 'Sandbox',    icon: '◐', rgb: '200,150,60',  desc: 'Early activity',  detail: '3+ stakers' },
                  { tier: 'Trusted',    icon: '✓', rgb: '46,204,113',  desc: 'Solid community', detail: '10+ stakers' },
                  { tier: 'Verified',   icon: '⭐', rgb: '232,184,75',  desc: 'High conviction', detail: '25+ stakers' },
                ].map(t => (
                  <div key={t.tier} className="rounded-xl p-4 text-center"
                    style={{ background: `rgba(${t.rgb},0.06)`, border: `1px solid rgba(${t.rgb},0.2)` }}>
                    <div className="text-2xl mb-2" style={{ color: `rgb(${t.rgb})` }}>{t.icon}</div>
                    <div className="font-bold text-white text-sm mb-0.5">{t.tier}</div>
                    <div className="text-[#6B7480] text-xs">{t.detail}</div>
                  </div>
                ))}
              </div>
              <p className="text-[#6B7480] text-xs">
                Tier thresholds apply to all entity types: Agents, Skills, and Claims.
              </p>
            </DocCard>

            {/* ── Claims (triples) ── */}
            <DocCard>
              <SectionTitle icon={GitBranch} color="#2EE6D6" label="Claims — verifiable on-chain statements" />
              <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
                A Claim is a <strong className="text-white">triple</strong> of three Atoms: <em>Subject → Predicate → Object</em>.
                Claims let you express structured relationships like{' '}
                <em className="text-[#C8963C]">"Agent X [has skill] Code Generation"</em> or{' '}
                <em className="text-[#38B6FF]">"Agent Y [is trusted by] CommunityDAO"</em>.
                Anyone can Support or Oppose a Claim with tTRUST.
              </p>
              <div className="flex flex-wrap gap-2 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.3)', color: '#C8963C' }}>
                  Subject (Agent / Skill)
                </span>
                <span className="px-2 py-1 text-[#4A5260] font-mono text-xs self-center">→</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(46,230,214,0.10)', border: '1px solid rgba(46,230,214,0.28)', color: '#2EE6D6' }}>
                  Predicate (relation)
                </span>
                <span className="px-2 py-1 text-[#4A5260] font-mono text-xs self-center">→</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(56,182,255,0.10)', border: '1px solid rgba(56,182,255,0.28)', color: '#38B6FF' }}>
                  Object (any Atom)
                </span>
              </div>
            </DocCard>

            {/* ── Shares & bonding curve ── */}
            <DocCard>
              <SectionTitle icon={TrendingUp} color="#C8963C" label="Shares & Bonding Curve" />
              <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
                Every vault (Support or Oppose) runs on a <strong className="text-white">bonding curve</strong>:
                the price per share increases as more tTRUST enters the vault.
                Early supporters pay less and benefit most if conviction grows.
              </p>
              <ul className="space-y-2 text-sm text-[#9BA5B0]">
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#2ECC71] shrink-0" />
                  <strong className="text-white">Buy (Support / Oppose)</strong> — deposit tTRUST, receive vault shares at current curve price
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" />
                  <strong className="text-white">Sell (Redeem)</strong> — return shares, receive tTRUST at current curve price
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C8963C] shrink-0" />
                  Your holdings and proceeds are visible in the <strong className="text-white">Your Holdings</strong> panel inside each entity's detail view
                </li>
              </ul>
            </DocCard>

            {/* ── Getting started ── */}
            <DocCard>
              <SectionTitle icon={Users} color="#2ECC71" label="Getting started" />
              <p className="text-[#9BA5B0] text-sm mb-6">
                Connect a wallet, get testnet tTRUST from the faucet, then explore or register.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Browse Agents',  href: '/agents',   rgb: '200,150,60',  hex: '#C8963C' },
                  { label: 'Browse Skills',  href: '/skills',   rgb: '46,230,214',  hex: '#2EE6D6' },
                  { label: 'Browse Claims',  href: '/claims',   rgb: '56,182,255',  hex: '#38B6FF' },
                  { label: 'Register Agent', href: '/register', rgb: '200,150,60',  hex: '#C8963C' },
                  { label: 'Register Skill', href: '/register', rgb: '46,230,214',  hex: '#2EE6D6' },
                  { label: 'Create Claim',   href: '/claims',   rgb: '56,182,255',  hex: '#38B6FF' },
                ].map(btn => (
                  <Link key={btn.label} href={btn.href}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: `rgba(${btn.rgb},0.08)`, border: `1px solid rgba(${btn.rgb},0.22)`, color: btn.hex }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = `rgba(${btn.rgb},0.15)`)}
                    onMouseLeave={ev => (ev.currentTarget.style.background = `rgba(${btn.rgb},0.08)`)}
                  >
                    {btn.label}
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </Link>
                ))}
              </div>
            </DocCard>

          </div>
        </div>
      </div>
    </PageBackground>
  )
}
