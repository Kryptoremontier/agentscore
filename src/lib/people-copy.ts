/**
 * People-first copy (Etap 5b; Etap 8a: Intuition's own words) — every human-facing string about
 * trust and backing on the agent surfaces (card, list row, modal, profile, landing, /check,
 * /domains), in one module: no string is duplicated across components (REPO_MAP §7 rule 2).
 *
 * Intuition's consumer app talks about people, things and trust ("24.1k people trust them",
 * "Choose a trust context"); so does AgentScore. One verb: "trust". To trust an agent for a trust
 * context (UI) = an attestation (protocol): the triple <agent> — is skilled in — <context> with a
 * deposit from your wallet; only distinct wallets with live shares count. "Trust context" (UI) =
 * one of the canonical domain buckets (`area` / `domain` in code and on the API). Backing is a
 * stake on the agent's own atom vault: capital on the agent itself, never called trust.
 *
 * Tier labels: Unverified · Established · Verified — `unverified` / `trusted` / `verified` on the
 * API, unchanged ("Trusted" as a tier name fought the verb: "1 person trusts it · not Trusted").
 * API field names, query params, tool names and enum values never change with this copy.
 */

import { formatTTrust } from './format'
import { INTUITION_HUB_URL } from './intuition-links'
import { plural, pluralize as count } from './plural'

/** "1 person" / "2 people". */
export const people = (n: number) => count(n, 'person', 'people')

// ─── Trusting: the action ────────────────────────────────────────────────────

/** The page's one primary CTA (desktop section button, phone sticky bar). */
export const VOUCH_CTA = 'Trust this agent'
/** The card's inline CTA after its people line. */
export const VOUCH_SHORT = 'Trust'
/** Screen-reader name of a card's CTA, and the trust dialog's title. */
export const vouchFor = (agentName: string) => `Trust ${agentName}`
/** Why the wallet-connect modal opened, and the dialog's disconnected step. */
export const connectToVouch = (agentName: string) => `Connect a wallet to trust ${agentName}.`
export const VOUCH_WRONG_NETWORK = 'Your wallet is on another network. Trust lives on Intuition Testnet.'
export const VOUCH_AREA_LABEL = 'Trust context'
export const VOUCH_PICK_AREA = 'Choose a trust context'
/** The dialog's confirm button once a trust context is chosen. */
export const vouchIn = (areaLabel: string) => `Trust it for ${areaLabel}`
/** Under the amount, when it is below the default (Etap 9b): the promise holds only from the default up. */
/** The FeeProxy fee couldn't be read: the dialog stops; nothing is guessed (Etap 9b). */
export const FEE_UNREAD = 'Can’t read the fee right now. Try again in a minute.'
export const FEE_RETRY = 'Try again'
/** Before the first wallet window: the whole cost, the fee read live from the contract. */
export const trustCostLine = (stake: string, fee: string, total: string) => `${stake} tTRUST behind it · fee ${fee} tTRUST · total ${total} tTRUST, plus gas`
export const trustBelowDefault = (defaultAmount: string) => `Below ${defaultAmount}, three people may not reach Verified.`
/** The cost preview's note when this deposit creates the claim on-chain. */
export const firstVouchNote = (areaLabel: string, txCount: number) =>
  `First to trust this agent for ${areaLabel} — includes a one-time on-chain setup (${count(txCount, 'transaction', 'transactions')}).`
/** "You trusted it for 📚 Knowledge / Productivity · stake …". */
export const VOUCH_SUCCESS = 'You trusted it for'
export const VOUCH_INDEXING = 'New trust may take a minute to show up here (indexing).'
/** The read-back under the button: "You trust Luda for …" — VOUCHED_FOR, the name, VOUCHED_FOR_CONTEXT, the contexts. */
export const VOUCHED_FOR = 'You trust'
export const VOUCHED_FOR_CONTEXT = 'for'
/** The dialog's no-tTRUST step. */
export const NEED_TTRUST = 'You need a little testnet tTRUST to trust an agent — it’s free.'

// ─── Taking trust back (Etap 9c) ─────────────────────────────────────────────
// The "Your trust" block: the connected wallet's trust in this agent, one row per trust context, each
// with "Withdraw". Trust words only — no market words in this block (a test reads it).

export const YOUR_TRUST_HEADING = 'Your trust'
export const YOUR_TRUST_NOTE = 'Changed your mind? You can take your trust back at any time.'
export const YOUR_TRUST_UNREAD = 'Can’t read your trust right now. Try again in a minute.'
export const WITHDRAW = 'Withdraw'
export const WITHDRAW_KEEP = 'Keep it'
/** The amount on a row: what this wallet put behind it, in tTRUST. */
export const yourTrustAmount = (amount: string) => `${amount} behind it`
/** The live preview, read from the contract before signing. */
export const withdrawPreview = (amount: string) => `You get back ${amount}, plus gas.`
export const WITHDRAW_PREVIEW_READING = 'Reading what comes back…'
export const WITHDRAW_PREVIEW_FAILED = 'Can’t read what comes back right now. Try again in a minute.'
export const WITHDRAW_RETRY = 'Try again'
export const withdrawSign = (contextLabel: string) => `Withdraw my trust for ${contextLabel}`
export const WITHDRAW_PENDING = 'Confirm in your wallet. Do not close this window.'
export const WITHDRAW_CANCELLED = 'You cancelled in your wallet. Nothing changed.'
export const WITHDRAW_FAILED = 'The withdrawal didn’t go through. Nothing changed.'
export const withdrawDone = (contextLabel: string) => `Done. You no longer trust it for ${contextLabel}.`
export const WITHDRAW_COUNTING = 'Reading who trusts it now…'
export const WITHDRAW_COUNT_UNREAD = 'Couldn’t read who trusts it now. The page will catch up.'
export const WITHDRAW_INDEXING = 'The count may take a minute to catch up (indexing).'
/** "just now" / "12 s ago" / "3 min ago" — how old a read is. */
export const readAgo = (seconds: number) => seconds < 5 ? 'just now' : seconds < 60 ? `${Math.floor(seconds)} s ago` : `${Math.floor(seconds / 60)} min ago`
/** After a withdrawal, from a new read: "Now: 1 person trusts it · Unverified · read 4 s ago". */
export const trustNowLine = (n: number, tierLabel: string, age: string) => `Now: ${peopleVouch(n)} · ${tierLabel} · read ${age}`

// ─── Who trusts it: the count and the trust contexts ─────────────────────────

/** "1 person trusts it" / "2 people trust it" (0: "0 people trust it"; most surfaces say NOBODY_VOUCHES). */
export const peopleVouch = (n: number) => `${people(n)} ${plural(n, 'trusts it', 'trust it')}`

/** "Trust context" / "trust contexts" — Intuition's word for what an agent is trusted for (an `area` on the API). */
export const trustContexts = (n: number) => count(n, 'trust context', 'trust contexts')

/** "for Knowledge / Productivity" when one trust context, "for 2 trust contexts" when more. */
export const forAreas = (areaLabels: readonly string[]) =>
  areaLabels.length === 1 ? `for ${areaLabels[0]}` : `for ${trustContexts(areaLabels.length)}`

/** The card's and the section's people line: "1 person trusts it for Knowledge / Productivity". */
export const peopleLine = (n: number, areaLabels: readonly string[]) => `${peopleVouch(n)} ${forAreas(areaLabels)}`

export const NOBODY_VOUCHES = 'Nobody trusts it yet'

/** The tier chip's subtitle under Verified: "1 of 3 people needed to verify"; "—" while loading. */
export const tierProgress = (n: number | null, needed: number) => `${n ?? '—'} of ${needed} people needed to verify`
export const TIER_UNREAD = 'Tier unavailable — couldn’t read who trusts it'
/**
 * Tier labels on screen (Etap 8a). The API values stay `unverified` / `trusted` / `verified`; only
 * `trusted` reads differently — "Established" — because "Trusted" fought the verb ("1 person trusts
 * it · not Trusted"). The rule (thesis §6) is unchanged.
 */
export const TIER_LABEL = { unverified: 'Unverified', trusted: 'Established', verified: 'Verified' } as const
/** Trust, on-chain — written once in /docs (For developers) and llms.txt. */
export const TRUST_ONCHAIN_MAPPING =
  'Trusting an agent for a trust context = the triple `<agent> — is skilled in — <context>` with a deposit from your wallet. Only distinct wallets with live shares count.'
/** One line per tier: what it takes. */
export const TIER_RULE = {
  verified: 'at least 3 people and 0.1 tTRUST',
  trusted: 'at least 2 people and 0.05 tTRUST',
  unverified: 'fewer than 2 people, or too little tTRUST',
} as const
/** The one line that maps the Established label to its API value (tier explainer, /docs, llms.txt). */
export const ESTABLISHED_MAPPING = `${TIER_LABEL.trusted} (\`trusted\` in the API): ${TIER_RULE.trusted}`
export const TIER_TOOLTIP =
  'The tier comes only from people who trust the agent: how many distinct wallets, and how much tTRUST is behind their trust. ' +
  `Verified: at least 3 people and 0.1 tTRUST. ${ESTABLISHED_MAPPING}. Otherwise Unverified. ` +
  'Backing the agent never changes it; one wallet can never lift it.'

// ─── Sections ────────────────────────────────────────────────────────────────

export const WHO_VOUCHES_HEADING = 'Who trusts it, and for what'
export const WHO_VOUCHES_UNREAD = 'Couldn’t read who trusts it right now — this is not an empty record.'
/** The row's expander: the wallets behind that trust context. */
export const WHO = 'who'

export const EMPTY_VOUCH_TITLE = 'Unverified — nobody trusts it yet'
export const EMPTY_VOUCH_BODY =
  'Nobody has trusted this agent for any trust context yet. Be the first — choose a trust context, put a little tTRUST behind it, with your wallet on it.'

export const SAYS_IT_DOES_HEADING = 'Says it does'
export const SAYS_IT_DOES_NOTE = '— self-declared, nobody has trusted it for this yet'
export const SAYS_IT_DOES_UNREAD = 'Couldn’t read what it says it does right now — this is not an empty record.'

export const PEOPLE_WHO_VOUCH_HEADING = 'People who trust it'
export const PEOPLE_WHO_VOUCH_NOTE = 'for a trust context · with tTRUST'
export const PEOPLE_WHO_VOUCH_EMPTY = 'Nobody has trusted this agent for any trust context yet.'

export const BACKERS_HEADING = 'Backers'
/** Backing, in one line (Etap 8a): what it is and what it never does. */
export const BACKING_EXPLAINER = 'Capital on the agent itself. It never changes the tier.'
export const BACKERS_NOTE = 'capital on the agent itself · never changes the tier'
export const BACKERS_UNREAD = 'Couldn’t read backers right now — this is not an empty record.'
export const BACKERS_EMPTY = 'Nobody has backed this agent with tTRUST yet.'

/** The modal tab holding people who trust it and backers. */
export const PEOPLE_TAB = 'People'
/** The profile tab: the same two lists. */
export const PEOPLE_AND_BACKERS_TAB = 'Who trusts it & backers'

export const BACKING_IS_NOT_VOUCHING = `Put tTRUST behind this agent. ${BACKING_EXPLAINER}`

/** The pre-canonical skill claims list, below who trusts it. */
export const LEGACY_CLAIMS_NOTE =
  'Older hasAgentSkill / isTrustedFor claims with free-text objects — real stake, not trust for a trust context. To trust it, use “Trust this agent” above.'
/** The same list on the agent's tabs: counted, not shown as trust. */
export const LEGACY_CLAIMS_COUNTED = 'predicate, free-text objects) — counted here, not shown as trust.'

// ─── The stat row and its backing line ───────────────────────────────────────

export const STAT_PEOPLE = (n: number | null | undefined) => plural(n ?? 0, 'Person who trusts it', 'People who trust it')
export const STAT_AREAS = (n: number | null | undefined) => plural(n ?? 0, 'Trust context', 'Trust contexts')
export const STAT_STAKE = 'tTRUST behind their trust'
export const STAT_REPORTS = 'Reports'
export const STAT_ROW_TOOLTIP =
  'To trust an agent is to put tTRUST behind a claim that it is good at one trust context, with your wallet on it. ' +
  `Backing: ${BACKING_EXPLAINER} Only trust counts toward the tier.`

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

export const ERC8004_ABOUT = 'Listed in the ERC-8004 agent registry. It describes itself; people here can trust it.'
export const ERC8004_TAB_TITLE = 'Listed in the ERC-8004 agent registry — they describe themselves; people here can trust them'

// ─── Details (collapsed) ─────────────────────────────────────────────────────

export const DETAILS_HEADING = 'Details'
export const DETAILS_ATOM_ID = 'Atom ID'
export const DETAILS_CAIP = 'ERC-8004 id'

// ─── Backing score (Etap 5b score decision A) ────────────────────────────────

/**
 * The vault-based number, renamed: small, neutral, never tier-sounding. It measures tTRUST on
 * the agent's own vault — not who trusts it. API field names (trustScore / objectScore /
 * agentScore) do not change.
 */
export const BACKING_LABEL = 'Backing'
export const BACKING_SCORE = 'Backing score'
export const BACKING_SCORE_TIP =
  `${BACKING_EXPLAINER} From the tTRUST staked on this agent: support vs oppose — how much money is behind it, not who trusts it.`
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

// ─── Skills, claims, evaluators, the trust dialog's progress (Etap 8a) ────────
// "Attestation" is the protocol's word; on screen it is trust (agents) or staking (skills, claims).

/** The skill and claim pages' tab and list of wallets staked on them. */
export const STAKERS_TAB = 'Stakers'
export const STAKERS_HEADING = 'Stakers'
export const NO_STAKERS_YET = 'No stakers yet'
/** The agent modal's and the skill page's claim picker (support / oppose a claim about something). */
export const CLAIM_PICK = 'Choose the claim to stake on, about'
/** The report form's cost notice, after its bold "On-chain report:". */
export const REPORT_COST_NOTE = 'Submitting this report creates an on-chain claim (a triple) and costs ~0.03 tTRUST (atom creation + triple deposit).'
/** The trust dialog's progress line while the deposit goes through. */
export const trustingFor = (areaLabel: string) => `Trusting it for ${areaLabel}…`
export const TRUST_TESTNET_ONLY = 'Trust is testnet-only.'
/** The agent timeline: someone trusted it for a trust context (the canonical claim, staked). */
export const timelineTrustedTitle = (areaLabel: string) => `Trusted for ${areaLabel}`
export const timelineTrustedBody = (agentName: string, areaLabel: string) =>
  `Someone put tTRUST behind "${agentName} is skilled in ${areaLabel}".`
/** The agent timeline's filter for skill claims and trust. */
export const TIMELINE_FILTER_SKILLS = 'Skills & trust'
/** /register: what registering leads to. */
export const REGISTER_GROW = 'Grow your reputation as people trust your agent'
export const REGISTER_GROW_SKILL = 'Grow your reputation as people back your skill'
export const REGISTER_INTRO = 'Create an on-chain identity and join the trust network. Build reputation as people trust your agent.'
/** /agents sort: the default order. */
export const SORT_MOST_TRUSTED = 'Most trusted'

/** The site's meta description (layout.tsx: title, Open Graph, Twitter). */
export const SITE_DESCRIPTION = 'Real people trust AI agents, on-chain — by name, for something specific. One wallet can never do it alone. Built on Intuition.'
export const LIVE_ON_TESTNET = 'Live on Intuition Testnet'
export const LANDING_TITLE = ['Trust layer for', 'AI agents.'] as const
export const LANDING_SUB = 'Real people trust AI agents, on-chain. One wallet can never do it alone.'
export const LANDING_STEPS = ['Find an agent', 'See who trusts it, and for what', 'Trust one you know'] as const
/** "1 person trusts agents here" — distinct live people who trust agents (/api/v1/stats attesters). */
export const peopleVouchHere = (n: number | null) => {
  const p = peopleVouchHereParts(n)
  return `${p.count} ${p.rest}`
}
/** The number and the words after it, for a number set apart: "1" · "person trusts agents here". */
export function peopleVouchHereParts(n: number | null): { count: string; rest: string } {
  if (n == null) return { count: '—', rest: 'people trust agents here' }
  return { count: String(n), rest: `${plural(n, 'person', 'people')} ${plural(n, 'trusts', 'trust')} agents here` }
}
export const PEOPLE_HERE_UNREAD = 'Couldn’t read who trusts agents right now'
export const LANDING_CTA_VOUCH = 'Trust an agent'
/** The landing's primary action (Etap 7 Run B: the Beta shape) — the /check page. */
export const LANDING_CTA_CHECK = 'Check an agent'
/** The landing's second door (Etap 9): for someone who built an agent — to /check in builder mode. */
export const LANDING_DOOR_BUILDER = 'Built an agent? Get your trust link'
export const CHECK_BUILDER_NOTE = 'Find your agent. Its card has the trust link and a badge for your README.'
export const CHECK_BUILDER_REGISTER = 'Not listed yet? Register it'

// ── Check an agent (Etap 7 Run B, app/check) ──
export const CHECK_TITLE = 'Check an agent'
export const CHECK_EYEBROW = 'Before you pay or delegate'
export const CHECK_SUB = 'Who trusts it, for what — and how old that is.'
export const CHECK_LABEL = 'Agent name, AgentScore id, ERC-8004 id or wallet'
export const CHECK_PLACEHOLDER = 'Luda, 8453:1380, 0x45078a…'
export const CHECK_BUTTON = 'Check'
export const CHECK_TRY = 'Try'
export const CHECK_PICK = 'More than one agent fits. Which one?'
export const checkPickMore = (n: number) => `${n} more — type more of the name`
export const CHECK_NOT_FOUND = 'No agent by that name or id on AgentScore or in the ERC-8004 registry.'
export const CHECK_WALLET_NOT_FOUND = 'No agent on AgentScore was registered by this wallet.'
export const CHECK_WALLET_PROFILE = 'See what this wallet trusts'
export const CHECK_BROWSE = 'Browse all agents'
export const CHECK_UNREAD = 'Couldn’t read the agent list right now — this is not a “not found”. Try again in a minute.'
export const CHECK_SHARE = 'Share on X'
export const CHECK_PERMALINK = 'Link to this card'
/** The post a person shares: "{name}: {N} people trust it on AgentScore. Who trusts your agent?" */
export const checkShareText = (name: string, n: number) => `${name}: ${peopleVouch(n)} on AgentScore. Who trusts your agent?`
// ── The builder's door (Etap 9, components/check/BuilderDoor.tsx) ──
// Anyone can copy the link: none of this copy says, or implies, who built or owns the agent.
export const BUILDER_HEADING = 'Built this agent? Get its trust link'
export const BUILDER_CONTEXT_LABEL = 'Trust context for the link'
export const BUILDER_PICK_CONTEXT = 'Choose a trust context'
export const BUILDER_COPY = 'Copy trust link'
export const BUILDER_COPIED = 'Copied'
/**
 * What the minimum number of default trusts makes an agent (Etap 9b). True by construction: the
 * default amount is derived from the tier rule (lib/agent-tier.ts DEFAULT_TRUST_WEI), and a test
 * fails if 2 or 3 default trusts ever stop reaching Established or Verified.
 */
export const TIER_PROMISE = 'Two people make it Established. Three make it Verified.'
export const BUILDER_SEND = `Send this to 3 people who have used it. ${TIER_PROMISE}`
/** What the link is not: anyone can copy it. */
export const BUILDER_SEND_NOTE = 'Anyone can copy this link. It does not say who built the agent.'
/** What the link opens with: the dialog's trust context, preselected; the person can still change it. */
export const builderAsk = (contextLabel: string) => `This link asks: do you trust it for ${contextLabel}? You can pick another trust context.`
/** The post when nobody trusts the agent yet; the link follows it (X appends the url). */
export const builderShareLead = (name: string, contextLabel: string) => `I listed ${name} on AgentScore. Used it? Trust it for ${contextLabel}:`
export const builderShareText = (name: string, contextLabel: string, link: string) => `${builderShareLead(name, contextLabel)} ${link}`
export const BUILDER_COPY_MESSAGE = 'Copy message'
export const BADGE_HEADING = 'A badge for your README'
export const BADGE_NOTE = 'The badge shows the tier, how many people trust it and when that was read. It refreshes every 5 minutes.'
export const BADGE_MARKDOWN = 'Markdown'
export const BADGE_HTML = 'HTML'
export const BADGE_COPY = 'Copy'
export const BADGE_ALT = 'AgentScore badge for this agent'
/** On the Open Graph image, under the card: the data's age, printed on the picture itself. */
export const checkImageAge = (readAt: string, ageLabel: string) => `Data read ${readAt.slice(0, 16).replace('T', ' ')} UTC · ${ageLabel}`
export const CHECK_IMAGE_ALT = 'Who trusts this agent on AgentScore'
export const CHECK_IMAGE_UNREAD = 'Couldn’t read this agent right now — no numbers shown.'
export const ORIGIN_LABEL: Record<'agentscore' | 'erc8004', string> = { agentscore: 'via AgentScore', erc8004: 'ERC-8004' }
export const LANDING_CTA_DEVELOPERS = 'For developers & agents (MCP / REST)'
export const EXAMPLE_HEADING = 'Most trusted right now'
export const EXAMPLE_UNREAD = 'Couldn’t load an example right now — the list is one tap away.'

// ─── /domains: trust contexts (Etap 5b Run 2; Etap 8a) ────────────────────────

/** The page's and the nav's name (the route stays /domains). */
export const DOMAINS_TITLE = 'Trust contexts'
export const DOMAINS_INTRO = 'The trust contexts people trust agents for. Below them, topics agents tag themselves with — self-declared, not trusted.'
export const DOMAINS_VOUCHED_HEADING = 'Trusted for, by trust context'
export const DOMAINS_VOUCHED_NOTE = 'Each row: an agent, how many people trust it for that context, and the tTRUST behind them.'
export const DOMAINS_NOBODY_YET = 'Nobody has trusted an agent for this trust context yet —'
export const DOMAINS_TAGS_HEADING = 'Topics agents tag themselves with'
export const DOMAINS_TAGS_NOTE = '— self-declared, not trusted'
/** The topics list below the trust contexts (skill tags agents give themselves). */
export const DOMAINS_TOPICS = {
  refresh: 'Refresh',
  search: 'Search topics...',
  noneFound: 'No topics found',
  noneYet: 'No topics yet',
  select: 'Select a topic to see rankings',
  noAgents: 'No agents ranked in this topic yet.',
} as const

// ─── /evaluators (Etap 5b Run 2) ──────────────────────────────────────────────

export const EVALUATOR_VOUCHED_COLUMN = 'Trusted by'
export const EVALUATOR_VOUCHED_COLUMN_TIP = 'A weight above 1.0× counts only once at least one person trusts this evaluator'
export const evaluatorCappedTip = (earned: number) => `Capped at 1.0× — needs 1 person to trust this evaluator to unlock ${earned.toFixed(2)}×`
export const evaluatorVouchedTip = (n: number) => `${people(n)} ${plural(n, 'trusts', 'trust')} this evaluator`
export const EVALUATOR_NOT_NEEDED_TIP = 'Nothing to unlock at this weight'
export const EVALUATOR_LEGEND = {
  struck: 'the weight this evaluator earned, capped at 1.0× until someone trusts them.',
  lock: 'people who trust this evaluator / needed to unlock a weight above 1.0×.',
  check: 'trusted — the full weight counts.',
} as const

// ─── /agents header ───────────────────────────────────────────────────────────

export const AGENTS_PAGE_TITLE = 'Agents'
export const AGENTS_PAGE_SUB = 'Find an AI agent and see who trusts it, and for what.'

// ─── Footer, /register, profile positions ─────────────────────────────────────
// The footer's tagline is LANDING_SUB itself (imported, not copied).

/** /register's "Build Trust" benefit card, agent tab. */
export const REGISTER_BUILD_TRUST = 'Get trusted by people who know your agent’s work.'
/** The same card on the skill tab: skills are backed, not trusted for a context. */
export const REGISTER_BUILD_TRUST_SKILL = 'Get backed with tTRUST by people who rely on this skill.'
/** The profile's Supporting tab, when the wallet backs nothing yet. */
export const NO_POSITIONS_NOTE = 'Agents and skills you’ve backed with tTRUST — capital on the agent itself; it never changes an agent’s tier.'

// ─── Seals: the path to Verified (Etap 6) ─────────────────────────────────────

/** An empty seal slot — a place for the next person who trusts it. */
export const SEAL_OPEN = 'Open'
/** More people than slots: "and 2 more". */
export const sealsMore = (n: number) => `and ${n} more`
/** The row's name for screen readers: "1 person trusts it. Verified takes 3 people." */
export const sealRowLabel = (n: number, needed: number) =>
  `${n === 0 ? NOBODY_VOUCHES : peopleVouch(n)}. Verified takes ${needed} people.`
/** One seal's trust contexts: "Knowledge / Productivity · Crypto / Onchain". */
export const sealAreas = (areaLabels: readonly string[]) => areaLabels.join(' · ')

// ─── Explainers at the point of use (Etap 6) ──────────────────────────────────
// One short answer per word a newcomer doesn't know, on a small "?" next to its first use on the
// modal, the profile and the landing (components/shared/Explainer) — never a separate FAQ page.

export type ExplainerTerm = 'vouch' | 'tiers' | 'backing' | 'ttrust'
export const EXPLAINERS: Record<ExplainerTerm, { label: string; text: string; link?: { text: string; href: string } }> = {
  vouch: {
    label: 'What does it mean to trust an agent?',
    text: 'To trust an agent is to put a little tTRUST behind one claim: this agent is good at this trust context. It’s on-chain, with your wallet on it.',
  },
  tiers: {
    label: 'What do Unverified, Established and Verified mean?',
    text: `${ESTABLISHED_MAPPING}. Verified: at least 3 people and 0.1 tTRUST. One wallet can never lift an agent on its own.`,
  },
  backing: {
    label: 'What is the backing score?',
    text: `${BACKING_EXPLAINER} It is how much tTRUST sits on the agent, not who trusts it.`,
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
/** The landing's How it works: the three steps told in full (Etap 5b Run 2; Etap 8a words). */
export const HOW_IT_WORKS = {
  sub: 'Real people trust AI agents — one trust context at a time, with their names on it',
  steps: [
    {
      title: 'Find an agent',
      description: 'Browse AI agents registered on Intuition — from AgentScore and from the ERC-8004 agent registry. Each card says who trusts it, and for what.',
      label: 'Find',
      bullets: ['AgentScore', 'ERC-8004', 'Most trusted first'],
    },
    {
      title: 'See who trusts it, and for what',
      description: 'To trust an agent, a person puts a little tTRUST behind one claim: this agent is good at this trust context. You see every name and every trust context. One wallet can never lift an agent alone — Verified takes three people.',
      label: 'Who trusts it',
      bullets: ['Names', 'Trust contexts', 'Tier'],
    },
    {
      title: 'Trust one you know',
      description: 'Used an agent and it delivered? Trust it for the context it is good at. It is on-chain, with your wallet on it, and it counts toward the agent\'s tier. Testnet tTRUST is free.',
      label: 'Trust',
      bullets: ['Choose a trust context', 'Put tTRUST behind it', 'On-chain'],
    },
  ],
} as const
/** The landing's features: what makes trust here worth reading (Etap 5b Run 2; Etap 8a words). */
export const LANDING_FEATURES = [
  { title: 'Trust per context', tag: 'Context', description: 'An agent is not good at everything. People trust it for one trust context at a time — Crypto / Onchain, Knowledge / Productivity — and you see which.' },
  { title: 'On-chain, with names', tag: 'Provenance', description: 'Every bit of trust and every report is an on-chain claim with the wallet behind it — its ENS name when it has one. Nothing is anonymous, nothing is edited later.' },
  { title: 'A track record counts', tag: 'Evaluators', description: 'People whose trust holds up count for more, up to 1.5×; newcomers start at 0.5×. Weight comes from a record, not only from tTRUST.' },
  { title: 'Who is best at what', tag: 'Discovery', description: 'Each trust context ranks the agents people trust for it, so you can start from the job you need done.' },
  { title: 'Built on Intuition', tag: 'Infrastructure', description: 'Trust lives on Intuition\'s network: low fees, fast finality, and open data any agent or app can read.' },
] as const
/** The landing's closing call: the line under "Know an agent that delivers?", around the Hub link. */
export const CTA_HEADING = 'Know an agent that delivers?'
export const CTA_LINE = { before: 'Trust it for the context it is good at. It takes a wallet and a little testnet tTRUST — free from the', after: '— and your name stays on it.' } as const
/** How it works, one line after the steps. */
export const LANDING_TIERS_LINE = 'Established takes 2 people. Verified takes 3. Backing with tTRUST never changes the tier.'
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
  `${n} hidden: test fixtures, skills registered as agents and duplicate registrations of the same agent — counted here, not shown in the list.`
/** The timeline's pre-canonical skill claim: "Skill added: watch"; the raw predicate stays in its details. */
export const skillAdded = (skillName: string) => `Skill added: ${skillName}`

// ─── The hero in the new type (Etap 6b) ───────────────────────────────────────

/** The hero's eyebrow — mono, amber, uppercase via .eyebrow, "//" via .eyebrow-slash. */
export const HERO_EYEBROW = `Trust layer · ${LIVE_ON_TESTNET}`
/**
 * The sentence after the subtitle, its lead in the accent: "1 person" · "trusts agents here."
 * The live N from /api/v1/stats (null = not read → "—", never a 0).
 */
export function peopleHereLead(n: number | null): { lead: string; rest: string } {
  if (n == null) return { lead: '—', rest: 'people trust agents here.' }
  return { lead: `${n} ${plural(n, 'person', 'people')}`, rest: `${plural(n, 'trusts', 'trust')} agents here.` }
}
/** The check row under the hero's buttons (mono, small). tTRUST keeps its lowercase t. */
export const LANDING_CHECKS = ['TESTNET tTRUST IS FREE', 'ALL TRUST IS ON-CHAIN', 'ONE WALLET CAN NEVER DO IT ALONE'] as const

/** /agents (Etap 7a): the list draws its first rows, then this button adds the next ones. */
export const showMoreAgents = (n: number) => `Show ${n} more`
/** /agents in two sections (Etap 9): who people trust first; the rest collapsed. The header's counts stay the full totals. */
export const agentsTrustedHeading = (n: number) => `People trust these (${n})`
export const agentsUntrustedHeading = (n: number) => `Not trusted yet (${n})`
export const AGENTS_TRUSTED_NONE = 'Nobody trusts an agent in this view yet. Open one below and be the first.'

// ─── The landing tells the story (Etap 8b) ────────────────────────────────────
// Numbered sections, each under a mono eyebrow "■ 0N / …". Headlines are set uppercase by CSS;
// the copy keeps sentence case so a screen reader says words, not letters.

/** The hero's headline: one accent word on a solid block. */
export const STORY_HEADLINE = { before: 'AI agents, trusted by', accent: 'real people', after: '.' } as const
export const STORY_SUB = 'See who trusts an agent, and for what, before you use it, pay it, or let your agent call it.'
export const STORY_HOW_LINK = 'How it works'
/** The section eyebrows, in order: "■ 01 / How it works". */
export const STORY_SECTIONS = {
  how: { num: '01', label: 'How it works' },
  overTime: { num: '02', label: 'Trust over time' },
  gate: { num: '03', label: 'Agents ask first' },
  contexts: { num: '04', label: 'Trust contexts' },
} as const
export const storyEyebrow = (s: { num: string; label: string }) => `${s.num} / ${s.label}`

/** 01 — three steps, one line each. `code` is printed as code. */
export const STORY_STEPS = [
  { num: '01', title: 'Find it', line: 'Any agent: AgentScore or the ERC-8004 registry.' },
  { num: '02', title: 'Trust it', line: `Choose a trust context and sign. ${TIER_PROMISE}` },
  { num: '03', title: 'Agents ask', line: 'Before an agent pays or delegates, it asks', code: 'should_i_trust', after: 'and gets yes, no or unknown.' },
] as const

/** 02 — one real agent's trust, event by event. */
export const OVER_TIME_HEADING = 'Every bit of trust has a name and a date.'
export const OVER_TIME_EVENT = { trusted: 'trusted', for: 'for' } as const
export const FIRST_TRUST_NOTE = 'First trust in AgentScore’s history'
export const OVER_TIME_FEW = 'Fewer than 3 trust events: no curve, just each one.'
export const OVER_TIME_CHART_LABEL = (agent: string, n: number) => `${agent}: ${count(n, 'trust event', 'trust events')} over time`
export const OVER_TIME_UNREAD = 'Couldn’t read who trusts this agent, and when, right now. This is not an empty record.'
export const OVER_TIME_NONE = 'No one trusts an agent here yet.'
export const OVER_TIME_OPEN = 'Open this agent'
/** "Showing the latest 5 of 9". */
export const overTimeShowing = (shown: number, total: number) => `Showing the latest ${shown} of ${total}`

/** 03 — the gate, from a real answer. */
export const GATE_HEADING = 'Agents ask first.'
export const GATE_WHY = ['Agents will pay agents.', 'Before they do, they can ask who stands behind the other side.'] as const
export const GATE_DEVELOPERS = 'For developers'
export const GATE_UNREAD = 'Couldn’t get a live answer from the gate right now, so no example is shown.'
export const GATE_CAPTION = 'A live answer from the gate, as it returned it.'
export const GATE_NONE = 'No one trusts an agent here yet, so there is no answer to show.'

/** 04 — the trust contexts. */
export const CONTEXTS_HEADING = 'What people trust agents for.'
export const contextsFeatured = (context: string) => `Agents people trust for ${context}`
export const CONTEXT_EMPTY = { line: 'No one trusts an agent here yet.', cta: 'Be the first.' } as const
/**
 * The landing's §04 shows only the contexts someone trusts an agent for (Etap 9); the rest are one
 * line — "N more trust contexts are open. Be the first." — linking to the full grid on /domains.
 */
export const contextsOpenLine = (open: number, shown: number) =>
  `${open}${shown > 0 ? ' more' : ''} ${open === 1 ? 'trust context is' : 'trust contexts are'} open.`
export const CONTEXTS_UNREAD = 'Couldn’t read who trusts which agent right now. This is not an empty record.'
export const CONTEXTS_GRID_LABEL = 'All trust contexts'

/** The closing block. */
export const CLOSING_HEADLINE = { before: 'Your agent needs', accent: 'people', after: 'who trust it.' } as const
export const CLOSING_REASSURE = 'Free on Intuition Testnet · Bring one agent you’ve used'
export const CLOSING_PILL = 'Testnet beta'

/** The footer. */
export const FOOTER_BRAND = 'Built on Intuition.'
/** The big number's words: "{N}" then "people trust it" / "person trusts it". */
export const peopleTrustItRest = (n: number) => plural(n, 'person trusts it', 'people trust it')
/** "1 agent" / "3 agents". */
export const agentsCount = (n: number) => count(n, 'agent', 'agents')
/** Over the curve: "3 trust events". */
export const trustEventsCount = (n: number) => count(n, 'trust event', 'trust events')
/** An agent's trust-over-time card when nobody trusts it yet. */
export const OVER_TIME_NOBODY = 'Nobody trusts this agent yet. Be the first.'

// ─── /domains?context=<slug>: one ranked list per trust context (Etap 8b Run B) ──
export const CONTEXT_EYEBROW = 'Trust context'
export const contextHeadline = { before: 'Agents people trust for', after: '.' } as const
/** "3 agents · 5 people". */
export const contextStats = (agents: number, people: number) => `${agentsCount(agents)} · ${count(people, 'person', 'people')}`
export const CONTEXT_ALL = 'All trust contexts'
export const CONTEXT_UNKNOWN = (slug: string) => `There is no trust context called “${slug}”. Here are all of them.`
export const CONTEXT_RANK_NOTE = 'Ranked by distinct people first, then tTRUST behind them.'
