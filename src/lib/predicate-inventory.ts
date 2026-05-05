/**
 * Central inventory of all canonical predicates AgentScore depends on.
 *
 * Used by:
 *   - /admin/predicates page — testnet registration + mainnet status tracker
 *   - Indexers / health checks — verify ontology completeness
 *
 * Format (mainnet):
 *   Schema.org JSON-LD Thing — same convention used by Saulo's core
 *   predicates ("resolved to", "belongs to", "related to", ...).
 *   The atom data is the full JSON-LD string; the human label lives in
 *   the `name` field.
 *
 * Example on-chain payload:
 *   {"@context":"https://schema.org","@type":"Thing","name":"has agent skill",
 *    "description":"...","image":"ipfs://...","url":null}
 */

export type PredicateGroup =
  | 'core'          // hasAgentSkill, trusts, opposes — power scoring
  | 'capability'    // certifications, qualifications
  | 'relationship'  // discovery between agents
  | 'opinion'       // community sentiment
  | 'attestation'   // verification, vouching
  | 'report'        // moderation reports

export interface PredicateEntry {
  /** Stable internal identifier */
  key: string
  /** Mainnet on-chain `name` (canonical, lowercase + spaces) */
  mainnet: string
  /** Legacy testnet label (camelCase / snake_case) */
  testnet: string
  /** Logical group used in UI / docs */
  group: PredicateGroup
  /** Long-form description embedded in the JSON-LD payload */
  description: string
  /** Whether this predicate must exist before AgentScore mainnet launch */
  required: boolean
  /** Optional IPFS image — defaults to AgentScore generic predicate icon */
  image?: string
  /** 'launch' = needed before mainnet go-live. 'post-launch' = add on demand. */
  scope: 'launch' | 'post-launch'
  /** Known mainnet term_id if already registered or found on portal */
  mainnetTermId?: string
  /** Notes about this predicate's mainnet status */
  mainnetNote?: string
}

/**
 * Default IPFS image for AgentScore predicates.
 * Can be overridden per-entry via `image` field.
 * TODO: replace with branded AgentScore predicate icon CID once uploaded.
 */
export const DEFAULT_PREDICATE_IMAGE = 'ipfs://QmQeGMBSGGSJPbHg1h92YQ1zwWwUbq1n2MkoGxdhz1x15M'

export const PREDICATE_INVENTORY: PredicateEntry[] = [
  // ─── CORE — required for scoring engine ─────────────────────────────────
  {
    key: 'agentHasSkill',
    mainnet: 'has agent skill',
    testnet: 'hasAgentSkill',
    group: 'core',
    required: true,
    scope: 'launch',
    mainnetNote: 'Already registered on mainnet — find term_id on portal',
    description:
      'Declares that an Agent possesses a specific Skill or capability.\n' +
      'Usage: [Agent] — has agent skill — [Skill]. Powers AgentScore Domain\n' +
      'Leaderboards by aggregating skill-tagged agents per knowledge domain.\n' +
      'Stake-weighted: more support increases the agent\'s score in that skill.',
  },
  {
    key: 'personTrustsAgent',
    mainnet: 'trusts',
    testnet: 'trusts',
    group: 'core',
    required: true,
    scope: 'launch',
    mainnetTermId: '0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9',
    mainnetNote: '✅ REUSE — found on portal, lowercase, well-described',
    description:
      'Positive trust attestation toward an entity.\n' +
      'Usage: [Person/Agent] — trusts — [Agent]. Stakes on this triple count\n' +
      'as positive signal in the Trust Score formula. Pairs with `opposes`\n' +
      'as a counter-vault for balanced scoring.',
  },
  {
    key: 'personOpposesAgent',
    mainnet: 'opposes',
    testnet: 'opposes',
    group: 'core',
    required: true,
    scope: 'launch',
    mainnetTermId: '0x3ce0f03b579b0b3d2dcbfbbfb7adb0dd00ab2cf3393ab7201518fabae6dc05f7',
    mainnetNote: '✅ DONE — registered as canonical lowercase. Capital-O Opposes still exists; ours is the recommended one.',
    description:
      'Negative attestation against an entity. Signals disagreement or opposition\n' +
      'toward a subject. Counter-signal to `trusts` — stake on this triple reduces\n' +
      'the subject\'s aggregate trust score in stake-weighted scoring systems.\n' +
      'Anyone can write this triple; consumers should filter by trusted publisher.',
  },
  {
    key: 'agentEvaluatedBy',
    mainnet: 'evaluated by',
    testnet: 'evaluatedBy',
    group: 'core',
    required: true,
    scope: 'launch',
    mainnetNote: '🆕 CREATE — AgentScore-specific, not found on portal',
    description:
      'Records that an entity was reviewed or assessed by an evaluator.\n' +
      'Usage: [Subject] — evaluated by — [Evaluator]. Links a subject to the\n' +
      'party responsible for its quality or reliability assessment. Consumers\n' +
      'may weight evaluations by evaluator reputation.',
  },
  {
    key: 'agentDelegatedTo',
    mainnet: 'delegated to',
    testnet: 'delegatedTo',
    group: 'core',
    required: false,
    scope: 'post-launch',
    description:
      'One Agent delegates trust authority to another.\n' +
      'Usage: [Agent] — delegated to — [Agent]. Used for agent-to-agent\n' +
      'composability, e.g. an orchestrator delegating subtask trust to\n' +
      'specialist agents.',
  },

  // ─── CAPABILITY ─────────────────────────────────────────────────────────
  {
    key: 'isCertifiedBy',
    mainnet: 'is certified by',
    testnet: 'isCertifiedBy',
    group: 'capability',
    required: false,
    scope: 'post-launch',
    description:
      'Records that an Agent or Skill has been formally certified.\n' +
      'Usage: [Agent/Skill] — is certified by — [Authority]. Consumers should\n' +
      'filter by trusted authority address to ensure the cert is from a\n' +
      'recognized issuer; anyone can write this triple.',
  },

  // ─── RELATIONSHIP ───────────────────────────────────────────────────────
  {
    key: 'worksWellWith',
    mainnet: 'works well with',
    testnet: 'worksWellWith',
    group: 'relationship',
    required: false,
    scope: 'post-launch',
    description:
      'Confirms two Agents are compatible in a workflow.\n' +
      'Usage: [Agent] — works well with — [Agent]. Drives discovery in the\n' +
      'AgentScore explorer ("agents that work well with X"). Symmetric in\n' +
      'meaning but stored directionally on-chain.',
  },
  {
    key: 'isAlternativeTo',
    mainnet: 'is alternative to',
    testnet: 'isAlternativeTo',
    group: 'relationship',
    required: false,
    scope: 'post-launch',
    description:
      'Marks two Agents as serving a similar function.\n' +
      'Usage: [Agent] — is alternative to — [Agent]. Useful for substitute\n' +
      'discovery when an agent is unavailable, deprecated, or simply for\n' +
      'comparison shopping in a domain leaderboard.',
  },
  {
    key: 'dependsOn',
    mainnet: 'depends on',
    testnet: 'dependsOn',
    group: 'relationship',
    required: false,
    scope: 'post-launch',
    description:
      'Records a runtime or capability dependency between Agents.\n' +
      'Usage: [Agent] — depends on — [Agent/Skill]. Helps users understand\n' +
      'the trust graph: trusting Agent A may transitively rely on the\n' +
      'reliability of Agent B.',
  },
  {
    key: 'enhances',
    mainnet: 'enhances',
    testnet: 'enhances',
    group: 'relationship',
    required: false,
    scope: 'post-launch',
    description:
      'One Agent extends or improves the capabilities of another.\n' +
      'Usage: [Agent] — enhances — [Agent]. Distinct from `depends on` —\n' +
      'the enhancing agent is optional but additive.',
  },

  // ─── OPINION ────────────────────────────────────────────────────────────
  {
    key: 'isBetterThan',
    mainnet: 'is better than',
    testnet: 'isBetterThan',
    group: 'opinion',
    required: false,
    scope: 'post-launch',
    description:
      'Subjective comparison between two Agents or Skills.\n' +
      'Usage: [Agent] — is better than — [Agent]. Stakeable opinion — the\n' +
      'community votes with tTRUST on which side they support. No global\n' +
      'meaning beyond aggregated stakes.',
  },
  {
    key: 'worksBadWith',
    mainnet: 'works bad with',
    testnet: 'worksBadWith',
    group: 'opinion',
    required: false,
    scope: 'post-launch',
    description:
      'Confirms two Agents are incompatible or conflict in workflows.\n' +
      'Usage: [Agent] — works bad with — [Agent]. Inverse of `works well\n' +
      'with`; warns integrators of known integration issues.',
  },
  {
    key: 'endorses',
    mainnet: 'endorses',
    testnet: 'endorses',
    group: 'opinion',
    required: false,
    scope: 'post-launch',
    description:
      'Public endorsement from one entity to another.\n' +
      'Usage: [Person/Agent] — endorses — [Agent/Skill]. Lighter weight than\n' +
      '`is certified by`; appropriate for personal recommendations.',
  },

  // ─── ATTESTATION ────────────────────────────────────────────────────────
  {
    key: 'verifiedBy',
    mainnet: 'verified by',
    testnet: 'verified by',
    group: 'attestation',
    required: false,
    scope: 'post-launch',
    description:
      'Identity or claim verified by an authority.\n' +
      'Usage: [Subject] — verified by — [Verifier]. Used for KYC-style\n' +
      'attestations and Layer-7 sybil defense in the evaluator weighting\n' +
      'algorithm. Filter by trusted verifier address.',
  },
  {
    key: 'vouchesFor',
    mainnet: 'vouches for',
    testnet: 'vouches for',
    group: 'attestation',
    required: false,
    scope: 'post-launch',
    description:
      'Personal vouch — softer than certification.\n' +
      'Usage: [Person] — vouches for — [Agent/Person]. Useful for web-of-\n' +
      'trust style reputation; carries the voucher\'s own reputation\n' +
      'weight when aggregated.',
  },

  // ─── REPORTS ────────────────────────────────────────────────────────────
  {
    key: 'reportedFor',
    mainnet: 'reported for',
    testnet: 'reportedFor',
    group: 'report',
    required: true,
    scope: 'launch',
    mainnetNote: '🆕 CREATE — replaces 3 separate report predicates. Objects: Scam, Spam, Injection atoms.',
    description:
      'Flags an entity for a specific category of concern or misconduct.\n' +
      'Usage: [Reporter] — reported for — [Object], where Object is an atom\n' +
      'describing the issue type (e.g. Scam, Spam, Injection). Anyone can write\n' +
      'this triple; consumers should weight reports by reporter reputation\n' +
      'to prevent abuse.',
  },
]

const NETWORK = (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_NETWORK'] : undefined) ?? 'testnet'

/** Returns the label that the current network expects on-chain. */
export function activeLabel(entry: PredicateEntry): string {
  return NETWORK === 'mainnet' ? entry.mainnet : entry.testnet
}

/** All required-for-mainnet predicates. */
export function requiredPredicates(): PredicateEntry[] {
  return PREDICATE_INVENTORY.filter(p => p.required)
}

/** Predicates needed before mainnet go-live (5 total). */
export const LAUNCH_PREDICATES = PREDICATE_INVENTORY.filter(p => p.scope === 'launch')

/** Predicates to add on-demand after launch (11 total). */
export const POST_LAUNCH_PREDICATES = PREDICATE_INVENTORY.filter(p => p.scope === 'post-launch')

/** Group inventory entries by their PredicateGroup (preserving order). */
export function groupedInventory(): Array<{ group: PredicateGroup; entries: PredicateEntry[] }> {
  const groups: PredicateGroup[] = ['core', 'capability', 'relationship', 'opinion', 'attestation', 'report']
  return groups.map(group => ({
    group,
    entries: PREDICATE_INVENTORY.filter(p => p.group === group),
  }))
}

/**
 * Build the canonical Schema.org JSON-LD payload for a predicate.
 *
 * Uses fixed key order (matching Saulo's "resolved to" example) so the
 * resulting term_id is deterministic across calls. DO NOT reorder keys —
 * this would change the on-chain atom_id.
 */
export function buildPredicateJsonLd(entry: PredicateEntry): string {
  // url must be JSON null (not the string "null") to match the standard
  // Schema.org convention used by other Intuition protocol predicates.
  // Changing this affects the keccak256 term_id — atoms already registered
  // with url:"null" (string) have a different term_id than atoms registered
  // with url:null (JSON null). Always verify via Phase 0 portal discovery.
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    description: entry.description,
    image: entry.image ?? DEFAULT_PREDICATE_IMAGE,
    name: entry.mainnet,
    url: null,
  }
  return JSON.stringify(payload)
}
