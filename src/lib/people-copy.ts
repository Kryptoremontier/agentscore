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

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

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
export const peopleVouch = (n: number) => `${people(n)} ${n === 1 ? 'vouches' : 'vouch'}`

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

export const STAT_PEOPLE = (n: number | undefined) => (n === 1 ? 'Person vouching' : 'People vouching')
export const STAT_AREAS = (n: number | undefined) => (n === 1 ? 'Area' : 'Areas')
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
