/**
 * People-first copy (Etap 5b) — every human-facing string about vouching and backing on the agent
 * surfaces (card, list row, modal, profile), in one module: no string is duplicated across
 * components (REPO_MAP §7 rule 4).
 *
 * One verb: "vouch". vouch (UI) = attestation (protocol) — a wallet's tTRUST stake on
 * [agent] is skilled in [area]. Backing is a stake on the agent's own atom vault; it is never
 * called vouching or trust. Tier names (Unverified / Trusted / Verified) stay.
 *
 * Machine surfaces (REST, MCP, llms.txt, SKILL.md) keep "attest", "attesters", "trustScore" and
 * never print its strings.
 */

import { formatTTrust } from './format'
import { INTUITION_HUB_URL } from './intuition-links'
import { plural, pluralize as count } from './plural'

/** "1 person" / "2 people". */
export const people = (n: number) => count(n, 'person', 'people')

// ─── Vouching: the action ────────────────────────────────────────────────────

/** The page's one primary CTA (desktop section button, phone sticky bar). */
export const VOUCH_CTA = 'Vouch for this agent'
/** The card's inline CTA after its people line. */
export const VOUCH_SHORT = 'Vouch'
/** Screen-reader name of a card's CTA, and the vouch dialog's title. */
export const vouchFor = (agentName: string) => `Vouch for ${agentName}`
/** Why the wallet-connect modal opened, and the dialog's disconnected step. */
export const connectToVouch = (agentName: string) => `Connect a wallet to vouch for ${agentName}.`
export const VOUCH_WRONG_NETWORK = 'Your wallet is on another network. Vouches live on Intuition Testnet.'
export const VOUCH_AREA_LABEL = 'Area'
export const VOUCH_PICK_AREA = 'Pick an area'
/** The dialog's confirm button once an area is picked. */
export const vouchIn = (areaLabel: string) => `Vouch in ${areaLabel}`
/** The cost preview's note when this vouch creates the claim on-chain. */
export const firstVouchNote = (areaLabel: string, txCount: number) =>
  `First vouch for this agent in ${areaLabel} — includes a one-time on-chain setup (${txCount} transaction${txCount > 1 ? 's' : ''}).`
export const VOUCH_SUCCESS = 'You vouched in'
export const VOUCH_INDEXING = 'A new vouch may take a minute to show up here (indexing).'
/** The read-back under the button after a vouch: "You vouched for Luda in …". */
export const VOUCHED_FOR = 'You vouched for'

// ─── Who vouches: the count and the areas ────────────────────────────────────

/** "1 person vouches" / "2 people vouch". */
export const peopleVouch = (n: number) => `${people(n)} ${plural(n, 'vouches', 'vouch')}`

/** "for Knowledge / Productivity" when one area, "for 2 areas" when more. */
export const forAreas = (areaLabels: readonly string[]) =>
  areaLabels.length === 1 ? `for ${areaLabels[0]}` : `for ${count(areaLabels.length, 'area', 'areas')}`

/** The card's and the section's people line: "1 person vouches · for Knowledge / Productivity". */
export const peopleLine = (n: number, areaLabels: readonly string[]) => `${peopleVouch(n)} · ${forAreas(areaLabels)}`

export const NOBODY_VOUCHES = 'Nobody vouches yet'

/** The tier chip's subtitle under Verified: "1 of 3 people needed to verify"; "—" while loading. */
export const tierProgress = (n: number | null, needed: number) => `${n ?? '—'} of ${needed} people needed to verify`
export const TIER_UNREAD = 'Tier unavailable — couldn’t read who vouches'
export const TIER_TOOLTIP =
  'The tier comes only from people who vouch: how many distinct wallets, and how much tTRUST is behind their vouches. ' +
  'Verified: ≥ 3 people and ≥ 0.1 tTRUST. Trusted: ≥ 2 and ≥ 0.05. Otherwise Unverified. ' +
  'Backing the agent never changes it; one wallet can never lift it.'

// ─── Sections ────────────────────────────────────────────────────────────────

export const WHO_VOUCHES_HEADING = 'Who vouches, and for what'
export const WHO_VOUCHES_UNREAD = 'Couldn’t read who vouches right now — this is not an empty record.'
/** The row's expander: the wallets behind that area. */
export const WHO = 'who'

export const EMPTY_VOUCH_TITLE = 'Unverified — nobody vouches yet'
export const EMPTY_VOUCH_BODY =
  'Nobody has vouched for this agent in any area yet. Be the first — pick an area, put a little tTRUST behind it, with your wallet on it.'

export const SAYS_IT_DOES_HEADING = 'Says it does'
export const SAYS_IT_DOES_NOTE = '— self-declared, nobody has vouched yet'
export const SAYS_IT_DOES_UNREAD = 'Couldn’t read what it says it does right now — this is not an empty record.'

export const PEOPLE_WHO_VOUCH_HEADING = 'People who vouch'
export const PEOPLE_WHO_VOUCH_NOTE = 'for an area · with tTRUST'
export const PEOPLE_WHO_VOUCH_EMPTY = 'Nobody has vouched for this agent in any area yet.'

export const BACKERS_HEADING = 'Backers'
export const BACKERS_NOTE = 'tTRUST on this agent · not a vouch'
export const BACKERS_UNREAD = 'Couldn’t read backers right now — this is not an empty record.'
export const BACKERS_EMPTY = 'Nobody has backed this agent with tTRUST yet.'

/** The modal tab holding people who vouch and backers. */
export const PEOPLE_TAB = 'People'
/** The profile tab: the same two lists. */
export const PEOPLE_AND_BACKERS_TAB = 'Who vouches & backers'

export const BACKING_IS_NOT_VOUCHING = 'Put tTRUST behind this agent. Backing is not vouching — it doesn’t change the tier.'

/** The pre-canonical skill claims list, below the vouches. */
export const LEGACY_CLAIMS_NOTE =
  'Older hasAgentSkill / isTrustedFor claims with free-text objects — real stake, not vouches. To vouch, use “Vouch for this agent” above.'

// ─── The stat row and its backing line ───────────────────────────────────────

export const STAT_PEOPLE = (n: number | null | undefined) => plural(n ?? 0, 'Person vouching', 'People vouching')
export const STAT_AREAS = (n: number | null | undefined) => plural(n ?? 0, 'Area', 'Areas')
export const STAT_STAKE = 'tTRUST behind vouches'
export const STAT_REPORTS = 'Reports'
export const STAT_ROW_TOOLTIP =
  'A vouch is tTRUST behind a claim that the agent is good at something, with the wallet on it. ' +
  'Backing is tTRUST on the agent itself. Only vouches count toward the tier.'

/**
 * "Backed with 0.3351 tTRUST by 1 wallet · 16 signals". `backers` null = not read ("—", never a
 * 0 it didn't measure); a read of nobody says so. Signals: null or 0 → no segment.
 */
export function backedLine(backers: { count: number; atomVaultWei: bigint } | null, signals: number | null): string {
  const sig = signals != null && signals > 0 ? ` · ${count(signals, 'signal', 'signals')}` : ''
  if (!backers) return `Backed with — by —${sig}`
  if (backers.count === 0) return `No tTRUST backing yet${sig}`
  return `Backed with ${formatTTrust(backers.atomVaultWei)} by ${count(backers.count, 'wallet', 'wallets')}${sig}`
}

// ─── Where the agent comes from ──────────────────────────────────────────────

export const ERC8004_ABOUT = 'Listed in the ERC-8004 agent registry. It describes itself; people here can vouch for it.'
export const ERC8004_TAB_TITLE = 'Listed in the ERC-8004 agent registry — they describe themselves; people here can vouch for them'

// ─── Details (collapsed) ─────────────────────────────────────────────────────

export const DETAILS_HEADING = 'Details'
export const DETAILS_ATOM_ID = 'Atom ID'
export const DETAILS_CAIP = 'ERC-8004 id'

// ─── Backing score (Etap 5b score decision A) ────────────────────────────────

/**
 * The vault-based number, renamed: small, neutral, never tier-sounding. It measures tTRUST on
 * the agent's own vault — not who vouches. API field names (trustScore / objectScore /
 * agentScore) do not change.
 */
export const BACKING_LABEL = 'Backing'
export const BACKING_SCORE = 'Backing score'
export const BACKING_SCORE_TIP =
  'From the tTRUST staked on this agent itself: support vs oppose. ' +
  'It says how much money is behind the agent — not who vouches for it, and it never changes the tier.'
export const NOT_SCORED_TIP = 'Only agents registered through AgentScore get a backing score.'
/** The list's filter by the backing score's buckets (same buckets as before, secondary). */
export const BACKING_LEVEL = 'Backing level'
export const ALL_BACKING_LEVELS = 'All backing levels'
/** The collapsed Details' breakdown: the score's parts, under their protocol names. */
export const SCORE_PARTS_HEADING = 'The backing score and the numbers beside it (API names)'
export const SCORE_PART_TRUST = 'Trust Score — the backing score'
export const SCORE_PART_COMPOSITE = 'Composite (quality)'
export const SCORE_PART_HYBRID = 'Hybrid — 60% Trust Score + 40% Composite'
export const BACKING_TREND = 'Backing trend'

// ─── The landing: the story on one phone screen (Etap 5b Run 2) ───────────────

export const LIVE_ON_TESTNET = 'Live on Intuition Testnet'
export const LANDING_TITLE = ['Trust Layer for', 'AI Agents'] as const
export const LANDING_SUB = 'Real people vouch for AI agents, on-chain. One wallet can never do it alone.'
export const LANDING_STEPS = ['Find an agent', 'See who vouches, and for what', 'Vouch for one you know'] as const
/** "1 person vouches for agents here" — distinct live people who vouch (/api/v1/stats attesters). */
export const peopleVouchHere = (n: number | null) => {
  const p = peopleVouchHereParts(n)
  return `${p.count} ${p.rest}`
}
/** The number and the words after it, for a number set apart: "1" · "person vouches for agents here". */
export function peopleVouchHereParts(n: number | null): { count: string; rest: string } {
  if (n == null) return { count: '—', rest: 'people vouch for agents here' }
  return { count: String(n), rest: `${plural(n, 'person', 'people')} ${plural(n, 'vouches', 'vouch')} for agents here` }
}
export const PEOPLE_HERE_UNREAD = 'Couldn’t read who vouches right now'
export const LANDING_CTA_VOUCH = 'Vouch for an agent'
export const LANDING_CTA_DEVELOPERS = 'For developers & agents (MCP / REST)'
export const EXAMPLE_HEADING = 'Most vouched right now'
export const EXAMPLE_UNREAD = 'Couldn’t load an example right now — the list is one tap away.'

// ─── /domains (Etap 5b Run 2) ─────────────────────────────────────────────────

export const DOMAINS_INTRO = 'Areas people vouch for agents in. Below them, topics agents tag themselves with — not vouched for.'
export const DOMAINS_VOUCHED_HEADING = 'Vouched for, by area'
export const DOMAINS_VOUCHED_NOTE = 'Each row: an agent, how many people vouch for it in that area, and the tTRUST behind them.'
export const DOMAINS_NOBODY_YET = 'Nobody has vouched for an agent in this area yet —'
export const DOMAINS_TAGS_HEADING = 'Topics agents tag themselves with'
export const DOMAINS_TAGS_NOTE = '— self-declared, not vouched for'

// ─── /evaluators (Etap 5b Run 2) ──────────────────────────────────────────────

export const EVALUATOR_VOUCHED_COLUMN = 'Vouched'
export const EVALUATOR_VOUCHED_COLUMN_TIP = 'A weight above 1.0× counts only once at least one person vouches for this evaluator'
export const evaluatorCappedTip = (earned: number) => `Capped at 1.0× — needs 1 person to vouch for this evaluator to unlock ${earned.toFixed(2)}×`
export const evaluatorVouchedTip = (n: number) => `${people(n)} ${plural(n, 'vouches', 'vouch')} for this evaluator`
export const EVALUATOR_NOT_NEEDED_TIP = 'Nothing to unlock at this weight'
export const EVALUATOR_LEGEND = {
  struck: 'the weight this evaluator earned, capped at 1.0× until someone vouches for them.',
  lock: 'people vouching for this evaluator / needed to unlock a weight above 1.0×.',
  check: 'vouched for — the full weight counts.',
} as const

// ─── /agents header ───────────────────────────────────────────────────────────

export const AGENTS_PAGE_TITLE = 'Agents'
export const AGENTS_PAGE_SUB = 'Find an AI agent and see who vouches for it, and for what.'

// ─── Footer, /register, profile positions ─────────────────────────────────────
// The footer's tagline is LANDING_SUB itself (imported, not copied).

/** /register's "Build Trust" benefit card, agent tab. */
export const REGISTER_BUILD_TRUST = 'Get vouched for by people who know your agent’s work.'
/** The same card on the skill tab: skills are backed, not vouched for. */
export const REGISTER_BUILD_TRUST_SKILL = 'Get backed with tTRUST by people who rely on this skill.'
/** The profile's Supporting tab, when the wallet backs nothing yet. */
export const NO_POSITIONS_NOTE = 'Agents and skills you’ve backed with tTRUST. Backing is not vouching — it doesn’t change an agent’s tier.'

// ─── Seals: the path to Verified (Etap 6) ─────────────────────────────────────

/** An empty seal slot — a place for the next person who vouches. */
export const SEAL_OPEN = 'Open'
/** More people than slots: "and 2 more". */
export const sealsMore = (n: number) => `and ${n} more`
/** The row's name for screen readers: "1 person vouches. Verified takes 3 people." */
export const sealRowLabel = (n: number, needed: number) =>
  `${n === 0 ? NOBODY_VOUCHES : peopleVouch(n)}. Verified takes ${needed} people.`
/** One seal's areas: "Knowledge / Productivity · Crypto / Onchain". */
export const sealAreas = (areaLabels: readonly string[]) => areaLabels.join(' · ')

// ─── Explainers at the point of use (Etap 6) ──────────────────────────────────
// One short answer per word a newcomer doesn't know, on a small "?" next to its first use on the
// modal, the profile and the landing (components/shared/Explainer) — never a separate FAQ page.

export type ExplainerTerm = 'vouch' | 'tiers' | 'backing' | 'ttrust'
export const EXPLAINERS: Record<ExplainerTerm, { label: string; text: string; link?: { text: string; href: string } }> = {
  vouch: {
    label: 'What is a vouch?',
    text: 'A vouch is a person putting a little tTRUST behind one claim: this agent is good at this area. It’s on-chain, with their wallet on it.',
  },
  tiers: {
    label: 'What do Unverified, Trusted and Verified mean?',
    text: 'Trusted takes 2 different people, Verified takes 3. One wallet can never lift an agent on its own.',
  },
  backing: {
    label: 'What is the backing score?',
    text: 'How much tTRUST sits on the agent itself. Backing is not vouching — it never changes the tier.',
  },
  ttrust: {
    label: 'What is tTRUST?',
    text: 'Intuition’s testnet token. It’s free — get it from the Intuition Hub.',
    link: { text: 'Intuition Hub', href: INTUITION_HUB_URL },
  },
}

// ─── The landing: invitation, tiers, a real agent answer (Etap 6) ─────────────

/** Under the one number: one person so far → "Be the second."; otherwise "Add yours." (null = unread → none). */
export const invitationLine = (n: number | null) => (n == null ? null : n === 1 ? 'Be the second.' : 'Add yours.')
/** How it works, one line after the steps. */
export const LANDING_TIERS_LINE = 'Trusted takes 2 people. Verified takes 3. Backing with tTRUST never changes the tier.'
/** The "For developers" block: a live get_agent_trust answer for the landing's example agent. */
export const DEV_HEADING = 'For developers & agents'
export const DEV_LINE = 'Your agent can ask before it trusts. Every answer carries the age of its data.'
export const devAnswerCaption = (agentName: string) => `A live answer for ${agentName}, trimmed.`
export const DEV_ANSWER_UNREAD = 'Couldn’t get an answer right now — this is not an empty one.'

// ─── The last internal words on screen (Etap 6) ──────────────────────────────

/** /agents status line: "272 agents, live" / "272 agents, updated 3 min ago". */
export const AGENTS_LIVE = 'live'
export const agentsStatus = (n: number, age: string) => `${count(n, 'agent', 'agents')}, ${age.charAt(0).toLowerCase()}${age.slice(1)}`
export const AGENTS_STATUS_LOADING = '— agents'
/** One list couldn't be read: the count that was, and which list is missing — never a silent drop. */
export const agentsStatusMissing = (n: number | null, missing: string) =>
  `${n == null ? '—' : count(n, 'agent', 'agents')} — couldn’t read the ${missing} list right now`
/** The line's popover: where the numbers come from, and what is hidden. */
export const AGENTS_STATUS_DETAILS = 'Where these agents come from'
export const hiddenNote = (n: number) =>
  `${n} hidden: test fixtures and duplicate registrations of the same agent — counted here, not shown in the list.`
/** The timeline's pre-canonical skill claim: "Skill added: watch"; the raw predicate stays in its details. */
export const skillAdded = (skillName: string) => `Skill added: ${skillName}`
