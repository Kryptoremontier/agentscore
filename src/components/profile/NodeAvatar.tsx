'use client'

/**
 * Knowledge-graph node avatar — SVG circle with orbital satellite dots
 * representing an entity's connections in the trust network.
 */

import { cn } from '@/lib/cn'

// Deterministic color palettes derived from entity name
const NODE_PALETTES = [
  { fill: '#C8963C', ring: 'rgba(200,150,60,0.50)',  glow: 'rgba(200,150,60,0.25)', sat: '#E8B84B' },
  { fill: '#2EE6D6', ring: 'rgba(46,230,214,0.45)',  glow: 'rgba(46,230,214,0.20)', sat: '#5EEEDE' },
  { fill: '#38B6FF', ring: 'rgba(56,182,255,0.45)',   glow: 'rgba(56,182,255,0.20)', sat: '#6DC8FF' },
  { fill: '#A78BFA', ring: 'rgba(167,139,250,0.45)',  glow: 'rgba(167,139,250,0.20)', sat: '#C4B5FD' },
  { fill: '#4ADE80', ring: 'rgba(74,222,128,0.45)',   glow: 'rgba(74,222,128,0.20)', sat: '#86EFAC' },
  { fill: '#FB923C', ring: 'rgba(251,146,60,0.45)',   glow: 'rgba(251,146,60,0.20)', sat: '#FDBA74' },
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function getPalette(label: string) {
  return NODE_PALETTES[hashStr(label) % NODE_PALETTES.length]
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Satellite positions on a ring (angles in radians)
const SAT_ANGLES = [
  -Math.PI / 4,          // top-right
  Math.PI * 3 / 4,       // bottom-left
  Math.PI / 4,           // bottom-right
  -Math.PI * 3 / 4,      // top-left
  0,                      // right
  Math.PI,                // left
]

interface NodeAvatarProps {
  label: string
  size?: 'sm' | 'md' | 'lg'
  /** Number of connections shown as satellite dots (0-6, default auto from stakers) */
  connections?: number
  className?: string
}

const SIZE_MAP = {
  sm: { box: 32, r: 10, satR: 2, orbit: 14, fontSize: 8, lineW: 0.6 },
  md: { box: 44, r: 14, satR: 2.5, orbit: 19, fontSize: 10, lineW: 0.7 },
  lg: { box: 56, r: 18, satR: 3, orbit: 24, fontSize: 13, lineW: 0.8 },
}

export function NodeAvatar({ label, size = 'md', connections = 3, className }: NodeAvatarProps) {
  const s = SIZE_MAP[size]
  const cx = s.box / 2
  const cy = s.box / 2
  const palette = getPalette(label)
  const initials = getInitials(label.replace(/^(?:Agent|Skill):(?:\w+:)?\s*/i, ''))
  const satCount = Math.min(connections, 6)
  const gradId = `ng-${hashStr(label) % 9999}`

  return (
    <div
      className={cn('shrink-0 relative', className)}
      style={{ width: s.box, height: s.box }}
    >
      <svg
        viewBox={`0 0 ${s.box} ${s.box}`}
        width={s.box}
        height={s.box}
        className="block"
      >
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={palette.fill} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.fill} stopOpacity="0.4" />
          </radialGradient>
          <filter id={`glow-${gradId}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Connection lines + satellite dots */}
        {SAT_ANGLES.slice(0, satCount).map((angle, i) => {
          const sx = cx + Math.cos(angle) * s.orbit
          const sy = cy + Math.sin(angle) * s.orbit
          return (
            <g key={i}>
              <line
                x1={cx} y1={cy} x2={sx} y2={sy}
                stroke={palette.ring}
                strokeWidth={s.lineW}
                strokeDasharray="2 2"
                opacity={0.5}
              />
              <circle
                cx={sx} cy={sy} r={s.satR}
                fill={palette.sat}
                opacity={0.7}
              />
            </g>
          )
        })}

        {/* Outer ring (glow) */}
        <circle
          cx={cx} cy={cy} r={s.r + 2}
          fill="none"
          stroke={palette.ring}
          strokeWidth={1}
          opacity={0.4}
        />

        {/* Main node */}
        <circle
          cx={cx} cy={cy} r={s.r}
          fill={`url(#${gradId})`}
          stroke={palette.fill}
          strokeWidth={1.2}
          filter={`url(#glow-${gradId})`}
        />

        {/* Initials text */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontWeight="700"
          fontSize={s.fontSize}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {initials}
        </text>
      </svg>
    </div>
  )
}

/**
 * Simpler variant — small colored dot-node without satellites.
 * For list views where space is tight.
 */
export function NodeDot({ label, size = 8 }: { label: string; size?: number }) {
  const palette = getPalette(label)
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: palette.fill,
        boxShadow: `0 0 6px ${palette.glow}`,
      }}
    />
  )
}
