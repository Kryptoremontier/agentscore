'use client'

import type { SkillTrustScore } from '@/lib/skill-trust'

interface SkillBreakdownProps {
  skills: SkillTrustScore[]
  overallScore: number
}

const LEVEL_COLORS: Record<string, { bar: string; text: string }> = {
  excellent: { bar: '#2ECC71', text: '#2ECC71' },
  good:      { bar: '#22c55e', text: '#22c55e' },
  moderate:  { bar: '#eab308', text: '#eab308' },
  low:       { bar: '#f97316', text: '#f97316' },
  critical:  { bar: '#ef4444', text: '#ef4444' },
}

export function SkillBreakdown({ skills, overallScore }: SkillBreakdownProps) {
  if (skills.length === 0) return null

  return (
    <div className="bg-[#171A1D] border border-[#C8963C]/12 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider">
          Skill Trust Breakdown
        </p>
        <span className="text-[#7A838D] text-[10px]">
          Weighted avg: <span className="text-white font-semibold">{overallScore.toFixed(1)}</span>
        </span>
      </div>

      <div className="space-y-2.5">
        {skills.map((skill) => {
          const colors = LEVEL_COLORS[skill.level] || LEVEL_COLORS.moderate
          const supportTtrust = (Number(skill.supportShares) / 1e18).toFixed(3)
          const opposeTtrust = (Number(skill.opposeShares) / 1e18).toFixed(3)

          return (
            <div key={skill.tripleId} className="group">
              <div className="flex items-center gap-2 mb-1">
                {/* Skill name */}
                <span
                  className="text-[#B5BDC6] text-xs truncate flex-1 min-w-0"
                  title={skill.skillName}
                >
                  {skill.skillName}
                </span>

                {/* Score */}
                <span
                  className="text-xs font-bold font-mono tabular-nums flex-shrink-0"
                  style={{ color: colors.text, minWidth: '28px', textAlign: 'right' }}
                >
                  {Math.round(skill.score)}
                </span>

                {/* Staker count */}
                <span className="text-[#7A838D] text-[10px] flex-shrink-0 w-16 text-right">
                  {skill.stakerCount} staker{skill.stakerCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-[#1E2229] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${skill.score}%`,
                    background: `linear-gradient(90deg, ${colors.bar}80, ${colors.bar})`,
                  }}
                />
              </div>

              {/* Expanded details on hover */}
              <div className="hidden group-hover:flex justify-between text-[10px] text-[#7A838D] mt-1">
                <span style={{ color: '#34a872' }}>
                  ↑ {supportTtrust} tTRUST ({skill.supportRatio}%)
                </span>
                <span style={{ color: '#c45454' }}>
                  ↓ {opposeTtrust} tTRUST ({100 - skill.supportRatio}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[#7A838D] text-[10px] mt-3 pt-2 border-t border-[#C8963C]/10">
        Score per [Agent] [hasAgentSkill] [Skill] triple vault
      </p>
    </div>
  )
}
