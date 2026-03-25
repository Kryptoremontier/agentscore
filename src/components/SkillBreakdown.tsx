'use client'

import Link from 'next/link'
import type { SkillTrustScore } from '@/lib/skill-trust'

interface SkillBreakdownProps {
  skills: SkillTrustScore[]
  overallScore: number
}

const TIER_COLOR: Record<string, string> = {
  excellent: '#34d399',   // emerald-400
  good:      '#C8963C',   // gold
  moderate:  '#eab308',   // yellow-500
  low:       '#f97316',   // orange-400
  critical:  '#ef4444',   // red-400
}

export function SkillBreakdown({ skills, overallScore }: SkillBreakdownProps) {
  if (skills.length === 0) return null

  return (
    <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">
          Skill Trust Breakdown
        </p>
        <span className="text-[#7A838D] text-[10px]">
          Avg&nbsp;<span className="text-white font-semibold">{overallScore.toFixed(1)}</span>
        </span>
      </div>
      <div className="border-b border-white/[0.06] mb-3" />

      {/* Skill rows */}
      <div className="space-y-1">
        {skills.map((skill) => {
          const bar = TIER_COLOR[skill.level] ?? TIER_COLOR.moderate
          const supportTrust = (Number(skill.supportShares) / 1e18).toFixed(3)
          const opposeTrust  = (Number(skill.opposeShares)  / 1e18).toFixed(3)

          return (
            <div
              key={skill.tripleId}
              className="group rounded-lg px-2 py-2 -mx-2 hover:bg-white/[0.03] transition-colors duration-150"
            >
              {/* Name / score / stakers */}
              <div className="flex items-center gap-2 mb-1.5">
                <Link
                  href={`/claims?open=${encodeURIComponent(skill.tripleId)}`}
                  className="text-[#C8C8D0] hover:text-[#2EE6D6] text-xs font-medium truncate flex-1 min-w-0 transition-colors underline-offset-2 hover:underline"
                  title={`View claim: ${skill.skillName}`}
                  onClick={e => e.stopPropagation()}
                >
                  {skill.skillName}
                </Link>
                <span
                  className="text-xs font-bold font-mono tabular-nums flex-shrink-0"
                  style={{ color: bar, minWidth: '26px', textAlign: 'right' }}
                >
                  {Math.round(skill.score)}
                </span>
                <span className="text-[#7A838D] text-[10px] flex-shrink-0 w-16 text-right">
                  {skill.stakerCount}&thinsp;staker{skill.stakerCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${skill.score}%`,
                    background: `linear-gradient(90deg, ${bar}55, ${bar})`,
                  }}
                />
              </div>

              {/* Hover: support / oppose */}
              <div className="hidden group-hover:flex justify-between text-[10px] mt-1.5">
                <span style={{ color: '#34d399' }}>
                  ↑ {supportTrust} tTRUST ({skill.supportRatio}%)
                </span>
                <span style={{ color: '#f87171' }}>
                  ↓ {opposeTrust} tTRUST ({100 - skill.supportRatio}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[#7A838D] text-[10px] mt-3 pt-2 border-t border-white/[0.04]">
        Per [Agent] [hasAgentSkill] [Skill] triple vault
      </p>
    </div>
  )
}
