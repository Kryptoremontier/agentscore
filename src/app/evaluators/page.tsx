'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { Medal, Crown, Loader2, Target, Users, TrendingUp, Star } from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { EvaluatorBadge } from '@/components/shared/EvaluatorBadge'
import { cn } from '@/lib/cn'
import { fetchEvaluatorLeaderboard } from '@/lib/evaluator-data'
import { EVALUATOR_TIER_CONFIG, type EvaluatorProfile } from '@/lib/evaluator-score'

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-[#C8963C]" />
  if (rank === 2) return <Medal className="w-5 h-5 text-[#B0BEC5]" />
  if (rank === 3) return <Medal className="w-5 h-5 text-[#CD7F32]" />
  return <span className="text-[#7A838D] font-mono text-sm w-5 text-center">{rank}</span>
}

function AccuracyBar({ accuracy, tier }: { accuracy: number; tier: EvaluatorProfile['evaluatorTier'] }) {
  const cfg = EVALUATOR_TIER_CONFIG[tier]
  const pct = Math.round(accuracy * 100)
  return (
    <div className="w-full mt-1">
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', getBarColor(accuracy))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function getBarColor(accuracy: number): string {
  if (accuracy >= 0.8) return 'bg-emerald-500'
  if (accuracy >= 0.6) return 'bg-amber-500'
  if (accuracy >= 0.4) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getWeightColor(weight: number): string {
  if (weight >= 1.3) return 'text-emerald-400'
  if (weight >= 1.1) return 'text-amber-400'
  if (weight >= 1.0) return 'text-white/60'
  return 'text-red-400'
}

export default function EvaluatorsPage() {
  const { address } = useAccount()
  const [entries, setEntries] = useState<EvaluatorProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvaluatorLeaderboard()
      .then(setEntries)
      .catch(e => console.error('[EvaluatorsPage]', e))
      .finally(() => setLoading(false))
  }, [])

  const myEntry = address
    ? entries.find(e => e.address.toLowerCase() === address.toLowerCase())
    : undefined
  const myRank = myEntry ? entries.indexOf(myEntry) + 1 : 0

  return (
    <PageBackground image="wave" opacity={0.2}>
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.3)', color: '#C8963C' }}
            >
              <Target className="w-3.5 h-3.5" />
              ACCURACY-WEIGHTED STAKING
            </div>
            <h1 className="text-4xl font-bold mb-3">
              <span style={{ background: 'linear-gradient(135deg,#C8963C,#E8B84B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Evaluator Leaderboard
              </span>
            </h1>
            <p className="text-[#7A838D] max-w-xl mx-auto text-sm">
              Your track record as a staker becomes your reputation. Evaluators who
              consistently back agents that maintain trust earn higher staking weight.
            </p>
          </div>

          {/* My rank banner */}
          {address && myEntry && myRank > 0 && (
            <div
              className="mb-6 px-5 py-3 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.25)' }}
            >
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-[#C8963C]" />
                <span className="text-sm text-[#B5BDC6]">Your ranking</span>
                <EvaluatorBadge profile={myEntry} size="sm" />
              </div>
              <span className="font-bold text-[#C8963C]">
                #{myRank} of {entries.length}
              </span>
            </div>
          )}

          {address && !loading && !myEntry && (
            <div
              className="mb-6 px-5 py-3 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-[#7A838D]" />
                <span className="text-sm text-[#7A838D]">
                  Stake on agents to earn your evaluator rank
                </span>
              </div>
              <Link
                href="/agents"
                className="text-xs text-[#C8963C] hover:text-[#E8B84B] transition-colors"
              >
                Browse agents →
              </Link>
            </div>
          )}

          {/* Formula explanation */}
          <div
            className="mb-6 px-5 py-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs"
            style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div>
              <p className="text-[#C8963C] font-semibold mb-1">effectiveStake</p>
              <p className="text-[#7A838D]">amount × diversityWeight × evaluatorWeight</p>
            </div>
            <div>
              <p className="text-[#B5BDC6] font-semibold mb-1">Evaluator Weight</p>
              <p className="text-[#7A838D]">0.5x (bad) → 1.0x (neutral) → 1.5x (excellent)</p>
            </div>
            <div>
              <p className="text-[#B5BDC6] font-semibold mb-1">Good pick</p>
              <p className="text-[#7A838D]">Support high-trust agent OR oppose low-trust agent</p>
            </div>
          </div>

          {/* Table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}
          >
            {/* Header row */}
            <div className="grid grid-cols-[40px_1fr_100px_70px_60px] gap-3 px-5 py-3 text-[11px] font-medium text-[#7A838D] uppercase tracking-wider border-b border-white/5">
              <span>#</span>
              <span>Evaluator</span>
              <span className="text-right">Accuracy</span>
              <span className="text-right">Weight</span>
              <span className="text-right flex items-center justify-end gap-1">
                <Users className="w-3 h-3" />Picks
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-[#7A838D]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 opacity-40" />
                Computing evaluator scores…
              </div>
            ) : entries.length === 0 ? (
              <div className="py-20 text-center text-[#7A838D]">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
                No evaluator data found on testnet yet
              </div>
            ) : (
              entries.map((e, i) => {
                const rank = i + 1
                const isMe = address && e.address.toLowerCase() === address.toLowerCase()
                const cfg = EVALUATOR_TIER_CONFIG[e.evaluatorTier]
                const accuracyPct = Math.round(e.adjustedAccuracy * 100)

                return (
                  <div
                    key={e.address}
                    className={cn(
                      'grid grid-cols-[40px_1fr_100px_70px_60px] gap-3 px-5 py-4 border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]',
                      isMe && 'bg-[#C8963C]/[0.06]',
                      rank <= 3 && 'bg-white/[0.02]',
                    )}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      <RankBadge rank={rank} />
                    </div>

                    {/* Address + tier + bar */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-mono"
                          style={{
                            background: isMe ? 'rgba(200,150,60,0.2)' : 'rgba(255,255,255,0.06)',
                            color: isMe ? '#C8963C' : '#7A838D',
                          }}
                        >
                          {e.address.slice(2, 4).toUpperCase()}
                        </div>
                        <Link
                          href={`/profile/${e.address}`}
                          className={cn(
                            'font-mono text-sm truncate hover:underline',
                            isMe ? 'text-[#C8963C] font-semibold' : 'text-[#B5BDC6] hover:text-white',
                          )}
                        >
                          {shortAddr(e.address)}
                          {isMe && <span className="ml-1.5 text-[10px] font-sans font-normal opacity-60">you</span>}
                        </Link>
                        <span className="hidden sm:inline text-base">{cfg.icon}</span>
                      </div>
                      <AccuracyBar accuracy={e.adjustedAccuracy} tier={e.evaluatorTier} />
                      {e.streakCount > 2 && (
                        <p className="text-[10px] text-amber-400 mt-0.5">
                          🔥 {e.streakCount} streak
                          {e.bestPick && <span className="text-[#7A838D]"> · Best: {e.bestPick}</span>}
                        </p>
                      )}
                    </div>

                    {/* Accuracy */}
                    <div className="text-right self-center">
                      <span className={cn('text-sm font-semibold', cfg.color)}>{accuracyPct}%</span>
                      <p className="text-[10px] text-[#7A838D]">
                        {e.goodPicks}/{e.totalPositions}
                      </p>
                    </div>

                    {/* Weight */}
                    <div className="text-right self-center">
                      <span className={cn('text-sm font-semibold tabular-nums', getWeightColor(e.evaluatorWeight))}>
                        {e.evaluatorWeight.toFixed(2)}x
                      </span>
                    </div>

                    {/* Total picks */}
                    <div className="text-right self-center">
                      <span className="text-sm text-[#B5BDC6]">{e.totalPositions}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(EVALUATOR_TIER_CONFIG).map(([tier, cfg]) => (
              <div
                key={tier}
                className="px-3 py-2.5 rounded-xl text-center text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className={cn('font-medium mb-0.5', cfg.color)}>
                  {cfg.icon} {cfg.label}
                </p>
                <p className="text-[#7A838D] text-[10px] leading-tight">{cfg.description}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </PageBackground>
  )
}
