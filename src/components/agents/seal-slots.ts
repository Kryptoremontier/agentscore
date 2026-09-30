/**
 * The three seal slots (Etap 6) — what components/agents/SealRow draws, as data. Verified takes
 * three people (lib/agent-tier.ts AGENT_TIER_LADDER), so there are always three slots: one filled
 * per distinct live person who vouches (lib/agent-profile.ts summarizeAttesters — the same read
 * as the people line), most tTRUST behind the vouch first; the rest open. More people than slots:
 * three filled and a count of the others.
 */

import type { AttesterSummary } from '@/lib/agent-profile'
import { AGENT_TIER_LADDER } from '@/lib/agent-tier'

export const SEAL_SLOTS = AGENT_TIER_LADDER.verified.minAttesters

export type SealSlots =
  | { state: 'loading' }
  /** The read failed: no slots — the surface's own unread line says so (REPO_MAP §7 rule 5). */
  | { state: 'unread' }
  | { state: 'ok'; filled: AttesterSummary[]; open: number; more: number; total: number }

/** `attesters`: undefined = not read yet, null = the read failed. */
export function sealSlots(attesters: readonly AttesterSummary[] | null | undefined): SealSlots {
  if (attesters === undefined) return { state: 'loading' }
  if (attesters === null) return { state: 'unread' }
  const ordered = [...attesters].sort((a, b) => (a.totalStake === b.totalStake ? 0 : a.totalStake > b.totalStake ? -1 : 1))
  const filled = ordered.slice(0, SEAL_SLOTS)
  return { state: 'ok', filled, open: SEAL_SLOTS - filled.length, more: ordered.length - filled.length, total: ordered.length }
}
