'use client'

/**
 * AgentRadar — pure-SVG spider/radar chart for per-skill trust scores.
 * Renders only when agent has 3+ skills. Uses top 6 if more.
 */

import type { SkillTrustScore } from '@/lib/skill-trust'

interface AgentRadarProps {
  skills: SkillTrustScore[]
}

const CX = 140
const CY = 130
const RADIUS = 90
const GOLD = '#C8963C'
const GRID_COLOR = 'rgba(255,255,255,0.07)'
const AXIS_COLOR = 'rgba(255,255,255,0.12)'
const GRID_RINGS = [0.33, 0.66, 1.0]
const GRID_LABELS = ['33', '66', '100']

function toRad(deg: number) { return (deg * Math.PI) / 180 }

/** Angle for axis i (N total). First axis points straight up. */
function axisAngle(i: number, n: number): number {
  return toRad((i * 360) / n - 90)
}

/** Point on an axis at fraction t (0 = center, 1 = full radius). */
function axisPoint(i: number, n: number, t = 1) {
  const a = axisAngle(i, n)
  return {
    x: CX + RADIUS * t * Math.cos(a),
    y: CY + RADIUS * t * Math.sin(a),
  }
}

/** SVG polygon points string from array of {x,y}. */
function pts(points: { x: number; y: number }[]) {
  return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/** Text anchor + offset for a label outside the polygon at angle a. */
function labelProps(x: number, y: number) {
  const dx = x - CX
  const dy = y - CY
  let textAnchor: 'start' | 'middle' | 'end' = 'middle'
  let offsetX = 0
  let offsetY = 0

  if (Math.abs(dx) < RADIUS * 0.25) {
    // top or bottom
    textAnchor = 'middle'
    offsetY = dy < 0 ? -10 : 14
  } else if (dx > 0) {
    textAnchor = 'start'
    offsetX = 10
    offsetY = dy > RADIUS * 0.35 ? 12 : dy < -RADIUS * 0.35 ? -4 : 4
  } else {
    textAnchor = 'end'
    offsetX = -10
    offsetY = dy > RADIUS * 0.35 ? 12 : dy < -RADIUS * 0.35 ? -4 : 4
  }

  return { textAnchor, x: x + offsetX, y: y + offsetY }
}

/** Truncate skill name to fit in radar label */
function shortName(name: string, maxLen = 12): string {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name
}

export function AgentRadar({ skills }: AgentRadarProps) {
  if (skills.length < 3) return null

  // Top 6 skills by score (already sorted desc from calculateSkillBreakdown)
  const displaySkills = skills.slice(0, 6)
  const n = displaySkills.length

  // Background grid polygons
  const gridPolygons = GRID_RINGS.map(t =>
    Array.from({ length: n }, (_, i) => axisPoint(i, n, t))
  )

  // Data polygon points
  const dataPoints = displaySkills.map((s, i) =>
    axisPoint(i, n, s.score / 100)
  )

  // Axis endpoints (for tick lines)
  const axisEndpoints = Array.from({ length: n }, (_, i) => axisPoint(i, n, 1))

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#171A1D', border: '1px solid rgba(200,150,60,0.12)' }}
    >
      <p className="text-[#B5BDC6] text-xs font-semibold uppercase tracking-wider mb-3">
        Skill Radar
      </p>

      <svg
        viewBox={`0 0 280 260`}
        className="w-full max-w-xs mx-auto block"
        aria-label="Agent skill radar chart"
      >
        {/* Grid polygons */}
        {gridPolygons.map((ringPts, ri) => (
          <polygon
            key={ri}
            points={pts(ringPts)}
            fill="none"
            stroke={GRID_COLOR}
            strokeWidth="1"
          />
        ))}

        {/* Grid ring labels (score values) */}
        {GRID_RINGS.map((t, ri) => (
          <text
            key={ri}
            x={CX + 3}
            y={CY - RADIUS * t + 3}
            fontSize="7"
            fill="rgba(255,255,255,0.2)"
            textAnchor="start"
          >
            {GRID_LABELS[ri]}
          </text>
        ))}

        {/* Axis lines */}
        {axisEndpoints.map((ep, i) => (
          <line
            key={i}
            x1={CX} y1={CY}
            x2={ep.x} y2={ep.y}
            stroke={AXIS_COLOR}
            strokeWidth="1"
          />
        ))}

        {/* Data polygon — filled */}
        <polygon
          points={pts(dataPoints)}
          fill={GOLD}
          fillOpacity={0.18}
          stroke={GOLD}
          strokeWidth="1.5"
          strokeOpacity={0.8}
          strokeLinejoin="round"
        />

        {/* Data dots at each vertex */}
        {dataPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill={GOLD}
            fillOpacity={0.9}
          />
        ))}

        {/* Skill labels */}
        {axisEndpoints.map((ep, i) => {
          const { textAnchor, x, y } = labelProps(ep.x, ep.y)
          const score = displaySkills[i].score
          return (
            <g key={i}>
              <text
                x={x}
                y={y}
                textAnchor={textAnchor}
                fontSize="9"
                fontWeight="500"
                fill="rgba(255,255,255,0.65)"
              >
                {shortName(displaySkills[i].skillName)}
              </text>
              <text
                x={x}
                y={y + 10}
                textAnchor={textAnchor}
                fontSize="8"
                fontWeight="700"
                fill={GOLD}
                fillOpacity={0.8}
              >
                {score.toFixed(0)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
