/**
 * One badge for a README (Etap 9): `GET /badge/<id>.svg` →
 * "AgentScore · {tier label} · N people trust it · {age}". Pure: the route (app/badge/[id])
 * reads the /check card and this module only draws it.
 *
 * The age is the read's absolute time ("as of 2026-11-18 19:40 UTC"): the image is cached for 5
 * minutes and READMEs proxy it, so "3 min ago" would be wrong by the time anyone sees it — a
 * timestamp never is. A failed read is a grey "AgentScore · unknown": never the last numbers,
 * never a guess. An id that names no agent, or more than one, says so in grey as well.
 */

import type { AgentTier } from './agent-tier'
import { TIER_LABEL, peopleVouch } from './people-copy'

export type BadgeState =
  | { kind: 'ok'; tier: AgentTier; people: number; readAt: string }
  /** The read failed: we can't say anything about this agent right now. */
  | { kind: 'unknown' }
  | { kind: 'not-found' }
  | { kind: 'ambiguous' }

export const BADGE_BRAND = 'AgentScore'
export const BADGE_UNKNOWN = 'unknown'
export const BADGE_NOT_FOUND = 'not found'
export const BADGE_AMBIGUOUS = 'more than one agent'
/** The ok badge is cached for 5 minutes (the brief); a grey one for 1, so it recovers sooner. */
export const BADGE_CACHE_OK = 'public, max-age=300'
export const BADGE_CACHE_GREY = 'public, max-age=60'

const GREY = '#6b7280'
const TIER_COLOR: Record<AgentTier, string> = { verified: '#b45309', trusted: '#15803d', unverified: '#4b5563' }

/** "as of 2026-11-18 19:40 UTC" — the read's own time; '' when it isn't a time (then no age is claimed). */
export function badgeAge(readAt: string): string {
  const t = Date.parse(readAt)
  return Number.isFinite(t) ? `as of ${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''
}

/** The right-hand text; the left is always the brand. */
export function badgeMessage(state: BadgeState): string {
  if (state.kind === 'unknown') return BADGE_UNKNOWN
  if (state.kind === 'not-found') return BADGE_NOT_FOUND
  if (state.kind === 'ambiguous') return BADGE_AMBIGUOUS
  return [TIER_LABEL[state.tier], peopleVouch(state.people), badgeAge(state.readAt)].filter(Boolean).join(' · ')
}

/** The whole badge as words (the image's accessible name). */
export const badgeLabel = (state: BadgeState) => `${BADGE_BRAND} · ${badgeMessage(state)}`

/**
 * Text width at 11px Verdana, by character class — close enough to lay the two halves out; the
 * text itself carries `textLength`, so any font a viewer has is fitted to the box we drew.
 */
function textWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    if ("ijl.,:;'|!".includes(ch)) w += 3.6
    else if (' ·ftrI'.includes(ch)) w += 4.4
    else if ('mwMW'.includes(ch)) w += 10.2
    else if (ch >= 'A' && ch <= 'Z') w += 7.9
    else if (ch >= '0' && ch <= '9') w += 7
    else w += 6.6
  }
  return Math.ceil(w)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function badgeSvg(state: BadgeState): string {
  const message = badgeMessage(state)
  const color = state.kind === 'ok' ? TIER_COLOR[state.tier] : GREY
  const pad = 7
  const lw = textWidth(BADGE_BRAND)
  const mw = textWidth(message)
  const left = lw + pad * 2
  const right = mw + pad * 2
  const width = left + right
  const label = esc(badgeLabel(state))
  const text = (x: number, len: number, s: string) =>
    `<text x="${x}" y="14" textLength="${len}" lengthAdjust="spacingAndGlyphs">${esc(s)}</text>`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" role="img" aria-label="${label}" data-state="${state.kind}">`,
    `<title>${label}</title>`,
    `<clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath>`,
    `<g clip-path="url(#r)"><rect width="${left}" height="20" fill="#111318"/><rect x="${left}" width="${right}" height="20" fill="${color}"/></g>`,
    `<g fill="#fff" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    text(pad, lw, BADGE_BRAND),
    text(left + pad, mw, message),
    `</g></svg>`,
  ].join('')
}

/** `/badge/<id>.svg` — the id as it was asked for (a term id, `8453:1380`, a name). */
export const badgePath = (id: string) => `/badge/${encodeURIComponent(id)}.svg`

/** Copy-ready snippets: the badge, linking to the agent's /check card. */
export function badgeSnippets(siteUrl: string, id: string): { markdown: string; html: string } {
  const img = `${siteUrl}${badgePath(id)}`
  const href = `${siteUrl}/check/${id}`
  return {
    markdown: `[![AgentScore](${img})](${href})`,
    html: `<a href="${href}"><img src="${img}" alt="AgentScore" height="20"></a>`,
  }
}
