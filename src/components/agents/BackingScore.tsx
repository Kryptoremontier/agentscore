'use client'

/**
 * The backing score — the vault-based number (Etap 5b score decision A): one small, neutral
 * figure on every agent surface. Never green or gold, never next to a tier-sounding word; the
 * headline is who vouches. "—" when there is no measurement (lib/score-basis.ts rules: not read,
 * zero stake, oppose unread), with the reason as a native title — a Radix tooltip per card made
 * the list twice as slow to render.
 *
 * 'inline' = the card: "Backing 58". 'line' = the stat row's footer: "Backing score 58".
 * 'value' = the list row, under its "Backing" column header: "58".
 */

import { BACKING_LABEL, BACKING_SCORE, BACKING_SCORE_TIP } from '@/lib/people-copy'

export function BackingScore({ value, tip, variant = 'inline', className = '' }: {
  /** null = no measurement → "—". */
  value: number | null
  /** Why there is no number (value null); the score's meaning otherwise. */
  tip?: string
  variant?: 'inline' | 'line' | 'value'
  className?: string
}) {
  const label = variant === 'line' ? BACKING_SCORE : BACKING_LABEL
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 whitespace-nowrap cursor-help ${className}`}
      title={value == null ? (tip ?? BACKING_SCORE_TIP) : BACKING_SCORE_TIP}
      data-testid="backing-score"
    >
      {variant !== 'value' && <span className="text-[10px] uppercase tracking-wider text-[#7A838D]">{label}</span>}
      <span className="text-xs font-semibold tabular-nums text-[#B5BDC6]">{value == null ? '—' : Math.round(value)}</span>
    </span>
  )
}
