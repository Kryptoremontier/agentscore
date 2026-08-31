/**
 * Shared constants for AgentScore's machine-readable agent surface:
 * content negotiation on GET /api/v1/agents/:id/trust, GET /llms.txt, and
 * GET /skill.md all read from here so published docs can never drift from
 * the values actually enforced by the route handlers.
 */

import type { AgentTrustBreakdown } from './api-data'

export const AGENT_SURFACE_VERSION = 'v1'

/**
 * Trust disclaimer shown in both the trust route's JSON/text output and
 * llms.txt. On-chain stake signals activity, not future good behavior.
 */
export const TRUST_DISCLAIMER =
  'Score reflects on-chain signals only; it proves activity patterns, never trustworthiness.'

export const TRUST_ROUTE_CACHE = {
  sMaxAgeSeconds: 60,
  staleWhileRevalidateSeconds: 300,
} as const

export const TRUST_ROUTE_CACHE_CONTROL =
  `public, s-maxage=${TRUST_ROUTE_CACHE.sMaxAgeSeconds}, stale-while-revalidate=${TRUST_ROUTE_CACHE.staleWhileRevalidateSeconds}`

/**
 * Flattens a nested object into "dot.path: value" lines, one field per line.
 * Shared by the trust route's text format and the llms.txt example so the
 * documented example is always rendered by the same code as the real thing.
 */
export function flattenLines(value: unknown, prefix: string, lines: string[]): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flattenLines(child, prefix ? `${prefix}.${key}` : key, lines)
    }
    return
  }
  lines.push(`${prefix}: ${Array.isArray(value) ? JSON.stringify(value) : value}`)
}

/** Renders a trust breakdown as compact plain text (the ?format=text / Accept: text/plain shape). */
export function renderTrustText(data: object): string {
  const lines: string[] = []
  flattenLines(data, '', lines)
  lines.push(`version: ${AGENT_SURFACE_VERSION}`)
  lines.push(`disclaimer: ${TRUST_DISCLAIMER}`)
  return lines.join('\n') + '\n'
}

/**
 * A real trust breakdown captured from testnet (agent "INTU:Talaria",
 * term_id below) — kept as a fixed snapshot so documented examples stay
 * stable. Rendered through renderTrustText()/JSON.stringify() by llms.txt
 * and SKILL.md, so their examples can never drift from what those functions
 * actually emit. The SKILL.md example text is asserted against this by
 * skill-md-route.test.ts — regenerate SKILL.md's example block if this
 * snapshot ever changes.
 */
export const EXAMPLE_TRUST_BREAKDOWN: AgentTrustBreakdown = {
  agentId: '0xac7682d94109547c0c03e8f9f76d67f785fab307b6096910235cb75ddb424c6a',
  agentName: 'INTU:Talaria',
  score: {
    objectType: 'agent',
    trustScore: 70,
    qualityScore: 50,
    objectScore: 62,
    tier: 'good',
    softGateActive: false,
    computedAt: '2026-08-31T17:53:59.563Z',
  },
  agentScore: 62,
  trustScore: { raw: 100, confidence: 0.39, anchored: 69.7, momentum: 0 },
  compositeScore: { total: 50, signalRatio: 100, stakerDiversity: 0, stability: 0, priceRetention: 100 },
  softGate: { supportRatio: 100, scaleFactor: 1, applied: false },
  antiManipulation: { diversityWeightedRatio: 100, whaleDetected: true, largestStakerShare: 1, evaluatorWeightsApplied: false },
  tier: { current: 'unverified', nextTier: 'sandbox', requirements: { stakers: '1/3', stake: '0.0500/0.1 tTRUST', ratio: '100%/0%', age: '129/0 days' } },
}
