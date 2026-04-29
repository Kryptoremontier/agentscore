'use client'

import { useAccount } from 'wagmi'
import Link from 'next/link'
import {
  Target, TrendingUp, Crown, Shield,
  Flame, Eye, Sparkles, BookOpen, ChevronRight, Star, Lock, CheckCircle2,
} from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { EvaluatorBadge } from '@/components/shared/EvaluatorBadge'
import { cn } from '@/lib/cn'
import { EVALUATOR_TIER_CONFIG, type EvaluatorProfile, type EvaluatorTier } from '@/lib/evaluator-score'

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const TIER_ICONS: Record<EvaluatorTier, React.ElementType> = {
  newcomer: Shield,
  scout:    Eye,
  analyst:  BookOpen,
  oracle:   Sparkles,
  sage:     Crown,
}

const TIER_HEX: Record<EvaluatorTier, string> = {
  newcomer: '#7A838D',
  scout:    '#38B6FF',
  analyst:  '#A78BFA',
  oracle:   '#C8963C',
  sage:     '#2ECC71',
}

function TierIcon({ tier, size = 14 }: { tier: EvaluatorTier; size?: number }) {
  const Icon = TIER_ICONS[tier]
  return <Icon style={{ width: size, height: size, color: TIER_HEX[tier] }} />
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(200,150,60,0.18)', border: '1px solid rgba(200,150,60,0.5)', boxShadow: '0 0 10px rgba(200,150,60,0.3)' }}>
      <Crown className="w-3.5 h-3.5" style={{ color: '#C8963C' }} />
    </div>
  )
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(176,190,197,0.12)', border: '1px solid rgba(176,190,197,0.35)' }}>
      <Crown className="w-3.5 h-3.5 text-[#B0BEC5]" />
    </div>
  )
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(205,127,50,0.12)', border: '1px solid rgba(205,127,50,0.35)' }}>
      <Crown className="w-3.5 h-3.5 text-[#CD7F32]" />
    </div>
  )
  return (
    <div className="w-7 h-7 flex items-center justify-center">
      <span className="text-[#7A838D] font-mono text-sm">{rank}</span>
    </div>
  )
}

function AccuracyBar({ accuracy }: { accuracy: number }) {
  const pct = Math.round(accuracy * 100)
  const color = accuracy >= 0.8 ? '#2ECC71'
    : accuracy >= 0.6 ? '#C8963C'
    : accuracy >= 0.4 ? '#EAB308'
    : '#EF4444'
  return (
    <div className="w-full h-1 rounded-full mt-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }}
      />
    </div>
  )
}

function getWeightColor(weight: number): string {
  if (weight >= 1.3) return '#2ECC71'
  if (weight >= 1.1) return '#C8963C'
  if (weight >= 1.0) return '#B5BDC6'
  return '#EF4444'
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 0.8) return '#2ECC71'
  if (accuracy >= 0.6) return '#C8963C'
  if (accuracy >= 0.4) return '#EAB308'
  return '#EF4444'
}

export function EvaluatorsClient({ initialData }: { initialData: EvaluatorProfile[] }) {
  const { address } = useAccount()

  const myEntry = address
    ? initialData.find(e => e.address.toLowerCase() === address.toLowerCase())
    : undefined
  const myRank = myEntry ? initialData.indexOf(myEntry) + 1 : 0

  return (
    <PageBackground image="wave" opacity={0.2}>
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5"
              style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.3)', color: '#C8963C' }}>
              <Target className="w-3.5 h-3.5" />
              ACCURACY-WEIGHTED STAKING
            </div>

            <h1 className="text-4xl font-bold mb-3">
              <span style={{ background: 'linear-gradient(135deg,#C8963C,#E8B84B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Evaluator Leaderboard
              </span>
            </h1>
            <p className="text-[#7A838D] max-w-xl mx-auto text-sm leading-relaxed">
              Your track record as a staker becomes your reputation. Evaluators who
              consistently back agents that maintain trust earn higher staking weight.
            </p>
          </div>

          {/* ── My rank banner ───────────────────────────────────────────── */}
          {address && myEntry && myRank > 0 && (
            <div className="mb-5 px-5 py-3.5 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.25)' }}>
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-[#C8963C]" />
                <span className="text-sm text-[#B5BDC6]">Your ranking</span>
                <EvaluatorBadge profile={myEntry} size="sm" />
              </div>
              <span className="font-bold text-[#C8963C]">#{myRank} of {initialData.length}</span>
            </div>
          )}

          {address && !myEntry && (
            <div className="mb-5 px-5 py-3.5 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-[#7A838D]" />
                <span className="text-sm text-[#7A838D]">Stake on agents to earn your evaluator rank</span>
              </div>
              <Link href="/agents" className="flex items-center gap-1 text-xs text-[#C8963C] hover:text-[#E8B84B] transition-colors">
                Browse agents <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* ── Formula cards ────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: TrendingUp,
                color: '#C8963C',
                rgb: '200,150,60',
                title: 'effectiveStake',
                desc: 'amount × diversityWeight × evaluatorWeight',
              },
              {
                icon: Target,
                color: '#2EE6D6',
                rgb: '46,230,214',
                title: 'Evaluator Weight',
                desc: '0.5× (bad) → 1.0× (neutral) → 1.5× (excellent)',
              },
              {
                icon: Flame,
                color: '#2ECC71',
                rgb: '46,204,113',
                title: 'Good Pick',
                desc: 'Support high-trust agent OR oppose low-trust agent',
              },
            ].map(item => (
              <div key={item.title} className="px-4 py-3.5 rounded-xl flex items-start gap-3"
                style={{ background: `rgba(${item.rgb},0.06)`, border: `1px solid rgba(${item.rgb},0.18)` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `rgba(${item.rgb},0.12)`, border: `1px solid rgba(${item.rgb},0.25)` }}>
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: item.color }}>{item.title}</p>
                  <p className="text-[11px] text-[#7A838D] leading-snug">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Table ────────────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,15,17,0.9)', border: '1px solid rgba(200,150,60,0.15)' }}>

            {/* Header */}
            <div className="grid grid-cols-[44px_1fr_90px_68px_68px_44px_44px] gap-2 px-5 py-3 border-b border-white/5"
              style={{ background: 'rgba(200,150,60,0.04)' }}>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest text-center">#</span>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest">Evaluator</span>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest text-right">Accuracy</span>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest text-right">Weight</span>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest text-right" title="Realized + unrealized P&L on evaluator positions">P&L</span>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest text-center" title="Attestation Gate — verified by distinct wallets">Attested</span>
              <span className="text-[10px] font-semibold text-[#7A838D] uppercase tracking-widest text-right">Picks</span>
            </div>

            {initialData.length === 0 ? (
              <div className="py-20 text-center text-[#7A838D]">
                <Target className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No evaluator data found on testnet yet</p>
              </div>
            ) : initialData.map((e, i) => {
              const rank = i + 1
              const isMe = address && e.address.toLowerCase() === address.toLowerCase()
              const accuracyPct = Math.round(e.adjustedAccuracy * 100)
              const tierHex = TIER_HEX[e.evaluatorTier]
              const wColor = getWeightColor(e.evaluatorWeight)
              const aColor = getAccuracyColor(e.adjustedAccuracy)
              const isTop3 = rank <= 3
              const initials = e.address.slice(2, 4).toUpperCase()
              const isGated = e.rawEvaluatorWeight > 1.0 && e.meetsAttestationThreshold === false
              const attestationChecked = e.meetsAttestationThreshold !== null && e.meetsAttestationThreshold !== undefined

              return (
                <div
                  key={e.address}
                  className={cn(
                    'grid grid-cols-[44px_1fr_90px_68px_68px_44px_44px] gap-2 px-5 py-3.5 border-b border-white/[0.04] transition-all',
                    isMe
                      ? 'bg-[#C8963C]/[0.06] hover:bg-[#C8963C]/[0.09]'
                      : isTop3
                        ? 'bg-white/[0.015] hover:bg-white/[0.03]'
                        : 'hover:bg-white/[0.025]',
                  )}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center">
                    <RankBadge rank={rank} />
                  </div>

                  {/* Identity */}
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold font-mono"
                        style={{
                          background: isMe ? 'rgba(200,150,60,0.22)' : `${tierHex}14`,
                          border: `1px solid ${isMe ? 'rgba(200,150,60,0.4)' : `${tierHex}30`}`,
                          color: isMe ? '#C8963C' : tierHex,
                        }}>
                        {initials}
                      </div>

                      <Link
                        href={`/profile/${e.address}`}
                        className={cn(
                          'font-mono text-sm truncate hover:underline underline-offset-2 transition-colors',
                          isMe ? 'text-[#C8963C] font-semibold' : 'text-[#B5BDC6] hover:text-white',
                        )}
                      >
                        {shortAddr(e.address)}
                      </Link>

                      {isMe && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(200,150,60,0.15)', color: '#C8963C', border: '1px solid rgba(200,150,60,0.3)' }}>
                          you
                        </span>
                      )}

                      <TierIcon tier={e.evaluatorTier} size={12} />

                      {e.streakCount > 2 && (
                        <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium"
                          style={{ color: '#C8963C' }}>
                          <Flame className="w-2.5 h-2.5" />
                          {e.streakCount}
                        </span>
                      )}
                    </div>

                    <AccuracyBar accuracy={e.adjustedAccuracy} />
                  </div>

                  {/* Accuracy */}
                  <div className="text-right flex flex-col items-end justify-center">
                    <span className="text-sm font-bold tabular-nums" style={{ color: aColor }}>
                      {accuracyPct}%
                    </span>
                    <span className="text-[10px] text-[#7A838D]">
                      {e.goodPicks}/{e.totalPositions}
                    </span>
                  </div>

                  {/* Weight */}
                  <div className="text-right flex items-center justify-end gap-1">
                    <span
                      className={cn('text-sm font-bold tabular-nums', isGated && 'line-through text-xs')}
                      style={{ color: isGated ? '#7A838D' : wColor }}
                    >
                      {e.evaluatorWeight.toFixed(2)}×
                    </span>
                  </div>

                  {/* P&L */}
                  <div className="text-right flex items-center justify-end">
                    {e.walletPNL && e.walletPNL.totalCostBasis > 0 ? (
                      <span
                        className="text-xs font-bold tabular-nums"
                        style={{ color: e.walletPNL.pnlPercent >= 0 ? '#2ECC71' : '#EF4444' }}
                        title={`Unrealized: ${e.walletPNL.totalUnrealized >= 0 ? '+' : ''}${e.walletPNL.totalUnrealized.toFixed(3)} tTRUST · Realized: ${e.walletPNL.totalRealized.toFixed(3)} tTRUST`}
                      >
                        {e.walletPNL.pnlPercent >= 0 ? '+' : ''}{e.walletPNL.pnlPercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-[#7A838D]">—</span>
                    )}
                  </div>

                  {/* Attested */}
                  <div className="flex items-center justify-center">
                    {!attestationChecked ? (
                      <span className="text-[10px] text-[#7A838D]">—</span>
                    ) : isGated ? (
                      <span
                        title={`Weight capped at 1.0x — needs attestation from ${1} distinct wallet to unlock ${e.rawEvaluatorWeight.toFixed(2)}x`}
                        className="inline-flex items-center gap-0.5"
                      >
                        <Lock className="w-3 h-3 text-[#7A838D]" />
                        <span className="text-[10px] text-[#7A838D]">{e.attestationCount}/1</span>
                      </span>
                    ) : e.meetsAttestationThreshold ? (
                      <span
                        title={`Attested by ${e.attestationCount} distinct wallet(s)`}
                        className="inline-flex items-center gap-0.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-[#2ECC71]" />
                        <span className="text-[10px] text-[#2ECC71]">{e.attestationCount}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#7A838D]" title="No amplification needed at this weight">✓</span>
                    )}
                  </div>

                  {/* Picks */}
                  <div className="text-right flex items-center justify-end">
                    <span className="text-sm text-[#B5BDC6] tabular-nums">{e.totalPositions}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tier legend ──────────────────────────────────────────────── */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.entries(EVALUATOR_TIER_CONFIG) as [EvaluatorTier, typeof EVALUATOR_TIER_CONFIG[EvaluatorTier]][]).map(([tier, cfg]) => {
              const hex = TIER_HEX[tier]
              return (
                <div key={tier} className="px-3 py-3 rounded-xl text-center"
                  style={{ background: `${hex}0D`, border: `1px solid ${hex}2E` }}>
                  <div className="flex items-center justify-center mb-1.5">
                    <TierIcon tier={tier} size={16} />
                  </div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: hex }}>{cfg.label}</p>
                  <p className="text-[10px] text-[#7A838D] leading-tight">{cfg.description}</p>
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </PageBackground>
  )
}
