'use client'

/**
 * Mini trust sparkline — pure SVG, no external chart library.
 * Shows last N datapoints as a simple line, no axes, no labels.
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
  if (datapoints.length < 2) return null

  const min = Math.min(...datapoints)
  const max = Math.max(...datapoints)
  const range = max - min || 1
  const pad = 2 // px padding top/bottom

  const points = datapoints
    .map((val, i) => {
      const x = (i / (datapoints.length - 1)) * width
      const y = pad + (height - pad * 2) - ((val - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      className="inline-block opacity-70"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
