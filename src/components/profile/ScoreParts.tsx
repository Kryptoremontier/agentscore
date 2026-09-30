'use client'

/**
 * The backing score's parts, inside the collapsed Details on both agent surfaces (Etap 5b score
 * decision A): the Trust Score (= the backing score), Composite, Hybrid, the stake split, and — on the modal,
 * which reads the signals — the time-weighted ratio and the composite's four pillars. Plain,
 * neutral rows: no level words, no green/gold. "—" = not measured (lib/score-basis.ts rules).
 */

import { formatTTrust } from '@/lib/format'
import {
  SCORE_PARTS_HEADING, SCORE_PART_TRUST, SCORE_PART_COMPOSITE, SCORE_PART_HYBRID,
} from '@/lib/people-copy'
import { pluralize } from '@/lib/plural'

export interface ScorePartsView {
  trustScore: number | null
  composite: number | null
  hybrid: number | null
  /** wei; null = the vault wasn't read. */
  supportWei: bigint | null
  opposeWei: bigint | null
  /** Support share of the stake, %; null when there is no stake to split. */
  supportPct: number | null
  weighted?: { ratio: number; raw: number; fresh: number; total: number } | null
  pillars?: Array<{ label: string; value: number; weight: number }> | null
}

const n = (v: number | null, digits = 0) => (v == null ? '—' : v.toFixed(digits))

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#7A838D]">{label}</span>
      <span className="text-[#B5BDC6] font-mono tabular-nums text-right">{value}</span>
    </div>
  )
}

export function ScoreParts({ view }: { view: ScorePartsView }) {
  const { supportWei, opposeWei } = view
  const net = supportWei != null && opposeWei != null ? supportWei - opposeWei : null
  return (
    <div className="pt-3 border-t border-white/[0.06] space-y-2" data-testid="score-parts">
      <p className="text-[10px] uppercase tracking-wider text-[#7A838D]">{SCORE_PARTS_HEADING}</p>
      <Row label={SCORE_PART_TRUST} value={n(view.trustScore)} />
      <Row label={SCORE_PART_COMPOSITE} value={n(view.composite)} />
      <Row label={SCORE_PART_HYBRID} value={n(view.hybrid)} />
      <div className="h-px bg-white/[0.06]" />
      <Row label={`Support${view.supportPct != null ? ` (${view.supportPct.toFixed(1)}%)` : ''}`} value={supportWei != null ? formatTTrust(supportWei) : '—'} />
      <Row label="Oppose" value={opposeWei != null ? formatTTrust(opposeWei) : '—'} />
      <Row label="Net" value={net != null ? `${net >= 0n ? '+' : '−'}${formatTTrust(net >= 0n ? net : -net)}` : '—'} />
      {view.weighted && (
        <>
          <div className="h-px bg-white/[0.06]" />
          <Row label="Time-weighted support" value={`${view.weighted.ratio.toFixed(1)}%`} />
          <Row label="Raw support" value={`${view.weighted.raw.toFixed(1)}% · ${view.weighted.fresh} fresh / ${pluralize(view.weighted.total, 'signal')}`} />
        </>
      )}
      {view.pillars && view.pillars.length > 0 && (
        <>
          <div className="h-px bg-white/[0.06]" />
          {view.pillars.map((p) => <Row key={p.label} label={`${p.label} (${p.weight}%)`} value={String(Math.round(p.value))} />)}
        </>
      )}
    </div>
  )
}
