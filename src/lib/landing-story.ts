/**
 * The landing's story (Etap 8b), derived from what /agents already reads (lib/agents-page-data.ts):
 * no new source of truth. Pure functions, so every choice the page makes is testable.
 *
 * - People: distinct live wallets that trust an agent (lib/agent-profile.ts summarizeAttesters — the
 *   tier's own count).
 * - Per trust context: the agents people trust for it, ranked by distinct people first, then the
 *   existing chain (lib/attestation-reader.ts: the attestation score — its stake points — then the
 *   name), and the distinct people across them.
 * - The story agent: the most distinct people; a tie goes to the agent with the oldest trust event.
 */

import { summarizeAttesters } from './agent-profile'
import type { AttestedEntry } from './attestation-reader'
import type { AgentsPageView } from './agents-page-types'
import { effectiveLabel } from './api-data'
import { cleanAtomName } from '@/types/claim'
import { TRUST_CONTEXTS, type TrustContext } from './trust-contexts'

export interface RankedAgent {
  id: string
  name: string
  /** Distinct live wallets trusting it for this context. */
  people: number
  stakeWei: bigint
  /** The attestation score (lib/attestation-reader.ts): distinct people first, then stake points. */
  score: number
}

export interface ContextSummary {
  context: TrustContext
  /** Distinct live wallets trusting any agent for this context. */
  people: number
  agents: RankedAgent[]
  stakeWei: bigint
}

/** The agents the list shows (post-junk corpus + the ERC-8004 cohort), by id → display name. */
export function listedAgents(view: AgentsPageView): Map<string, string> {
  const names = new Map<string, string>()
  if (view.agentScore.status === 'ok') for (const r of view.agentScore.rows) names.set(r.term_id, cleanAtomName(effectiveLabel(r)))
  if (view.cohort.status === 'ok') for (const c of view.cohort.agents) if (!names.has(c.termId)) names.set(c.termId, c.label)
  return names
}

/** The order of a context's list: distinct people, then the attestation score, then the name. */
export function compareRanked(a: RankedAgent, b: RankedAgent): number {
  return b.people - a.people || b.score - a.score || a.name.localeCompare(b.name)
}

/**
 * One summary per trust context, in registry order — empty contexts included (never hidden).
 * null = the attestations couldn't be read: nobody can say who trusts what.
 */
export function contextSummaries(view: AgentsPageView): ContextSummary[] | null {
  if (!view.attestations) return null
  const names = listedAgents(view)
  const byContext = new Map<string, { agents: RankedAgent[]; wallets: Set<string>; stakeWei: bigint }>()
  for (const c of TRUST_CONTEXTS) byContext.set(c.termId.toLowerCase(), { agents: [], wallets: new Set(), stakeWei: 0n })
  for (const [id, entries] of view.attestations) {
    const name = names.get(id)
    if (name == null) continue // not an agent the list shows (junk-filtered)
    for (const e of entries) {
      const slot = byContext.get(e.domain.termId.toLowerCase())
      if (!slot) continue
      const live = summarizeAttesters([e])
      if (live.length === 0) continue
      for (const s of live) slot.wallets.add(s.wallet.toLowerCase())
      const stakeWei = live.reduce((sum, s) => sum + s.totalStake, 0n)
      slot.stakeWei += stakeWei
      slot.agents.push({ id, name, people: live.length, stakeWei, score: e.score })
    }
  }
  return TRUST_CONTEXTS.map((context) => {
    const slot = byContext.get(context.termId.toLowerCase())!
    return { context, people: slot.wallets.size, agents: [...slot.agents].sort(compareRanked), stakeWei: slot.stakeWei }
  })
}

/**
 * The context the landing features: the most distinct people, then the most agents, then the most
 * tTRUST, then registry order. null when nobody trusts any agent for any context yet.
 */
export function featuredContext(summaries: readonly ContextSummary[]): ContextSummary | null {
  let best: ContextSummary | null = null
  for (const s of summaries) {
    if (s.people === 0) continue
    if (!best
      || s.people > best.people
      || (s.people === best.people && s.agents.length > best.agents.length)
      || (s.people === best.people && s.agents.length === best.agents.length && s.stakeWei > best.stakeWei)) best = s
  }
  return best
}

/** Distinct people per listed agent (across every context), most first; agents nobody trusts are left out. */
export function agentsByPeople(view: AgentsPageView): Array<{ id: string; name: string; people: number }> {
  if (!view.attestations) return []
  const names = listedAgents(view)
  const out: Array<{ id: string; name: string; people: number }> = []
  for (const [id, entries] of view.attestations) {
    const name = names.get(id)
    if (name == null) continue
    const people = summarizeAttesters(entries as AttestedEntry[]).length
    if (people > 0) out.push({ id, name, people })
  }
  return out.sort((a, b) => b.people - a.people || a.name.localeCompare(b.name))
}

/** The agents tied for the most people — the candidates for the story card. */
export function topByPeople<T extends { people: number }>(agents: readonly T[]): T[] {
  if (agents.length === 0) return []
  const max = agents[0].people
  return agents.filter((a) => a.people === max)
}

/**
 * The story agent among the tied candidates: the oldest first trust event. A candidate whose events
 * couldn't be read (null) can't win a tie it might have lost; if none could be read, the first by
 * name (agentsByPeople's order) stands.
 */
export function pickStoryAgent<T extends { id: string }>(candidates: readonly T[], firstTrustAt: ReadonlyMap<string, string | null>): T | null {
  if (candidates.length === 0) return null
  let best: { c: T; at: string } | null = null
  for (const c of candidates) {
    const at = firstTrustAt.get(c.id)
    if (!at) continue
    if (!best || at < best.at) best = { c, at }
  }
  return best?.c ?? candidates[0]
}

/** Initials for the tile: the first letters of the first two words ("Captain Dackie" → "CD", "Luda" → "LU"). */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
