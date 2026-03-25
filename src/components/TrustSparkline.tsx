'use client'

import { useId } from 'react'

/**
 * Mini trust sparkline — pure SVG, no external chart library.
 * Gradient stroke (fades left→right) + filled dot on last point.
 */
export function TrustSparkline({
  datapoints,
  color = '#9ca3af',
  width = 72,
  height = 22,
}: {
  datapoints: number[]
  color?: string
  width?: number
  height?: number
}) {
  const uid = useId()
  const gradId = `spk-${uid.replace(/:/g, '')}`

  if (datapoints.length < 2) return null

  const min = Math.min(...datapoints)
  const max = Math.max(...datapoints)
  const range = max - min || 1
  const pad = 3

  const pts = datapoints.map((val, i) => ({
    x: (i / (datapoints.length - 1)) * width,
    y: pad + (height - pad * 2) - ((val - min) / range) * (height - pad * 2),
  }))

  const pointsStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} className="inline-block" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.1" />
          <stop offset="60%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline
        points={pointsStr}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x.toFixed(1)}
        cy={last.y.toFixed(1)}
        r="2.5"
        fill={color}
      />
    </svg>
  )
}
