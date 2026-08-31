/**
 * Shared constants for AgentScore's machine-readable agent surface:
 * content negotiation on GET /api/v1/agents/:id/trust and the GET /llms.txt
 * manual both read from here so published docs can never drift from the
 * values actually enforced by the route handlers.
 */

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
