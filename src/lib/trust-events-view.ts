/**
 * Trust over time — what a screen draws from the trust events (Etap 8b; the reads are
 * lib/trust-events.ts). Pure, with no server imports, so the card renders anywhere.
 */

export interface TrustEvent {
  /** The wallet that trusts the agent (checksummed, as the indexer returns it). */
  wallet: string
  /** The indexer's account label when it is an ENS name; null otherwise. */
  ens: string | null
  /** The trust context (canonical bucket label). */
  context: string
  /** When this wallet first trusted the agent for this context (the position's created_at). */
  at: string
  /** The `is skilled in` triple — the vault holding the position. */
  tripleId: string
}

/** Fewer events than this and no curve is drawn: never a line through 2 points. */
export const MIN_CHART_EVENTS = 3

export interface FirstTrust { wallet: string; tripleId: string; at: string }

/** Oldest first; ties by wallet then context, so the order never changes between reads. */
export function sortEvents(events: readonly TrustEvent[]): TrustEvent[] {
  return [...events].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1
      : a.wallet.toLowerCase() < b.wallet.toLowerCase() ? -1 : a.wallet.toLowerCase() > b.wallet.toLowerCase() ? 1
      : a.context < b.context ? -1 : a.context > b.context ? 1 : 0)
}

/** Is this event the first trust in AgentScore's history? Only when the data says so. */
export function isFirstTrust(event: TrustEvent, first: FirstTrust | null): boolean {
  return !!first
    && first.wallet.toLowerCase() === event.wallet.toLowerCase()
    && first.tripleId.toLowerCase() === event.tripleId.toLowerCase()
    && first.at === event.at
}

// ─── The curve ───────────────────────────────────────────────────────────────

/** The running count of trust events: one step per event, oldest first. */
export function trustSteps(events: readonly TrustEvent[]): Array<{ at: string; count: number }> {
  return sortEvents(events).map((e, i) => ({ at: e.at, count: i + 1 }))
}

export const shouldDrawCurve = (events: readonly unknown[]) => events.length >= MIN_CHART_EVENTS

export interface CurveGeometry {
  /** The step line, from the first event to `now`. */
  line: string
  /** The same, closed down to the baseline (the area under it). */
  area: string
  /** One dot per event, where its step begins. */
  dots: Array<{ x: number; y: number; count: number }>
  /** The y of the highest count — its one label (a value the curve reaches). */
  topY: number
  top: number
  /** The x of the first event and of `now`. */
  startX: number
  endX: number
}

/**
 * The running count as a step curve inside a `width` × `height` box with `pad` around it: time on x
 * (first event → `now`), count on y (0 → total). Steps, not slopes: between two events nothing
 * changed. Never drawn below MIN_CHART_EVENTS (the caller checks shouldDrawCurve).
 */
export function curveGeometry(events: readonly TrustEvent[], now: string, width: number, height: number, pad = { top: 12, right: 8, bottom: 8, left: 8 }): CurveGeometry {
  const steps = trustSteps(events)
  const t0 = Date.parse(steps[0].at)
  const t1 = Math.max(Date.parse(now), Date.parse(steps[steps.length - 1].at), t0 + 1)
  const top = steps.length
  const x = (t: number) => pad.left + ((t - t0) / (t1 - t0)) * (width - pad.left - pad.right)
  const y = (c: number) => height - pad.bottom - (c / top) * (height - pad.top - pad.bottom)
  const r = (n: number) => Math.round(n * 10) / 10
  const base = r(y(0))
  let d = `M ${r(x(t0))} ${base}`
  const dots: CurveGeometry['dots'] = []
  for (const s of steps) {
    const sx = r(x(Date.parse(s.at)))
    const sy = r(y(s.count))
    d += ` H ${sx} V ${sy}`
    dots.push({ x: sx, y: sy, count: s.count })
  }
  const endX = r(x(t1))
  d += ` H ${endX}`
  return { line: d, area: `${d} V ${base} Z`, dots, topY: r(y(top)), top, startX: r(x(t0)), endX }
}

/** "Jul 11, 2026" — the date of an event, in UTC (the same day wherever it is read). */
export function eventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
