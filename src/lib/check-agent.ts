/**
 * "Check an agent" (Etap 7 Run B): one box that takes any way a person names an agent — an
 * AgentScore term id, an ERC-8004 id (`8453:1380` or the CAIP form), a name, or the wallet that
 * registered it — and answers with one card. Pure: the page reads the /agents answer
 * (lib/agents-page-data.ts getAgentsPageData, the shared complete-reads cache) and the cached
 * ERC-8004 cohort's identity links, and this module only looks things up in them. No new reads,
 * no new scoring: the card is the /agents card's own derivations (summarizeAttesters,
 * calculateAgentTier, attesterLineOf, the backing score).
 *
 * Never a guess: a name that fits more than one agent is a short pick list; nothing that fits is
 * "not found"; a failed read is "couldn't read", never "not found" (REPO_MAP §7 rule 5).
 */

import type { AgentsPagePayload, AgentsPageView, PagePart } from './agents-page-types'
import { partAgeSeconds } from './agents-page-types'
import { attesterLineOf, cardAttestationView, listEntryOf, type CardAttesterLine } from './agent-list'
import { summarizeAttesters, type AttesterSummary } from './agent-profile'
import { calculateAgentTier, type AgentTierResult } from './agent-tier'
import { measuredScore, noScoreTooltip } from './score-basis'
import { effectiveLabel } from './api-data'
import { cleanAtomName } from '@/types/claim'
import { isAgentOwner } from '@/components/agents/agent-owner'

// ─── The box ──────────────────────────────────────────────────────────────────

export type CheckQuery =
  | { kind: 'empty' }
  | { kind: 'termId'; termId: string }
  | { kind: 'wallet'; wallet: string }
  /** `8453:1380` (chain:token) or the CAIP form `eip155:8453/erc721:0x8004…/1380` (registry given). */
  | { kind: 'erc8004'; chainId: string; tokenId: string; registry: string | null }
  | { kind: 'name'; name: string }

const CAIP = /^eip155:(\d+)\/erc721:(0x[0-9a-fA-F]{40})\/(\d+)$/

export function parseCheckQuery(raw: string | null | undefined): CheckQuery {
  const q = (raw ?? '').trim()
  if (!q) return { kind: 'empty' }
  if (/^0x[0-9a-fA-F]{64}$/.test(q)) return { kind: 'termId', termId: q.toLowerCase() }
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return { kind: 'wallet', wallet: q }
  const short = /^(\d+):(\d+)$/.exec(q)
  if (short) return { kind: 'erc8004', chainId: short[1], tokenId: short[2], registry: null }
  const caip = CAIP.exec(q)
  if (caip) return { kind: 'erc8004', chainId: caip[1], tokenId: caip[3], registry: caip[2].toLowerCase() }
  return { kind: 'name', name: q }
}

// ─── Looking it up ────────────────────────────────────────────────────────────

export interface CheckCandidate {
  id: string
  name: string
  origin: 'agentscore' | 'erc8004'
  /** Distinct people who vouch; null = the attestation read failed. */
  people: number | null
}

export type CheckResolution =
  | { status: 'empty' }
  | { status: 'found'; id: string }
  | { status: 'choose'; candidates: CheckCandidate[]; more: number }
  | { status: 'not-found'; query: Exclude<CheckQuery, { kind: 'empty' }> }
  /** A read the lookup needed failed: we can't say whether the agent exists. */
  | { status: 'unread' }

/** The pick list's length; more than this → "N more — type more of the name". */
export const CHECK_PICK_MAX = 8
/** Shorter names only match exactly (a one-letter "contains" would list half the registry). */
export const CHECK_MIN_CONTAINS = 3

/** Every agent the /agents list knows, with the name its card prints. */
function agentsOf(view: AgentsPageView): CheckCandidate[] {
  // An agent missing from the map was not read (the list's rule, lib/agent-list.ts cardViewFor): unknown, never 0.
  const people = (id: string) => {
    const entries = view.attestations?.get(id)
    return entries ? summarizeAttesters(entries).length : null
  }
  return [
    ...(view.agentScore.status === 'ok'
      ? view.agentScore.rows.map((r) => ({ id: r.term_id, name: cleanAtomName(effectiveLabel(r)), origin: 'agentscore' as const, people: people(r.term_id) }))
      : []),
    ...(view.cohort.status === 'ok'
      ? view.cohort.agents.map((c) => ({ id: c.termId, name: c.label, origin: 'erc8004' as const, people: people(c.termId) }))
      : []),
  ]
}

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

function pick(list: CheckCandidate[]): CheckResolution {
  if (list.length === 1) return { status: 'found', id: list[0].id }
  const sorted = [...list].sort((a, b) => (b.people ?? -1) - (a.people ?? -1) || a.name.localeCompare(b.name))
  return { status: 'choose', candidates: sorted.slice(0, CHECK_PICK_MAX), more: Math.max(0, sorted.length - CHECK_PICK_MAX) }
}

/**
 * Both corpora read to the end → an absent agent is not an agent. Either part failed or stopped
 * at a cap → we can't say (unread), never "not found".
 */
function complete(view: AgentsPageView): boolean {
  return view.agentScore.status === 'ok' && view.agentScore.truncated === false
    && view.cohort.status === 'ok' && view.cohort.truncated === false
}

/**
 * `identities`: the cohort's identity links (the cached cohort's caipIdentity per agent) — only an
 * ERC-8004 id needs them; null = that read failed.
 */
export function resolveCheckQuery(
  q: CheckQuery,
  view: AgentsPageView,
  identities: ReadonlyArray<{ termId: string; caipIdentity: string }> | null,
): CheckResolution {
  if (q.kind === 'empty') return { status: 'empty' }
  const all = agentsOf(view)
  const notFound = (): CheckResolution => (complete(view) ? { status: 'not-found', query: q } : { status: 'unread' })

  if (q.kind === 'termId') return all.some((a) => a.id === q.termId) ? { status: 'found', id: q.termId } : notFound()

  if (q.kind === 'erc8004') {
    if (!identities) return { status: 'unread' }
    const ids = new Set(identities.filter((i) => {
      const m = CAIP.exec(i.caipIdentity)
      return !!m && m[1] === q.chainId && m[3] === q.tokenId && (q.registry === null || m[2].toLowerCase() === q.registry)
    }).map((i) => i.termId))
    const hits = all.filter((a) => ids.has(a.id))
    return hits.length ? pick(hits) : notFound()
  }

  if (q.kind === 'wallet') {
    // The wallet that registered the agent: its position on the agent's own vault opened with the
    // atom (FeeProxy creates the atom and deposits for the registrant in one transaction) — the
    // Agent Card's owner rule (components/agents/agent-owner.ts). ERC-8004 agents are registered
    // on their own chain; the list holds no owner for them.
    if (view.agentScore.status !== 'ok') return { status: 'unread' }
    const mine = new Set(view.agentScore.rows.filter((r) => isAgentOwner({
      wallet: q.wallet, atomId: r.term_id, atomCreatedAt: r.created_at, positions: r.__vaultPositions ?? null, registeredHere: false,
    })).map((r) => r.term_id))
    const hits = all.filter((a) => mine.has(a.id))
    return hits.length ? pick(hits) : view.agentScore.truncated === false ? { status: 'not-found', query: q } : { status: 'unread' }
  }

  const wanted = norm(q.name)
  const exact = all.filter((a) => norm(a.name) === wanted)
  if (exact.length) return pick(exact)
  const contains = wanted.length >= CHECK_MIN_CONTAINS ? all.filter((a) => norm(a.name).includes(wanted)) : []
  return contains.length ? pick(contains) : notFound()
}

// ─── The card ─────────────────────────────────────────────────────────────────

export interface CheckCard {
  id: string
  name: string
  origin: 'agentscore' | 'erc8004'
  /** "2 people vouch · for 3 areas" — the /agents card's line (unread → no claim). */
  line: CardAttesterLine
  /** Who vouches, most tTRUST first — the seals. null = the attestation read failed. */
  attesters: AttesterSummary[] | null
  /** null = the attestation read failed (unknown, never "Unverified"). */
  tier: AgentTierResult | null
  /** The backing score (vault-based); null = no measurement, with `backingTip` saying why. */
  backing: number | null
  backingTip: string
  /** The oldest read behind the card. */
  dataAgeSeconds: number
  dataReadAt: string
}

/** The oldest of the parts the card was built from. */
function ageOf(parts: Array<PagePart<unknown>>, now: number): { dataAgeSeconds: number; dataReadAt: string } {
  const ok = parts.filter((p): p is Extract<PagePart<unknown>, { status: 'ok' }> => p.status === 'ok')
  const oldest = ok.reduce<Extract<PagePart<unknown>, { status: 'ok' }> | null>(
    (o, p) => (!o || Date.parse(p.dataReadAt) < Date.parse(o.dataReadAt) ? p : o), null)
  return oldest
    ? { dataAgeSeconds: partAgeSeconds(oldest, now) ?? oldest.dataAgeSeconds, dataReadAt: oldest.dataReadAt }
    : { dataAgeSeconds: 0, dataReadAt: new Date(now).toISOString() }
}

/** The card for one agent the list knows; null = not an agent the list knows. */
export function checkCardOf(id: string, payload: AgentsPagePayload, view: AgentsPageView, now: number = Date.now()): CheckCard | null {
  const row = view.agentScore.status === 'ok' ? view.agentScore.rows.find((r) => r.term_id === id) : undefined
  const cohort = !row && view.cohort.status === 'ok' ? view.cohort.agents.find((c) => c.termId === id) : undefined
  if (!row && !cohort) return null
  // Absent from the map = not read (cardViewFor): no claim, never "nobody vouches".
  const entries = view.attestations?.get(id) ?? null
  const views = new Map(entries ? [[id, cardAttestationView(entries)] as const] : [])
  const attesters = entries ? summarizeAttesters(entries) : null
  // The list's own entry (as the landing's example card): a cohort row has no vault read, so no backing score.
  const entry = listEntryOf(row ?? { term_id: id })
  return {
    id,
    name: row ? cleanAtomName(effectiveLabel(row)) : cohort!.label,
    origin: row ? 'agentscore' : 'erc8004',
    line: attesterLineOf(view.attestations ? views : null, id),
    attesters,
    tier: attesters ? calculateAgentTier(attesters) : null,
    backing: measuredScore(entry.trust, entry.measured),
    backingTip: noScoreTooltip(entry.reading),
    ...ageOf(row ? [payload.agentScore] : [payload.cohort, payload.cohortAttestations], now),
  }
}
