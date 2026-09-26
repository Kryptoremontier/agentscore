/**
 * Trust Timeline — reconstructs the chronological trust history of an AI agent
 * from REAL dated events. Detects and describes:
 *   - Registration, staker joins/leaves, skill/domain claims
 *   - Tier upgrades (Sandbox at 3, Trusted at 10, Verified at 25 stakers)
 *   - High-tier evaluator staking (Oracle/Sage weight ≥ 1.25)
 *   - A2A readiness milestone
 *
 * Data source: on-chain signals (deposit/redeem events) + skill/attestation
 * triples from GraphQL — every event timestamp is a real `created_at`.
 *
 * Historical SCORE snapshots are NOT persisted anywhere (thesis §6): no
 * periodic score recording exists yet, so `scoreAtEvent` is always null and
 * `scoreHistory` carries exactly one real point (the current score, now) —
 * never an interpolated curve. `historyStatus: 'not_recorded'` says so
 * explicitly for API/UI consumers. See docs/AGENTSCORE_CORE_THESIS.md
 * roadmap for the (separate, future) persisted-snapshots feature.
 */

// ─── Event Types ──────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'registered'
  | 'staker_joined'
  | 'staker_opposed'
  | 'staker_left'
  | 'skill_added'
  | 'domain_attested'
  | 'tier_upgrade'
  | 'evaluator_staked'
  | 'a2a_ready'

export type TimelineEventSeverity = 'positive' | 'negative' | 'neutral' | 'milestone'

export interface TimelineEvent {
  id: string
  timestamp: string                  // ISO string
  type: TimelineEventType
  title: string
  description: string
  scoreAtEvent: number | null        // approximate score at this point
  scoreDelta: number | null          // change from previous (+3, -1, null)
  icon: string                       // emoji
  severity: TimelineEventSeverity
  metadata?: Record<string, unknown>
}

export interface AgentTimeline {
  agentId: string
  agentName: string
  /** null = no measured score (zero stake / never read) — never the 50 prior. */
  currentScore: number | null
  /** null = unknown — never a substituted "unverified". */
  currentTier: string | null
  events: TimelineEvent[]                          // newest first, real timestamps
  /**
   * Exactly one REAL point: the current score, computed now. Never an
   * interpolated/synthetic curve — see `historyStatus`. A consumer needs
   * ≥2 points to draw a trend line; this array never provides that, by
   * design, until real snapshots are persisted.
   */
  scoreHistory: { date: string; score: number }[]
  /** Explicit marker: no periodic score snapshots are persisted yet. */
  historyStatus: 'not_recorded'
  summary: {
    totalEvents: number
    daysActive: number
    currentStreak: string
  }
}

// ─── Input Types ──────────────────────────────────────────────────────────────

/** One deposit or redeem event (from a signal record). */
export interface StakingEvent {
  id: string
  accountId?: string
  type: 'deposit' | 'redeem'
  side: 'support' | 'oppose'
  deltaWei: string     // absolute value of signal.delta
  timestamp: string    // signal.created_at
}

/** A skill/domain triple associating an agent with a capability. */
export interface SkillEvent {
  tripleId: string
  skillId: string
  skillName: string
  timestamp?: string   // triple.created_at (may be absent from UI data)
  /**
   * True for the canonical `is skilled in` + stake attestation unit
   * (thesis §4); false/undefined for the legacy hasAgentSkill/
   * isTrustedFor predicate. Rendered as a distinct, honestly-labeled
   * event type — "attested" and "declared/legacy" are different claims.
   */
  canonical?: boolean
}

interface BuildTimelineInput {
  agentId: string
  agentName: string
  createdAt?: string
  /** null = no measured score: the history then has no point at all. */
  currentScore: number | null
  /** null = unknown (e.g. the attestation read failed) — never a substituted "unverified". */
  currentTier: string | null
  /**
   * 'stakers' (default: IntuForge, skills, claims) emits "Reached Sandbox/Trusted/Verified Tier"
   * at 3/10/25 supporters. Agents pass 'none': an agent's tier comes only from attestations
   * (thesis §6), so a supporter count never "reaches" an agent tier.
   */
  tierMilestones?: 'stakers' | 'none'
  stakingEvents: StakingEvent[]
  skillEvents: SkillEvent[]
  /** Map of accountId (lowercase) → evaluator weight (1.0 = neutral) */
  evaluatorWeights?: Map<string, number>
  profileCompleteness?: { isA2AReady: boolean }
}

// Staker count thresholds that trigger tier upgrades (mirrors trust-tiers.ts)
const TIER_MILESTONES = [
  { count: 3,  tier: 'Sandbox',  icon: 'sandbox'  },
  { count: 10, tier: 'Trusted',  icon: 'trusted'  },
  { count: 25, tier: 'Verified', icon: 'verified' },
]

// ─── Main Engine ─────────────────────────────────────────────────────────────

export function buildAgentTimeline(input: BuildTimelineInput): AgentTimeline {
  const events: TimelineEvent[] = []

  // ── 1. Registration ──────────────────────────────────────────────────────
  if (input.createdAt) {
    events.push({
      id: `reg_${input.agentId}`,
      timestamp: input.createdAt,
      type: 'registered',
      title: 'Agent Registered',
      description: `${input.agentName} was registered on AgentScore.`,
      scoreAtEvent: null,
      scoreDelta: null,
      icon: 'registered',
      severity: 'milestone',
    })
  }

  // ── 2. Staking Events ────────────────────────────────────────────────────
  for (const ev of input.stakingEvents) {
    const isDeposit = ev.type === 'deposit'
    const isSupport = ev.side === 'support'
    const evalWeight = input.evaluatorWeights?.get(ev.accountId?.toLowerCase() ?? '')
    const isHighTierEval = (evalWeight ?? 0) >= 1.25

    if (isHighTierEval && isDeposit && isSupport) {
      // Oracle / Sage evaluator staking — elevated event
      const tier = (evalWeight ?? 0) >= 1.35 ? 'Sage' : 'Oracle'
      events.push({
        id: `eval_${ev.id}`,
        timestamp: ev.timestamp,
        type: 'evaluator_staked',
        title: `${tier} Evaluator Staked`,
        description: `High-accuracy ${tier} evaluator staked support (weight ${(evalWeight ?? 1).toFixed(2)}×). Effective stake is boosted, improving score quality.`,
        scoreAtEvent: null,
        scoreDelta: null,
        icon: 'evaluator',
        severity: 'positive',
        metadata: { accountId: ev.accountId, evaluatorWeight: evalWeight, evaluatorTier: tier },
      })
    } else {
      const typeId = isDeposit
        ? (isSupport ? 'staker_joined' : 'staker_opposed')
        : 'staker_left' as TimelineEventType

      events.push({
        id: `stake_${ev.id}`,
        timestamp: ev.timestamp,
        type: typeId,
        title: isDeposit
          ? (isSupport ? 'New Supporter' : 'New Opposition')
          : (isSupport ? 'Supporter Left' : 'Opposition Reduced'),
        description: isDeposit
          ? (isSupport ? 'A new staker opened a support position.' : 'A new staker opened an opposition position.')
          : (isSupport ? 'A supporter redeemed their position.' : 'An opponent redeemed their position.'),
        scoreAtEvent: null,
        scoreDelta: null,
        icon: isDeposit ? (isSupport ? 'support' : 'oppose') : 'left',
        severity: isDeposit ? (isSupport ? 'positive' : 'negative') : 'neutral',
        metadata: { accountId: ev.accountId, side: ev.side },
      })
    }
  }

  // ── 3. Tier Milestones ───────────────────────────────────────────────────
  // Find when each unique supporter joined (by first deposit per account)
  const sortedDeposits = input.tierMilestones === 'none' ? [] : input.stakingEvents
    .filter(e => e.type === 'deposit' && e.side === 'support')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const seenAccounts = new Set<string>()
  let cumulativeStakers = 0

  for (const ev of sortedDeposits) {
    const key = ev.accountId?.toLowerCase() ?? `anon_${ev.id}`
    if (seenAccounts.has(key)) continue
    seenAccounts.add(key)
    cumulativeStakers++

    const milestone = TIER_MILESTONES.find(m => m.count === cumulativeStakers)
    if (!milestone) continue

    events.push({
      id: `tier_${milestone.tier}_${input.agentId}`,
      timestamp: ev.timestamp,
      type: 'tier_upgrade',
      title: `Reached ${milestone.tier} Tier`,
      description: {
        Sandbox:  `${cumulativeStakers} supporters reached. Community activity confirmed — agent enters Sandbox tier.`,
        Trusted:  `${cumulativeStakers} supporters reached. Solid conviction established — agent upgraded to Trusted tier.`,
        Verified: `${cumulativeStakers} supporters reached. High community confidence achieved — agent is now Verified.`,
      }[milestone.tier] ?? `Tier upgraded to ${milestone.tier}.`,
      scoreAtEvent: null,
      scoreDelta: null,
      icon: milestone.icon,
      severity: 'milestone',
      metadata: { tier: milestone.tier, stakerCount: cumulativeStakers },
    })
  }

  // ── 4. Skill / Attestation Events ────────────────────────────────────────
  for (const skill of input.skillEvents) {
    // Fall back to createdAt if no skill timestamp (happens with UI data)
    const ts = skill.timestamp ?? input.createdAt
    if (!ts) continue

    if (skill.canonical) {
      // Canonical unit: [agent] is skilled in [domain] + stake (thesis §4).
      events.push({
        id: `attest_${skill.tripleId}`,
        timestamp: ts,
        type: 'domain_attested',
        title: `Domain Attested: ${skill.skillName}`,
        description: `Community attestation created and staked: "${input.agentName} is skilled in ${skill.skillName}".`,
        scoreAtEvent: null,
        scoreDelta: null,
        icon: '🛡️',
        severity: 'positive',
        metadata: { skillName: skill.skillName, skillId: skill.skillId },
      })
    } else {
      events.push({
        id: `skill_${skill.tripleId}`,
        timestamp: ts,
        type: 'skill_added',
        title: `Skill Claim: ${skill.skillName}`,
        description: `Legacy capability claim created: "${input.agentName} has skill ${skill.skillName}" (pre-canonical predicate).`,
        scoreAtEvent: null,
        scoreDelta: null,
        icon: '⚡',
        severity: 'positive',
        metadata: { skillName: skill.skillName, skillId: skill.skillId },
      })
    }
  }

  // ── 5. A2A Readiness ─────────────────────────────────────────────────────
  if (input.profileCompleteness?.isA2AReady) {
    const ts = input.createdAt ?? new Date().toISOString()
    events.push({
      id: `a2a_${input.agentId}`,
      timestamp: ts,
      type: 'a2a_ready',
      title: 'A2A Ready',
      description: 'Agent has endpoints and capabilities registered. Other AI agents can now discover and interact with this agent programmatically via the A2A protocol.',
      scoreAtEvent: null,
      scoreDelta: null,
      icon: 'a2a',
      severity: 'milestone',
    })
  }

  // ── Sort: newest first ────────────────────────────────────────────────────
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // ── Score history — exactly one REAL point, never a fabricated curve ──────
  // …and none at all when there is no measured score to record.
  const scoreHistory = input.currentScore == null
    ? []
    : [{ date: new Date().toISOString(), score: input.currentScore }]

  // ── Summary ───────────────────────────────────────────────────────────────
  const oldestEvent = events.length > 0 ? events[events.length - 1] : null
  const daysActive = oldestEvent
    ? Math.max(0, Math.floor((Date.now() - new Date(oldestEvent.timestamp).getTime()) / 86_400_000))
    : 0

  return {
    agentId: input.agentId,
    agentName: input.agentName,
    currentScore: input.currentScore,
    currentTier: input.currentTier,
    events,
    scoreHistory,
    historyStatus: 'not_recorded',
    summary: {
      totalEvents: events.length,
      daysActive,
      currentStreak: getStreakDescription(events),
    },
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStreakDescription(events: TimelineEvent[]): string {
  if (events.length === 0) return 'No activity yet'

  const recent = events.slice(0, 5)
  const posCount = recent.filter(e => e.severity === 'positive').length
  const negCount = recent.filter(e => e.severity === 'negative').length
  const milestoneCount = recent.filter(e => e.severity === 'milestone').length

  if (milestoneCount >= 2) return 'Milestone momentum'
  if (posCount >= 4) return 'Strong positive momentum'
  if (negCount >= 4) return 'Under pressure'
  if (posCount > negCount) return 'Trending positive'
  if (negCount > posCount) return 'Facing opposition'
  return 'Stable'
}
