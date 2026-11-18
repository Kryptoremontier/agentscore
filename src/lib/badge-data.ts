/**
 * The badge's read (Etap 9; the drawing is lib/badge.ts): the /check lookup, nothing else. Any id
 * the /check box takes that names exactly one agent. A failed read — the list, or who trusts this
 * agent — is `unknown`, never numbers.
 */

import { checkLookup } from './check-data'
import type { BadgeState } from './badge'

export async function badgeState(raw: string): Promise<BadgeState> {
  const { resolution, card } = await checkLookup(raw).catch(() => ({ resolution: { status: 'unread' as const }, card: null }))
  if (resolution.status === 'choose') return { kind: 'ambiguous' }
  if (resolution.status === 'not-found' || resolution.status === 'empty') return { kind: 'not-found' }
  if (resolution.status === 'unread' || !card || !card.attesters || !card.tier) return { kind: 'unknown' }
  return { kind: 'ok', tier: card.tier.tier, people: card.attesters.length, readAt: card.dataReadAt }
}
