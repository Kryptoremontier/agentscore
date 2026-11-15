/**
 * The 8 trust contexts (Etap 8b): the canonical domain buckets (lib/canonical-domains.ts) with a URL
 * slug each — `/domains?context=<slug>`. The label stays the on-chain atom's label; the slug is only
 * a URL form of it ("Knowledge / Productivity" → "knowledge-productivity").
 */

import { CANONICAL_DOMAINS_REGISTRY, type CanonicalDomainDef } from './canonical-domains'

export interface TrustContext extends CanonicalDomainDef {
  slug: string
}

export function contextSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export const TRUST_CONTEXTS: readonly TrustContext[] = CANONICAL_DOMAINS_REGISTRY.map((d) => ({ ...d, slug: contextSlug(d.label) }))

/** The context a slug names; null for anything else (an unknown slug is not a context). */
export function contextBySlug(slug: string | null | undefined): TrustContext | null {
  if (!slug) return null
  return TRUST_CONTEXTS.find((c) => c.slug === slug) ?? null
}

/** The context whose on-chain atom this is; null for any other object. */
export function contextByTermId(termId: string | null | undefined): TrustContext | null {
  if (!termId) return null
  const id = termId.toLowerCase()
  return TRUST_CONTEXTS.find((c) => c.termId.toLowerCase() === id) ?? null
}

/** `/domains?context=<slug>` — the ranked list for one context (the route stays /domains). */
export const contextHref = (c: Pick<TrustContext, 'slug'>) => `/domains?context=${c.slug}`
