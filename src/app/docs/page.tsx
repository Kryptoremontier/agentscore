'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import {
  Bot, Zap, MessageSquare, TrendingUp, ShieldCheck, Database, GitBranch,
  Users, Layers, ScanLine, ChevronRight, DollarSign, Target, Globe,
  Code, ExternalLink, BookOpen,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function Formula({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-xl p-4 mb-4 font-mono text-sm"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {label && <div className="text-[#6B7480] text-xs uppercase tracking-wider mb-2">{label}</div>}
      <div className="text-white leading-relaxed">{children}</div>
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',         icon: BookOpen },
  { id: 'scoring',    label: 'Trust Scoring',     icon: TrendingUp },
  { id: 'evaluators', label: 'Evaluators',        icon: Target },
  { id: 'domains',    label: 'Domains',           icon: Globe },
  { id: 'fees',       label: 'Fee Model',         icon: DollarSign },
  { id: 'contracts',  label: 'Smart Contracts',   icon: Code },
]

// ─── Tab content ──────────────────────────────────────────────────────────────

function TabOverview() {
  return (
    <div className="grid gap-5">

      {/* What is AgentScore */}
      <DocCard>
        <SectionTitle icon={Database} color="#C8963C" label="What is AgentScore?" />
        <p className="text-[#9BA5B0] leading-relaxed mb-5">
          AgentScore is an open, on-chain reputation system that lets anyone evaluate AI agents and
          skills using real economic signals. By staking <span className="text-white font-semibold">tTRUST</span> tokens
          you permanently record your confidence on the blockchain — every signal is transparent, auditable, and tradeable.
        </p>
        <p className="text-[#9BA5B0] leading-relaxed mb-5">
          Agents and skills are registered as <strong className="text-white">Atoms</strong> on Intuition Protocol.
          Relationships between them are <strong className="text-white">Triples</strong>. Trust is signaled by staking
          tTRUST into vaults via bonding curves.
        </p>
        <div className="flex flex-wrap gap-2">
          <Tag text="On-chain" rgb="200,150,60" />
          <Tag text="Permissionless" rgb="46,230,214" />
          <Tag text="Intuition Protocol" rgb="56,182,255" />
          <Tag text="Testnet Alpha" rgb="200,150,60" />
        </div>
      </DocCard>

      {/* How it works */}
      <DocCard>
        <SectionTitle icon={Layers} color="#C8963C" label="How It Works" />
        <div className="grid sm:grid-cols-4 gap-3 mb-5">
          {[
            { num: '1', label: 'Register', desc: 'Create on-chain identities for AI Agents and Skills', color: '#C8963C' },
            { num: '2', label: 'Claim',    desc: 'Define relationships: [Agent] [hasAgentSkill] [Skill]', color: '#2EE6D6' },
            { num: '3', label: 'Stake',    desc: 'Back your conviction with tTRUST (Support or Oppose)', color: '#38B6FF' },
            { num: '4', label: 'Score',    desc: 'Trust scores emerge from economic signals + quality metrics', color: '#2ECC71' },
          ].map(s => (
            <div key={s.num} className="rounded-xl p-4"
              style={{ background: `rgba(255,255,255,0.02)`, border: `1px solid rgba(255,255,255,0.06)` }}>
              <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.num}</div>
              <div className="text-sm font-bold text-white mb-1">{s.label}</div>
              <p className="text-[#6B7480] text-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </DocCard>

      {/* Three entity types */}
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
                <e.icon className="w-4 h-4" style={{ color: e.hex }} />
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

      {/* Claims visual */}
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

      {/* Key concepts summary */}
      <DocCard>
        <SectionTitle icon={ShieldCheck} color="#2ECC71" label="Key Concepts" />
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'AGENTSCORE', desc: 'Hybrid trust score combining economic confidence (60%) with quality metrics (40%). Range 0–100.', color: '#C8963C' },
            { label: 'Contextual Trust', desc: 'Each skill has its own trust score. "Trusted for code: 85" ≠ "Trusted for medical: 31"', color: '#2EE6D6' },
            { label: 'Agent Domains', desc: 'Leaderboards ranking agents per skill domain. Find the best agent for a specific task.', color: '#38B6FF' },
            { label: 'Evaluator System', desc: 'Your track record as a staker determines your influence. Better evaluators = more weight.', color: '#2ECC71' },
            { label: 'Bonding Curve', desc: 'Price per share increases with vault size. Early supporters pay less and benefit most if conviction grows.', color: '#C8963C' },
            { label: '6 Anti-Manipulation Layers', desc: 'Soft gate, log diversity, min stake, variance penalty, whale detection, accuracy-weighted staking.', color: '#EF4444' },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-sm font-bold mb-1" style={{ color: c.color }}>{c.label}</div>
              <p className="text-[#6B7480] text-xs leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </DocCard>

      {/* Getting started */}
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
  )
}

function TabScoring() {
  return (
    <div className="grid gap-5">

      {/* AGENTSCORE formula */}
      <DocCard>
        <SectionTitle icon={TrendingUp} color="#2ECC71" label="AGENTSCORE Formula" />

        <Formula label="AGENTSCORE formula">
          <div>AGENTSCORE = <span className="text-[#C8963C]">(Trust Score × 0.60</span>{' '}
            + <span className="text-[#2ECC71]">Composite Score × 0.40)</span>{' '}
            × <span className="text-[#38B6FF]">soft_gate</span>
          </div>
          <div className="mt-2 text-[#6B7480] text-xs">
            soft_gate = supportRatio / 50  (if supportRatio &lt; 50%, else 1.0)
          </div>
        </Formula>

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

        <Formula label="Trust Score calculation">
          <div>base = supportStake / totalStake × 100</div>
          <div>confidence = 1 - e<sup>(-totalStake / τ)</sup>{'    '}τ = 0.1 tTRUST (testnet)</div>
          <div>anchored = 50 + (base - 50) × confidence</div>
          <div className="mt-2 text-[#6B7480] text-xs">
            With little stake, score stays near 50 (uncertain). As stake grows, score converges toward true ratio.
          </div>
        </Formula>
      </DocCard>

      {/* 4 pillars */}
      <DocCard>
        <SectionTitle icon={Layers} color="#2EE6D6" label="Composite Score — 4 Pillars" />
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
      </DocCard>

      {/* Contextual Trust */}
      <DocCard>
        <SectionTitle icon={GitBranch} color="#2EE6D6" label="Contextual Trust — Per-Skill Scoring" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
          Each <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: '#C8963C' }}>
            [Agent] [hasAgentSkill] [Skill]
          </code> triple has its own vault.
          The same scoring algorithm runs per-triple, giving each skill its own independent trust score.
        </p>
        <div className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(46,230,214,0.05)', border: '1px solid rgba(46,230,214,0.15)' }}>
          <div className="text-xs font-bold text-[#2EE6D6] mb-2 uppercase tracking-wider">Example</div>
          <div className="space-y-1 text-xs text-[#9BA5B0] font-mono">
            <div>GPT-4 [hasAgentSkill] Code Generation  → trust: <span className="text-[#2ECC71]">85</span></div>
            <div>GPT-4 [hasAgentSkill] Medical Advice   → trust: <span className="text-[#EF4444]">31</span></div>
            <div>GPT-4 [hasAgentSkill] Creative Writing → trust: <span className="text-[#C8963C]">72</span></div>
          </div>
        </div>
        <Formula label="Overall AGENTSCORE from skills">
          <div>AGENTSCORE = Σ (skillTrustScore × skillVaultStake) / totalStake</div>
          <div className="mt-1 text-[#6B7480] text-xs">
            Agent without skills → global AGENTSCORE (backward compatible)
          </div>
        </Formula>
      </DocCard>

      {/* Reputation Half-Life */}
      <DocCard>
        <SectionTitle icon={TrendingUp} color="#C8963C" label="Reputation Half-Life" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
          Older signals lose influence over time. Recent activity matters more than history.
        </p>
        <Formula label="Signal decay formula">
          <div>weight(signal) = e<sup>(-0.693 × days / 90)</sup></div>
          <div className="mt-2 text-[#6B7480] text-xs">Half-life: 90 days. Freshness bonus: ×1.5 for signals &lt; 7 days old.</div>
        </Formula>
        <div className="grid grid-cols-3 gap-3">
          {[
            { days: 'Today', weight: '1.0× (+ freshness ×1.5)', color: '#2ECC71' },
            { days: '90 days', weight: '0.5× weight', color: '#C8963C' },
            { days: '180 days', weight: '0.25× weight', color: '#EF4444' },
          ].map(r => (
            <div key={r.days} className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs text-[#7A838D] mb-1">{r.days}</div>
              <div className="text-xs font-semibold" style={{ color: r.color }}>{r.weight}</div>
            </div>
          ))}
        </div>
      </DocCard>

      {/* Shares & Bonding Curve */}
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
            Your holdings and proceeds are visible in the <strong className="text-white">Your Holdings</strong> panel inside each entity&apos;s detail view
          </li>
        </ul>
      </DocCard>

      {/* Trust Tiers */}
      <DocCard>
        <SectionTitle icon={ShieldCheck} color="#C8963C" label="Trust Tiers — all criteria must be met" />
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
      </DocCard>

      {/* Anti-manipulation — 6 layers */}
      <DocCard>
        <SectionTitle icon={ShieldCheck} color="#EF4444" label="Anti-Manipulation — 6 Layers" />
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { n: '1', label: 'Soft Gate', desc: 'Agents with &lt;50% support have scores proportionally reduced. 30% support → score ×0.60. No hard cliff.', color: '#38B6FF' },
            { n: '2', label: 'Log Diversity', desc: 'Staker count contribution is logarithmic (log₂). One whale can\'t inflate score alone.', color: '#2ECC71' },
            { n: '3', label: 'Min Stake', desc: 'Wallets staking &lt;0.1 tTRUST don\'t count toward staker diversity. Sybil dust ignored.', color: '#C8963C' },
            { n: '4', label: 'Variance Penalty', desc: 'Score oscillation is penalized. Stable agents are rewarded. Gaming by rapid stake/unstake fails.', color: '#2EE6D6' },
            { n: '5', label: 'Whale Detection', desc: 'Diversity-weighted ratio reduces whale influence on BOTH support and oppose sides.', color: '#C8963C' },
            { n: '6', label: 'Accuracy-Weighted Staking', desc: 'Staker track record determines influence weight (0.5×–1.5×). See Evaluators tab.', color: '#EF4444' },
          ].map(l => (
            <div key={l.n} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `${l.color}22`, color: l.color }}>{l.n}</span>
                <span className="text-sm font-bold text-white">{l.label}</span>
              </div>
              <p className="text-[#6B7480] text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: l.desc }} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#6B7480] mt-5">
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

    </div>
  )
}

function TabEvaluators() {
  return (
    <div className="grid gap-5">

      {/* What is it */}
      <DocCard>
        <SectionTitle icon={Target} color="#F59E0B" label="What Is the Evaluator System?" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
          Your track record as a staker determines your influence on trust scores.
          If you consistently backed agents that maintained trust, your future stakes carry more weight.
          If you backed agents that crashed, less.
        </p>
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
          This is <strong className="text-white">meritocratic staking</strong> — not just capital, but judgment quality.
          The same 1 tTRUST stake from a Sage evaluator carries 1.42× the weight of a Scout&apos;s stake.
        </p>
        <Formula label="effective stake formula">
          <div>effectiveStake = stakeAmount × <span className="text-[#2ECC71]">diversityWeight</span> × <span className="text-[#F59E0B]">evaluatorWeight</span></div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#6B7480]">
            <div><span className="text-white">stakeAmount</span> — capital</div>
            <div><span className="text-[#2ECC71]">diversityWeight</span> — anti-whale</div>
            <div><span className="text-[#F59E0B]">evaluatorWeight</span> — track record</div>
          </div>
        </Formula>
      </DocCard>

      {/* The math */}
      <DocCard>
        <SectionTitle icon={TrendingUp} color="#F59E0B" label="How Evaluator Score Is Calculated" />
        <Formula label="evaluator score formula">
          <div>rawAccuracy = correctPicks / totalPicks</div>
          <div>confidence = 1 - e<sup>(-totalPicks / 5)</sup></div>
          <div>adjustedAccuracy = 0.5 + (rawAccuracy - 0.5) × confidence</div>
          <div>evaluatorWeight = 0.5 + adjustedAccuracy</div>
          <div className="mt-2 text-[#6B7480] text-xs">Range: 0.5× (worst) → 1.0× (neutral) → 1.5× (best)</div>
        </Formula>

        <div className="text-xs font-bold text-[#B5BDC6] uppercase tracking-wider mb-3">Example weights</div>
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Picks', 'Accuracy', 'Confidence', 'Weight'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { picks: '0', acc: '—', conf: '0%', w: '1.00×', color: '#7A838D' },
                { picks: '1', acc: '100%', conf: '18%', w: '1.09×', color: '#C8963C' },
                { picks: '5', acc: '80%', conf: '63%', w: '1.19×', color: '#C8963C' },
                { picks: '10', acc: '80%', conf: '86%', w: '1.26×', color: '#2ECC71' },
                { picks: '20', acc: '90%', conf: '98%', w: '1.39×', color: '#2ECC71' },
                { picks: '10', acc: '20%', conf: '86%', w: '0.74×', color: '#EF4444' },
              ].map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td className="px-4 py-2 text-[#9BA5B0]">{r.picks}</td>
                  <td className="px-4 py-2 text-[#9BA5B0]">{r.acc}</td>
                  <td className="px-4 py-2 text-[#9BA5B0]">{r.conf}</td>
                  <td className="px-4 py-2 font-bold" style={{ color: r.color }}>{r.w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[#6B7480] text-xs mt-3">
          New staker = 1.0× (neutral, no penalty). Random staker at 50% accuracy = 1.0× regardless of sample size.
        </p>
      </DocCard>

      {/* What counts as a good pick */}
      <DocCard>
        <SectionTitle icon={ShieldCheck} color="#F59E0B" label="What Counts as a Good Pick?" />
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl p-4"
            style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)' }}>
            <div className="text-sm font-bold text-[#2ECC71] mb-2">✅ Correct evaluation</div>
            <ul className="space-y-1 text-xs text-[#9BA5B0]">
              <li>• Staked <strong className="text-white">Support</strong> on agent with trust &gt; 50%</li>
              <li>• Staked <strong className="text-white">Oppose</strong> on agent with trust &lt; 50%</li>
            </ul>
          </div>
          <div className="rounded-xl p-4"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}>
            <div className="text-sm font-bold text-red-400 mb-2">❌ Incorrect evaluation</div>
            <ul className="space-y-1 text-xs text-[#9BA5B0]">
              <li>• Staked <strong className="text-white">Support</strong> on agent with trust &lt; 50%</li>
              <li>• Staked <strong className="text-white">Oppose</strong> on agent with trust &gt; 50%</li>
            </ul>
          </div>
        </div>
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs text-[#9BA5B0]">
            <strong className="text-white">Self-created agents are excluded.</strong>{' '}
            You cannot build evaluator reputation by staking on your own agents.
            Track record includes both Support and Oppose positions.
          </p>
        </div>
      </DocCard>

      {/* Evaluator Tiers */}
      <DocCard>
        <SectionTitle icon={Target} color="#F59E0B" label="Evaluator Tiers" />
        <div className="grid sm:grid-cols-5 gap-3">
          {[
            { tier: 'Newcomer', icon: '🌱', req: '< 3 picks', color: '#7A838D', bg: 'rgba(255,255,255,0.03)' },
            { tier: 'Scout', icon: '🔍', req: '3+ picks, < 60%', color: '#38B6FF', bg: 'rgba(56,182,255,0.06)' },
            { tier: 'Analyst', icon: '📊', req: '5+ picks, ≥ 60%', color: '#A855F7', bg: 'rgba(168,85,247,0.06)' },
            { tier: 'Oracle', icon: '🔮', req: '10+ picks, ≥ 75%', color: '#F59E0B', bg: 'rgba(245,158,11,0.06)' },
            { tier: 'Sage', icon: '🧙', req: '20+ picks, ≥ 85%', color: '#10B981', bg: 'rgba(16,185,129,0.06)' },
          ].map(t => (
            <div key={t.tier} className="rounded-xl p-4 text-center"
              style={{ background: t.bg, border: `1px solid ${t.color}30` }}>
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="text-sm font-bold mb-1" style={{ color: t.color }}>{t.tier}</div>
              <p className="text-[#6B7480] text-xs">{t.req}</p>
            </div>
          ))}
        </div>
      </DocCard>

      {/* Leaderboard CTA */}
      <DocCard>
        <SectionTitle icon={Users} color="#F59E0B" label="Track Your Evaluator Profile" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
          View your evaluator score on your profile page. Compete for the top spots on the Evaluator Leaderboard.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/evaluators"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
            <Target className="w-4 h-4" />
            Evaluator Leaderboard
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </Link>
          <Link href="/profile"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#B5BDC6' }}>
            <Users className="w-4 h-4" />
            My Profile
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </Link>
        </div>
      </DocCard>

    </div>
  )
}

function TabDomains() {
  return (
    <div className="grid gap-5">

      {/* What are domains */}
      <DocCard>
        <SectionTitle icon={Globe} color="#38B6FF" label="What Are Agent Domains?" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
          Domains are <strong className="text-white">skill-based leaderboards</strong>. Instead of asking
          &quot;how trusted is this agent?&quot; you ask &quot;who is the BEST agent for this specific skill?&quot;
        </p>
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
          Each skill (Code Generation, Data Analysis, Creative Writing...) becomes a domain with its own
          ranked list of agents. The ranking is determined by on-chain trust signals, not by votes or ratings.
        </p>
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(56,182,255,0.05)', border: '1px solid rgba(56,182,255,0.15)' }}>
          <div className="text-xs font-bold text-[#38B6FF] mb-3 uppercase tracking-wider">Domain: Code Generation</div>
          <div className="space-y-2">
            {[
              { rank: '🥇', agent: 'GPT-4-Turbo', score: 85 },
              { rank: '🥈', agent: 'Claude 3.5 Sonnet', score: 81 },
              { rank: '🥉', agent: 'Gemini Pro', score: 74 },
            ].map(r => (
              <div key={r.agent} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span>{r.rank}</span>
                  <span className="text-[#9BA5B0]">{r.agent}</span>
                </span>
                <span className="font-bold text-[#2ECC71]">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      </DocCard>

      {/* How ranking works */}
      <DocCard>
        <SectionTitle icon={TrendingUp} color="#38B6FF" label="How Domain Ranking Works" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
          Every <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: '#C8963C' }}>
            [Agent] [hasAgentSkill] [Skill]
          </code> triple has its own vault.
          The trust score of that vault determines the agent&apos;s ranking in that domain.
        </p>
        <div className="space-y-3 mb-5">
          {[
            { step: '1', desc: 'Community stakes tTRUST into a skill claim vault (Support or Oppose)' },
            { step: '2', desc: 'The scoring engine calculates per-vault trust score using the same AGENTSCORE formula' },
            { step: '3', desc: 'Agents are sorted by domain-specific trust score within each skill domain' },
            { step: '4', desc: 'Leaderboard updates in real-time as staking activity changes vault balances' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ background: 'rgba(56,182,255,0.15)', color: '#38B6FF' }}>{s.step}</span>
              <p className="text-[#9BA5B0] text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { rank: '#1', label: 'Gold', color: '#C8963C' },
            { rank: '#2', label: 'Silver', color: '#B0BEC5' },
            { rank: '#3', label: 'Bronze', color: '#CD7F32' },
          ].map(r => (
            <div key={r.rank} className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${r.color}30` }}>
              <div className="text-xl font-bold mb-1" style={{ color: r.color }}>{r.rank}</div>
              <div className="text-xs text-[#7A838D]">{r.label} rank</div>
            </div>
          ))}
        </div>
      </DocCard>

      {/* Domain score vs AGENTSCORE */}
      <DocCard>
        <SectionTitle icon={Layers} color="#38B6FF" label="Domain Score vs Overall AGENTSCORE" />
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl p-4"
            style={{ background: 'rgba(56,182,255,0.06)', border: '1px solid rgba(56,182,255,0.2)' }}>
            <div className="text-sm font-bold text-[#38B6FF] mb-2">Domain Score</div>
            <p className="text-[#9BA5B0] text-xs leading-relaxed">
              Trust score for ONE specific skill. An agent can be #1 in Code Generation but #5 in Data Analysis.
              Domain-specific stakers determine this score.
            </p>
          </div>
          <div className="rounded-xl p-4"
            style={{ background: 'rgba(200,150,60,0.06)', border: '1px solid rgba(200,150,60,0.2)' }}>
            <div className="text-sm font-bold text-[#C8963C] mb-2">Overall AGENTSCORE</div>
            <p className="text-[#9BA5B0] text-xs leading-relaxed">
              Weighted average of ALL domain scores, weighted by stake in each skill vault.
              Reflects combined reputation across all domains.
            </p>
          </div>
        </div>
        <Formula label="AGENTSCORE from domains">
          <div>AGENTSCORE = Σ (domainScore<sub>i</sub> × stake<sub>i</sub>) / Σ stake<sub>i</sub></div>
        </Formula>
      </DocCard>

      {/* How to get ranked */}
      <DocCard>
        <SectionTitle icon={Users} color="#38B6FF" label="How to Get Your Agent Ranked" />
        <div className="space-y-3 mb-5">
          {[
            { step: '1', label: 'Register your agent', desc: 'Create an on-chain atom for your AI agent at /register', color: '#C8963C' },
            { step: '2', label: 'Create a Capability claim', desc: '[YourAgent] [hasAgentSkill] [SkillName] — links agent to a domain', color: '#2EE6D6' },
            { step: '3', label: 'Community stakes', desc: 'Stakeholders back the claim with tTRUST (Support or Oppose)', color: '#38B6FF' },
            { step: '4', label: 'Appear on leaderboard', desc: 'Your agent is ranked by domain-specific trust score', color: '#2ECC71' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ background: `${s.color}22`, color: s.color }}>{s.step}</span>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{s.label}</div>
                <p className="text-[#6B7480] text-xs">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Link href="/domains"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold w-fit transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(56,182,255,0.1)', border: '1px solid rgba(56,182,255,0.3)', color: '#38B6FF' }}>
          <Globe className="w-4 h-4" />
          Browse Domains
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </Link>
      </DocCard>

    </div>
  )
}

function TabFees() {
  return (
    <div className="grid gap-5">

      <DocCard>
        <SectionTitle icon={DollarSign} color="#2ECC71" label="Platform Fee Model" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-5">
          AgentScore uses a hybrid fee model. Registration is free — only staking routes through
          the FeeProxy contract and collects a platform fee.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Registration', status: 'FREE', desc: 'Creating agents, skills, and claims. Direct through Intuition MultiVault.', color: '#2ECC71' },
            { label: 'Staking', status: 'PLATFORM FEE', desc: '0.02 tTRUST fixed + 2.5% of deposit. Routes through FeeProxy contract.', color: '#C8963C' },
            { label: 'Redeem / Sell', status: 'FREE', desc: 'Redeeming shares goes directly through MultiVault. No platform fee.', color: '#2ECC71' },
          ].map(f => (
            <div key={f.label} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-sm font-bold text-white mb-1">{f.label}</div>
              <div className="text-xs font-bold mb-2 px-2 py-0.5 rounded inline-block"
                style={{ color: f.color, background: `${f.color}15` }}>{f.status}</div>
              <p className="text-[#6B7480] text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Full fee table */}
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
                { op: 'Staking Support / Oppose', fee: '0.02 tTRUST + 2.5%', color: '#C8963C' },
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

        {/* Staking example */}
        <div className="rounded-xl p-4 mb-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold text-[#B5BDC6] mb-2">Example: Staking 1 tTRUST</div>
          <div className="space-y-1 text-xs text-[#9BA5B0]">
            <div className="flex justify-between"><span>You send</span><span className="text-white">~1.045 tTRUST</span></div>
            <div className="flex justify-between"><span>Platform fee (0.02 + 2.5%)</span><span className="text-[#C8963C]">~0.045 tTRUST</span></div>
            <div className="flex justify-between border-t border-white/5 pt-1 mt-1"><span>Deposited to vault</span><span className="text-[#2ECC71]">1.0 tTRUST</span></div>
          </div>
        </div>

        {/* Architecture */}
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold text-[#B5BDC6] mb-3 uppercase tracking-wider">Transaction routing</div>
          <div className="space-y-1.5 text-xs font-mono text-[#9BA5B0]">
            <div>Staking        → <span className="text-[#C8963C]">FeeProxy</span> → <span className="text-[#38B6FF]">MultiVault</span></div>
            <div>Registration   → <span className="text-[#38B6FF]">MultiVault</span> (direct)</div>
            <div>Redeem / Sell  → <span className="text-[#38B6FF]">MultiVault</span> (direct, no fee)</div>
            <div>Reads          → <span className="text-[#2ECC71]">GraphQL</span> + <span className="text-[#38B6FF]">MultiVault</span> (free)</div>
          </div>
        </div>
      </DocCard>

      {/* FeeProxy note */}
      <DocCard>
        <SectionTitle icon={ShieldCheck} color="#C8963C" label="About FeeProxy" />
        <p className="text-[#9BA5B0] text-sm leading-relaxed mb-4">
          FeeProxy is an official Intuition template contract customized for AgentScore.
          It collects fees atomically with every write operation and forwards them to the fee recipient wallet.
        </p>
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(200,150,60,0.05)', border: '1px solid rgba(200,150,60,0.15)' }}>
          <p className="text-xs text-[#9BA5B0]">
            <strong className="text-white">Note:</strong> On Intuition testnet, the FeeProxy address appears as the atom creator
            for all registered entities. This is expected behavior — what matters is position ownership (vault shares),
            not the creator field. The UI displays &quot;via AgentScore&quot; instead of the raw FeeProxy address.
          </p>
        </div>
      </DocCard>

    </div>
  )
}

function TabContracts() {
  const explorer = 'https://testnet.explorer.intuition.systems/address/'
  const contracts = [
    {
      name: 'FeeProxy',
      address: '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41',
      desc: 'Routes all write operations (staking) through a fee collection layer. Official Intuition template.',
      color: '#C8963C',
    },
    {
      name: 'Fee Recipient',
      address: '0x57246adCD446809c4DB1b04046E731954985bea2',
      desc: 'Wallet receiving collected platform fees from staking operations.',
      color: '#2ECC71',
    },
    {
      name: 'MultiVault',
      address: '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91',
      desc: 'Core Intuition Protocol contract. Manages all vaults, bonding curves, atoms, and triples.',
      color: '#38B6FF',
    },
  ]

  return (
    <div className="grid gap-5">

      {/* Contracts table */}
      <DocCard>
        <SectionTitle icon={Code} color="#38B6FF" label="Deployed Contracts — Intuition Testnet (Chain ID: 13579)" />

        <div className="space-y-4 mb-6">
          {contracts.map(c => (
            <div key={c.name} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${c.color}20` }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-bold mb-1" style={{ color: c.color }}>{c.name}</div>
                  <p className="text-[#6B7480] text-xs leading-relaxed max-w-md">{c.desc}</p>
                </div>
                <a
                  href={`${explorer}${c.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 shrink-0"
                  style={{ background: `${c.color}12`, border: `1px solid ${c.color}30`, color: c.color }}
                >
                  {c.address.slice(0, 6)}…{c.address.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Full addresses */}
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th className="text-left px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider">Contract</th>
                <th className="text-left px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider hidden sm:table-cell">Full Address</th>
                <th className="text-right px-4 py-2.5 text-[#7A838D] font-semibold uppercase tracking-wider">Explorer</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, i) => (
                <tr key={c.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: c.color }}>{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[#6B7480] hidden sm:table-cell text-xs">{c.address}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={`${explorer}${c.address}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#38B6FF] hover:text-[#2EE6D6] transition-colors">
                      View ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocCard>

      {/* Architecture */}
      <DocCard>
        <SectionTitle icon={Layers} color="#C8963C" label="Architecture" />
        <div className="rounded-xl p-5 mb-4 font-mono text-xs"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="space-y-2 text-[#9BA5B0]">
            <div><span className="text-[#38B6FF]">Write — Staking</span>{'     '}→ FeeProxy → MultiVault</div>
            <div><span className="text-[#38B6FF]">Write — Register</span>{'    '}→ MultiVault (direct)</div>
            <div><span className="text-[#2ECC71]">Read — Data</span>{'         '}→ Intuition GraphQL + MultiVault reads</div>
            <div><span className="text-[#2ECC71]">Read — Price</span>{'        '}→ MultiVault.getVault() on-chain</div>
            <div><span className="text-[#C8963C]">Redeem / Sell</span>{'       '}→ MultiVault (direct, no fee)</div>
          </div>
        </div>
        <p className="text-[#6B7480] text-xs leading-relaxed">
          All on-chain reads bypass GraphQL indexer lag by reading directly from the MultiVault contract.
          GraphQL (Hasura) is used for batch queries and historical data. Trust scores are always computed
          from current on-chain state.
        </p>
      </DocCard>

      {/* Network */}
      <DocCard>
        <SectionTitle icon={Globe} color="#38B6FF" label="Network Configuration" />
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Network', value: 'Intuition Testnet' },
            { label: 'Chain ID', value: '13579' },
            { label: 'RPC', value: 'testnet.rpc.intuition.systems/http' },
            { label: 'Token', value: 'tTRUST (testnet)' },
            { label: 'Explorer', value: 'testnet.explorer.intuition.systems' },
            { label: 'GraphQL', value: 'testnet.intuition.sh/v1/graphql' },
          ].map(n => (
            <div key={n.label} className="flex justify-between items-center px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs text-[#7A838D]">{n.label}</span>
              <span className="text-xs font-mono text-[#B5BDC6]">{n.value}</span>
            </div>
          ))}
        </div>
      </DocCard>

      {/* Open source */}
      <DocCard>
        <SectionTitle icon={GitBranch} color="#2ECC71" label="Open Source" />
        <div className="space-y-3">
          {[
            { label: 'AgentScore GitHub', url: 'https://github.com/Kryptoremontier/agentscore', color: '#C8963C' },
            { label: 'Intuition Protocol', url: 'https://intuition.systems', color: '#38B6FF' },
            { label: 'Intuition Docs', url: 'https://www.docs.intuition.systems/docs', color: '#2ECC71' },
          ].map(l => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5"
              style={{ background: `${l.color}08`, border: `1px solid ${l.color}20`, color: l.color }}>
              {l.label}
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          ))}
        </div>
      </DocCard>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState('overview')

  // URL hash support: /docs#evaluators
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (TABS.some(t => t.id === hash)) setActiveTab(hash)
  }, [])

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    window.history.replaceState(null, '', `/docs#${tabId}`)
  }

  return (
    <PageBackground image="wave" opacity={0.2}>
      <div className="pt-28 pb-20">
        <div className="container max-w-4xl">

          {/* Hero header */}
          <div className="mb-10">
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

          {/* Tab navigation */}
          <div className="mb-8 -mx-4 sm:mx-0">
            <div className="overflow-x-auto scrollbar-hide px-4 sm:px-0">
              <div className="flex gap-1 min-w-max sm:min-w-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {TABS.map(tab => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap relative"
                      style={{
                        color: isActive ? '#C8963C' : 'rgba(255,255,255,0.4)',
                        borderBottom: isActive ? '2px solid #C8963C' : '2px solid transparent',
                        marginBottom: '-1px',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)' }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)' }}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'overview'   && <TabOverview />}
          {activeTab === 'scoring'    && <TabScoring />}
          {activeTab === 'evaluators' && <TabEvaluators />}
          {activeTab === 'domains'    && <TabDomains />}
          {activeTab === 'fees'       && <TabFees />}
          {activeTab === 'contracts'  && <TabContracts />}

        </div>
      </div>
    </PageBackground>
  )
}
