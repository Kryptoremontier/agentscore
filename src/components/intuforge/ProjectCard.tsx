'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Minus, Crown, Shield, Award } from 'lucide-react'
import { TrustSparkline } from '@/components/TrustSparkline'
import { CategoryPill } from './CategoryPill'
import { ForgeStakeButtons } from './ForgeStakeButtons'
import { PROJECT_STAGE_DOT_COLORS } from '@/lib/forge/constants'
import { PROJECT_STAGE_LABELS } from '@/lib/forge/types'
import type { ForgeProject } from '@/lib/forge/types'

function scoreColor(score: number): string {
  if (score >= 80) return '#C8963C'
  if (score >= 60) return '#2EE6D6'
  if (score >= 40) return '#A78BFA'
  if (score >= 20) return '#F59E0B'
  return '#EF4444'
}

const RANK_STYLES = {
  1: { icon: Crown,  color: '#C8963C', bg: 'rgba(200,150,60,0.12)',  border: 'rgba(200,150,60,0.28)',  glow: '0 0 16px rgba(200,150,60,0.12)' },
  2: { icon: Shield, color: '#B5BDC6', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', glow: '' },
  3: { icon: Award,  color: '#9C7A5B', bg: 'rgba(156,122,91,0.10)',  border: 'rgba(156,122,91,0.22)',  glow: '' },
}

function MomentumIcon({ momentum }: { momentum: string }) {
  if (momentum === 'up')   return <TrendingUp   className="w-3 h-3" style={{ color: '#2ECC71' }} />
  if (momentum === 'down') return <TrendingDown className="w-3 h-3" style={{ color: '#EF4444' }} />
  return <Minus className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
}

interface ProjectCardProps {
  project: ForgeProject
  rank?: number
}

export function ProjectCard({ project, rank }: ProjectCardProps) {
  const router = useRouter()
  const [activeSide, setActiveSide] = useState<'support' | 'oppose' | null>(null)

  const rankStyle = rank ? RANK_STYLES[rank as keyof typeof RANK_STYLES] : null
  const color = scoreColor(project.finalScore)
  const stageColor = PROJECT_STAGE_DOT_COLORS[project.stage]
  const isRealProject = project.id.startsWith('0x')

  function handleCardClick() {
    if (activeSide) return // don't navigate when staking panel is open
    router.push(`/explore/intuforge/${project.id}`)
  }

  function openStake(side: 'support' | 'oppose', e: React.MouseEvent) {
    e.stopPropagation()
    setActiveSide(side)
  }

  function onStakeClose() {
    setActiveSide(null)
    // Small delay so ForgeStakeButtons can unmount cleanly before server re-fetch
    setTimeout(() => router.refresh(), 150)
  }

  return (
    <div
      onClick={handleCardClick}
      className="relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer transition-all duration-150 hover:scale-[1.01]"
      style={{
        background: 'rgba(15,17,19,0.85)',
        border: `1px solid ${rankStyle ? rankStyle.border : 'rgba(255,255,255,0.08)'}`,
        boxShadow: rankStyle?.glow || undefined,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(15,17,19,0.85)')}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {rankStyle && (() => {
            const RankIcon = rankStyle.icon
            return (
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: rankStyle.bg, border: `1px solid ${rankStyle.border}` }}
              >
                <RankIcon className="w-3 h-3" style={{ color: rankStyle.color }} />
              </span>
            )
          })()}
          <CategoryPill category={project.category} size="sm" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor }} />
          <span className="text-xs font-medium" style={{ color: stageColor }}>
            {PROJECT_STAGE_LABELS[project.stage]}
          </span>
        </div>
      </div>

      {/* Name + tagline */}
      <div>
        <h3 className="font-semibold text-white leading-tight">{project.name}</h3>
        <p className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">
          {project.tagline}
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.05]" />

      {/* Trust score + sparkline */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums" style={{ color }}>
            {project.finalScore}
          </span>
          <MomentumIcon momentum={project.momentum} />
        </div>
        {project.sparklineData.length >= 2 && (
          <TrustSparkline datapoints={project.sparklineData} color={color} width={72} height={22} />
        )}
      </div>

      {/* Score bar */}
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${project.finalScore}%`, background: color }}
        />
      </div>

      {/* Stakers */}
      <div className="flex items-center justify-between text-xs text-white/30">
        <span>{project.stakerCount} stakers · {project.totalStaked.toFixed(2)} tTRUST</span>
      </div>

      {/* Profile Completeness */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/20 uppercase tracking-wide">Profile</span>
          <span className="text-[10px] text-white/30 font-mono">{project.completeness}%</span>
        </div>
        <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${project.completeness}%`, background: 'rgba(200,150,60,0.4)' }}
          />
        </div>
      </div>

      {/* Bottom actions */}
      <div onClick={e => e.stopPropagation()}>
        {activeSide && isRealProject ? (
          /* Inline staking panel */
          <ForgeStakeButtons
            atomId={project.atomId}
            counterTermId={project.counterTermId}
            projectName={project.name}
            initialSide={activeSide}
            onClose={onStakeClose}
            onStakeSuccess={() => router.refresh()}
          />
        ) : (
          /* Support / Oppose buttons */
          isRealProject ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={e => openStake('support', e)}
                className="py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-1"
                style={{ background: 'rgba(46,230,214,0.07)', border: '1px solid rgba(46,230,214,0.18)', color: '#2EE6D6' }}
              >
                <TrendingUp className="w-3 h-3" />
                Support
              </button>
              <button
                onClick={e => openStake('oppose', e)}
                className="py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-1"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.14)', color: 'rgba(239,68,68,0.65)' }}
              >
                <TrendingDown className="w-3 h-3" />
                Oppose
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); router.push(`/explore/intuforge/${project.id}`) }}
              className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'rgba(200,150,60,0.08)',
                border: '1px solid rgba(200,150,60,0.18)',
                color: '#C8963C',
              }}
            >
              View Project →
            </button>
          )
        )}
      </div>
    </div>
  )
}
