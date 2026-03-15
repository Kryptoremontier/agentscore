'use client'

import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { Bot, Zap, MessageSquare, TrendingUp, ShieldCheck, Database, GitBranch, Users, Layers, ScanLine, ChevronRight, DollarSign } from 'lucide-react'

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
              <SectionTitle icon={TrendingUp} color="#2ECC71" label="How Trust Scores Work" />

              {/* AGENTSCORE formula */}
              <div className="rounded-xl p-4 mb-5 font-mono text-sm"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[#6B7480] text-xs uppercase tracking-wider mb-2">AGENTSCORE formula</div>
                <div className="text-white">
                  AGENTSCORE = <span className="text-[#C8963C]">(Trust Score × 0.60</span>{' '}
                  + <span className="text-[#2ECC71]">Composite Score × 0.40)</span>{' '}
                  × <span className="text-[#38B6FF]">soft_gate</span>
                </div>
              </div>

              {/* Two top-level components */}
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(200,150,60,0.06)', border: '1px solid rgba(200,150,60,0.2)' }}>
                  <div className="text-sm font-bold text-[#C8963C] mb-1.5">Trust Score — 60%</div>
                  <p className="text-[#9BA5B0] text-xs leading-relaxed">
                    Economic confidence. Anchored at 50 when stake is small, moves toward the true
                    support/oppose ratio as total stake grows. Includes a momentum component (±5 pts)
                    for 24h activity.
                  </p>
                </div>
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)' }}>
                  <div className="text-sm font-bold text-[#2ECC71] mb-1.5">Composite Score — 40%</div>
                  <p className="text-[#9BA5B0] text-xs leading-relaxed">
                    Multi-dimensional quality metrics: time-decayed signal ratio, staker diversity,
                    stability duration, and price retention. Resistant to whale manipulation.
                  </p>
                </div>
              </div>

              {/* 4 pillars table */}
              <div className="text-xs font-bold text-[#B5BDC6] uppercase tracking-wider mb-3">
                Composite Score — 4 Pillars
              </div>
              <div className="rounded-xl overflow-hidden mb-5"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <th className="text-left px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider">Pillar</th>
                      <th className="text-right px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider">Weight</th>
                      <th className="text-left px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider hidden sm:table-cell">What it measures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { pillar: 'Signal Ratio', weight: '40%', desc: 'Time-decayed support/oppose ratio — half-life 90d, freshness bonus ×1.5 for 7d', color: '#C8963C' },
                      { pillar: 'Staker Diversity', weight: '25%', desc: 'Log₂ scale of qualified stakers (≥ 0.1 tTRUST) — anti-sybil, caps at 100 stakers', color: '#2ECC71' },
                      { pillar: 'Stability', weight: '25%', desc: 'Days above 50% trust ratio, penalised for high daily variance', color: '#2EE6D6' },
                      { pillar: 'Price Retention', weight: '10%', desc: 'Current on-chain share price vs all-time high — from MultiVault', color: '#38B6FF' },
                    ].map((row, i) => (
                      <tr key={row.pillar} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: row.color }}>{row.pillar}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-white">{row.weight}</td>
                        <td className="px-4 py-2.5 text-[#7A838D] hidden sm:table-cell">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Soft gate + anti-manipulation */}
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(56,182,255,0.06)', border: '1px solid rgba(56,182,255,0.18)' }}>
                  <div className="text-xs font-bold text-[#38B6FF] mb-2 uppercase tracking-wider">Soft Gate</div>
                  <p className="text-[#9BA5B0] text-xs leading-relaxed">
                    Agents with less than 50% support have their score proportionally reduced
                    (e.g. 30% support → score × 0.60). No hard cliff — smooth continuous scaling.
                  </p>
                </div>
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div className="text-xs font-bold text-red-400 mb-2 uppercase tracking-wider">Anti-Manipulation</div>
                  <ul className="space-y-1 text-[#9BA5B0] text-xs">
                    <li>• Soft gate — caps unpopular agents</li>
                    <li>• Log₂ diversity — whales can&apos;t inflate alone</li>
                    <li>• Min 0.1 tTRUST — sybil dust ignored</li>
                    <li>• Variance penalty — no oscillation gaming</li>
                  </ul>
                </div>
              </div>

              {/* Trust Tiers inline */}
              <div className="text-xs font-bold text-[#B5BDC6] uppercase tracking-wider mb-3">
                Trust Tiers — all criteria must be met
              </div>
              <div className="rounded-xl overflow-hidden mb-5"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {['Tier', 'Min Stakers', 'Min Stake', 'Min Ratio', 'Min Days'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[#7A838D] font-semibold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { icon: '○', tier: 'Unverified', stakers: '0', stake: '—', ratio: '—', days: '0', rgb: '120,131,141' },
                      { icon: '◐', tier: 'Sandbox', stakers: '3+', stake: '0.1 tTRUST', ratio: 'any', days: '0', rgb: '200,150,60' },
                      { icon: '✓', tier: 'Trusted', stakers: '10+', stake: '1 tTRUST', ratio: '60%', days: '7', rgb: '46,204,113' },
                      { icon: '⭐', tier: 'Verified', stakers: '25+', stake: '5 tTRUST', ratio: '75%', days: '30', rgb: '232,184,75' },
                    ].map((row, i) => (
                      <tr key={row.tier} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td className="px-3 py-2 font-bold" style={{ color: `rgb(${row.rgb})` }}>{row.icon} {row.tier}</td>
                        <td className="px-3 py-2 text-[#9BA5B0]">{row.stakers}</td>
                        <td className="px-3 py-2 text-[#9BA5B0]">{row.stake}</td>
                        <td className="px-3 py-2 text-[#9BA5B0]">{row.ratio}</td>
                        <td className="px-3 py-2 text-[#9BA5B0]">{row.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Link to full docs */}
              <div className="flex items-center gap-2 text-xs text-[#6B7480]">
                <ScanLine className="w-3.5 h-3.5 text-[#C8963C]" />
                Full technical documentation:{' '}
                <a
                  href="https://github.com/Kryptoremontier/agentscore/blob/main/docs/TRUST_SCORING.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#38B6FF] hover:text-[#2EE6D6] transition-colors font-mono"
                >
                  TRUST_SCORING.md ↗
                </a>
              </div>
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


            {/* ── Fee Model ── */}
            <DocCard>
              <SectionTitle icon={DollarSign} color="#2ECC71" label="Platform Fees" />
              <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
                All write operations (registration, staking, claims) route through our FeeProxy contract.
                A platform fee is collected atomically on every operation. Reading data is always free.
              </p>

              <div className="rounded-xl overflow-hidden mb-5"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <th className="text-left px-4 py-2.5 text-[#7A838D] font-semibold text-xs uppercase tracking-wider">Operation</th>
                      <th className="text-right px-4 py-2.5 text-[#7A838D] font-semibold text-xs uppercase tracking-wider">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { op: 'Agent registration (createAtom)', fee: '~0.002 tTRUST (protocol)', color: '#C8963C' },
                      { op: 'Skill registration (createAtom)', fee: '~0.002 tTRUST (protocol)', color: '#2EE6D6' },
                      { op: 'Claim / Triple creation', fee: '~0.002 tTRUST (protocol)', color: '#38B6FF' },
                      { op: 'Staking Support / Oppose', fee: '0.001 tTRUST + 2.5%', color: '#C8963C' },
                      { op: 'Redeem / Sell shares', fee: 'FREE', color: '#2ECC71' },
                      { op: 'Reading data', fee: 'FREE', color: '#2ECC71' },
                    ].map((row, i) => (
                      <tr key={row.op} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td className="px-4 py-2.5 text-[#9BA5B0]">{row.op}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-xs" style={{ color: row.color }}>{row.fee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl p-4 mb-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-bold text-[#B5BDC6] mb-2">Example: Staking 1 tTRUST</div>
                <div className="space-y-1 text-xs text-[#9BA5B0]">
                  <div className="flex justify-between"><span>You send</span><span className="text-white">~1.026 tTRUST</span></div>
                  <div className="flex justify-between"><span>Platform fee</span><span className="text-[#C8963C]">~0.026 tTRUST</span></div>
                  <div className="flex justify-between"><span>Deposited to vault</span><span className="text-[#2ECC71]">1.0 tTRUST</span></div>
                </div>
              </div>

              <div className="text-xs text-[#6B7480] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[#7A838D]">FeeProxy:</span>
                  <a
                    href="https://testnet.explorer.intuition.systems/address/0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#38B6FF] hover:text-[#2EE6D6] transition-colors"
                  >
                    0x2f76…c41 ↗
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#7A838D]">MultiVault:</span>
                  <a
                    href="https://testnet.explorer.intuition.systems/address/0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#38B6FF] hover:text-[#2EE6D6] transition-colors"
                  >
                    0x2Ece…91 ↗
                  </a>
                </div>
              </div>
            </DocCard>

            {/* ── Getting started ── */}
            <DocCard>
              <SectionTitle icon={Users} color="#2ECC71" label="Getting started" />
              <p className="text-[#9BA5B0] text-sm mb-6">
                Connect a wallet, get testnet tTRUST from the faucet, then explore or register.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Browse Agents',  href: '/agents',             rgb: '200,150,60',  hex: '#C8963C' },
                  { label: 'Browse Skills',  href: '/skills',             rgb: '46,230,214',  hex: '#2EE6D6' },
                  { label: 'Browse Claims',  href: '/claims',             rgb: '56,182,255',  hex: '#38B6FF' },
                  { label: 'Register Agent', href: '/register',           rgb: '200,150,60',  hex: '#C8963C' },
                  { label: 'Register Skill', href: '/register?tab=skill', rgb: '46,230,214',  hex: '#2EE6D6' },
                  { label: 'Create Claim',   href: '/claims?create=true', rgb: '56,182,255',  hex: '#38B6FF' },
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
