/**
 * The trust gate (Etap 7): one yes/no for an agent that is about to pay or delegate to another
 * agent — who vouches, for what, and how old the data is. REST `GET /api/v1/agents/:id/gate`
 * and MCP `should_i_trust` both answer through `decideTrustGate`.
 *
 * Pure, and no new scoring: the inputs are the agent's attestations as the attestation reader
 * returns them, and the only derivations are the existing ones — distinct live attesters
 * (`summarizeAttesters`, 0-share wallets never count) and the agent tier (`calculateAgentTier`,
 * thesis §6). The data's age is passed through as read.
 *
 * - **Fail closed.** A lookup or attestation read that failed → `unknown`, never `allow`
 *   (thesis §6, REPO_MAP §7 rule 5). `unknown` means "do not pay".
 * - **The policy is the caller's.** AgentScore never decides "trusted enough" on its own; the
 *   default is the thesis ladder's `{ minTier: 'trusted' }`. The tier rule itself is unchanged.
 * - **Nothing is for sale.** Only the policy and the agent's on-chain attestations shape a
 *   decision — no other parameter, header or payment is an input here.
 */

import { CANONICAL_DOMAINS_REGISTRY } from './canonical-domains'
import { summarizeAttesters } from './agent-profile'
import { calculateAgentTier, AGENT_TIER_DISPLAY, AGENT_TIER_LADDER, type AgentTier } from './agent-tier'
import type { AttestedEntry } from './attestation-reader'

export type GatePolicy =
  | { minTier: 'trusted' | 'verified' }
  | { minPeople: number; area?: string } // area = canonical domain bucket name

export interface GateDecision {
  decision: 'allow' | 'deny' | 'unknown'
  /** Plain English, one sentence. */
  reason: string
  tier: AgentTier | null
  /** Distinct live attesters (in `area` when the policy names one). */
  peopleVouching: number | null
  areas: { area: string; people: number; tTrust: string }[] | null
  policy: GatePolicy
  meta: { dataAgeSeconds: number; dataReadAt: string }
}

/** What the readers found for the id. `attested: null` = the attestation read failed. */
export type GateSubject =
  | { status: 'found'; attested: readonly AttestedEntry[] | null }
  | { status: 'not-found' }
  /** The lookup itself failed — the readers couldn't say whether the agent exists. */
  | { status: 'unread' }

/** The thesis ladder (§6): Trusted or above. */
export const DEFAULT_GATE_POLICY: GatePolicy = { minTier: 'trusted' }

/** The area names a policy may use — the canonical domain buckets, exactly as labelled on-chain. */
export const GATE_AREAS: readonly string[] = CANONICAL_DOMAINS_REGISTRY.map((d) => d.label)

export const GATE_NOT_FOUND = 'Not found in AgentScore or the ERC-8004 registry'
export const GATE_LOOKUP_UNREAD =
  'Couldn’t read this agent from the Intuition network right now, so this is not a yes — do not pay or delegate; try again shortly.'
export const GATE_VOUCHES_UNREAD =
  'Couldn’t read who vouches for this agent right now, so this is not a yes — do not pay or delegate; try again shortly.'

const TIER_RANK: Record<AgentTier, number> = { unverified: 0, trusted: 1, verified: 2 }

// ─── Policy input ─────────────────────────────────────────────────────────────

export type PolicyParse = { ok: true; policy: GatePolicy } | { ok: false; error: string }

const present = (v: unknown) => v !== undefined && v !== null && v !== ''

/**
 * The caller's policy from REST query values (strings) or MCP arguments (typed). Only `minTier`,
 * `minPeople` and `area` are read. Anything that doesn't say one policy plainly is refused
 * (400 / MCP error) — never guessed, never a silent `deny`. Neither given → the default.
 */
export function parseGatePolicy(input: { minTier?: unknown; minPeople?: unknown; area?: unknown }): PolicyParse {
  const { minTier, minPeople, area } = input
  if (present(minTier) && present(minPeople)) {
    return { ok: false, error: 'Give either minTier or minPeople, not both.' }
  }
  if (present(area) && !present(minPeople)) {
    return { ok: false, error: 'area goes with minPeople (e.g. minPeople=1&area=Crypto / Onchain).' }
  }
  if (present(minTier)) {
    if (minTier !== 'trusted' && minTier !== 'verified') {
      return { ok: false, error: 'minTier must be "trusted" or "verified".' }
    }
    return { ok: true, policy: { minTier } }
  }
  if (present(minPeople)) {
    const n = typeof minPeople === 'number' ? minPeople
      : typeof minPeople === 'string' && /^\d+$/.test(minPeople.trim()) ? Number(minPeople.trim())
      : NaN
    if (!Number.isSafeInteger(n) || n < 1) {
      return { ok: false, error: 'minPeople must be a whole number, 1 or more.' }
    }
    if (!present(area)) return { ok: true, policy: { minPeople: n } }
    const wanted = typeof area === 'string' ? area.trim().toLowerCase() : null
    const label = wanted === null ? undefined : GATE_AREAS.find((a) => a.toLowerCase() === wanted)
    if (!label) {
      return { ok: false, error: `Unknown area ${JSON.stringify(area)}. Areas: ${GATE_AREAS.join(', ')}.` }
    }
    return { ok: true, policy: { minPeople: n, area: label } }
  }
  return { ok: true, policy: DEFAULT_GATE_POLICY }
}

// ─── The decision ─────────────────────────────────────────────────────────────

/** Exact decimal tTRUST from wei ("0.0099", "1", "0") — a string, so no float rounding. */
export function tTrustString(wei: bigint): string {
  const neg = wei < 0n
  const abs = neg ? -wei : wei
  const whole = abs / 1_000_000_000_000_000_000n
  const frac = (abs % 1_000_000_000_000_000_000n).toString().padStart(18, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`
}

/** Per area: distinct live attesters and the tTRUST they vouched — areas nobody vouches in are left out. */
function areasOf(attested: readonly AttestedEntry[]): NonNullable<GateDecision['areas']> {
  const byArea = new Map<string, AttestedEntry[]>()
  for (const e of attested) byArea.set(e.domain.label, [...(byArea.get(e.domain.label) ?? []), e])
  return [...byArea.entries()]
    .map(([area, entries]) => {
      const people = summarizeAttesters(entries)
      return { area, people: people.length, wei: people.reduce((s, p) => s + p.totalStake, 0n) }
    })
    .filter((a) => a.people > 0)
    .sort((a, b) => b.people - a.people || (a.wei === b.wei ? a.area.localeCompare(b.area) : a.wei > b.wei ? -1 : 1))
    .map(({ area, people, wei }) => ({ area, people, tTrust: tTrustString(wei) }))
}

/**
 * "1 person vouches for this agent in Social" — `midSentence` after a colon ("Unverified: no one
 * vouches …"). Its own words, not the UI copy module: a machine answer never changes
 * because a screen's wording did.
 */
const vouchPhrase = (n: number, area?: string, midSentence = false) =>
  `${n === 0 ? (midSentence ? 'no one vouches' : 'No one vouches') : n === 1 ? '1 person vouches' : `${n} people vouch`} for this agent${area ? ` in ${area}` : ''}`

export function decideTrustGate(
  subject: GateSubject,
  policy: GatePolicy,
  meta: GateDecision['meta'],
): GateDecision {
  const base = { tier: null, peopleVouching: null, areas: null, policy, meta }
  if (subject.status === 'unread') return { ...base, decision: 'unknown', reason: GATE_LOOKUP_UNREAD }
  if (subject.status === 'not-found') return { ...base, decision: 'deny', reason: GATE_NOT_FOUND }
  if (subject.attested === null) return { ...base, decision: 'unknown', reason: GATE_VOUCHES_UNREAD }

  const attested = subject.attested
  const tier = calculateAgentTier(summarizeAttesters(attested)).tier
  const areas = areasOf(attested)

  if ('minTier' in policy) {
    const people = summarizeAttesters(attested).length
    const label = AGENT_TIER_DISPLAY[tier].label
    const min = AGENT_TIER_DISPLAY[policy.minTier].label
    const rung = AGENT_TIER_LADDER[policy.minTier]
    const allow = TIER_RANK[tier] >= TIER_RANK[policy.minTier]
    const reason = allow
      ? `${label}: ${vouchPhrase(people, undefined, true)}, which meets your minimum of ${min}.`
      : `${label}: ${vouchPhrase(people, undefined, true)}; your minimum is ${min} (at least ${rung.minAttesters} people and ${tTrustString(rung.minAttestedWei)} tTRUST vouched).`
    return { decision: allow ? 'allow' : 'deny', reason, tier, peopleVouching: people, areas, policy, meta }
  }

  const inArea = policy.area === undefined ? attested : attested.filter((e) => e.domain.label === policy.area)
  const people = summarizeAttesters(inArea).length
  const allow = people >= policy.minPeople
  const reason = `${vouchPhrase(people, policy.area)}; your policy needs at least ${policy.minPeople}.`
  return { decision: allow ? 'allow' : 'deny', reason, tier, peopleVouching: people, areas, policy, meta }
}
