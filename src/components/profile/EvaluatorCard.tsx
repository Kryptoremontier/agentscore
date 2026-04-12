'use client'

import { Shield, Eye, BookOpen, Sparkles, Crown, Flame, Loader2 } from 'lucide-react'
import { EVALUATOR_TIER_CONFIG, type EvaluatorProfile, type EvaluatorTier } from '@/lib/evaluator-score'
import { cn } from '@/lib/cn'

const TIER_ICONS: Record<EvaluatorTier, React.ElementType> = {
  newcomer: Shield,
  scout:    Eye,
  analyst:  BookOpen,
  oracle:   Sparkles,
  sage:     Crown,
}

interface EvaluatorCardProps {
  profile: EvaluatorProfile | null
  loading?: boolean
}

export function EvaluatorCard({ profile, loading }: EvaluatorCardProps) {
  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col gap-5 animate-pulse"
        style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}
      >
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="h-20 w-full rounded-xl bg-white/[0.04]" />
        <div className="h-32 w-full rounded-xl bg-white/[0.04]" />
      </div>
    )
  }

  if (!profile) return null

  const cfg = EVALUATOR_TIER_CONFIG[profile.evaluatorTier]
  const TierIcon = TIER_ICONS[profile.evaluatorTier]
  const accuracyPct = Math.round(profile.adjustedAccuracy * 100)
  const rawPct = Math.round(profile.rawAccuracy * 100)
  const weightColor = getWeightColor(profile.evaluatorWeight)

  const stats = [
    { label: 'Weight',    value: `${profile.evaluatorWeight.toFixed(2)}x`, color: weightColor },
    { label: 'Accuracy',  value: `${accuracyPct}%` },
    { label: 'Positions', value: String(profile.totalPositions) },
    { label: 'Correct',   value: String(profile.goodPicks) },
  ]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}
    >
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#7A838D]">
          Your Evaluator Profile
        </p>
      </div>

      {/* Tier + description */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.22)' }}
        >
          <TierIcon className={cn('w-5 h-5', cfg.color)} />
        </div>
        <div>
          <div className={cn('text-base font-bold', cfg.color)}>{cfg.label}</div>
          <p className="text-xs text-[#7A838D] mt-0.5">{cfg.description}</p>
        </div>
      </div>

      {/* Accuracy bar */}
      {profile.totalPositions > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#7A838D]">Accuracy</span>
            <span className={cn('text-xs font-semibold', cfg.color)}>{accuracyPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className={cn('h-full rounded-full transition-all duration-700', getBarColor(profile.adjustedAccuracy))}
              style={{ width: `${accuracyPct}%` }}
            />
          </div>
          {profile.streakCount > 1 && (
            <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {profile.goodPicks} correct · {profile.totalPositions} total
              <span className="text-[#C8963C] inline-flex items-center gap-0.5 ml-1">
                <Flame className="w-3 h-3" />{profile.streakCount} streak
              </span>
            </p>
          )}
        </div>
      )}

      {profile.totalPositions === 0 && (
        <p className="px-5 pb-4 text-xs text-[#7A838D]">
          Stake on agents to build your evaluator track record.
        </p>
      )}

      {/* Stat strip */}
      <div className="flex divide-x" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.06)' }}>
        {stats.map(s => (
          <div key={s.label} className="flex-1 text-center py-3 px-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className={cn('text-base font-bold font-mono tabular-nums leading-none', s.color ?? 'text-white')}>{s.value}</div>
            <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Extra stats if positions exist */}
      {profile.totalPositions > 0 && (profile.bestPick || profile.worstPick) && (
        <div className="px-5 py-3 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {profile.bestPick && <StatRow label="Best pick" value={profile.bestPick} truncate />}
          {profile.worstPick && profile.worstPick !== profile.bestPick && (
            <StatRow label="Worst pick" value={profile.worstPick} truncate />
          )}
          <StatRow label="Raw accuracy" value={`${rawPct}%`} />
          <StatRow label="Confidence" value={`${Math.round(profile.confidence * 100)}%`} />
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div
      className="px-3 py-2 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-[#7A838D] mb-0.5 text-[10px]">{label}</p>
      <p className={cn('text-[#B5BDC6] font-medium', truncate && 'truncate')}>{value}</p>
    </div>
  )
}

function getWeightColor(weight: number): string {
  if (weight >= 1.3) return 'text-[#2ECC71]'
  if (weight >= 1.1) return 'text-[#C8963C]'
  if (weight >= 1.0) return 'text-white/60'
  return 'text-red-400'
}

function getBarColor(accuracy: number): string {
  if (accuracy >= 0.8) return 'bg-[#2ECC71]'
  if (accuracy >= 0.6) return 'bg-[#C8963C]'
  if (accuracy >= 0.4) return 'bg-yellow-500'
  return 'bg-red-500'
}
