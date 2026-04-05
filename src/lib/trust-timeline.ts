/**
 * Trust Timeline — reconstructs the chronological trust history of an AI agent.
 *
 * Detects and describes events that impacted the agent's score:
 *   - Registration, staker joins/leaves, skill additions
 *   - Tier upgrades (Sandbox at 3, Trusted at 10, Verified at 25 stakers)
 *   - High-tier evaluator staking (Oracle/Sage weight ≥ 1.25)
 *   - A2A readiness milestone
 *
 * Data source: on-chain signals (deposit/redeem events) + skill triples from GraphQL.
 * Each event includes: timestamp, type, description, severity.
 */

// ─── Event Types ──────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'registered'
  | 'staker_joined'
  | 'staker_opposed'
  | 'staker_left'
  | 'skill_added'
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
  currentScore: number
  currentTier: string
  events: TimelineEvent[]                          // newest first
  scoreHistory: { date: string; score: number }[]  // for chart
  summary: {
    totalEvents: number
    daysActive: number
    highestScore: number
    lowestScore: number
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

/** A skill triple associating an agent with a capability. */
export interface SkillEvent {
  tripleId: string
  skillId: string
  skillName: string
  timestamp?: string   // triple.created_at (may be absent from UI data)
}

interface BuildTimelineInput {
  agentId: string
  agentName: string
  createdAt?: string
  currentScore: number
  currentTier: string
  stakingEvents: StakingEvent[]
  skillEvents: SkillEvent[]
  /** Map of accountId (lowercase) → evaluator weight (1.0 = neutral) */
  evaluatorWeights?: Map<string, number>
  profileCompleteness?: { isA2AReady: boolean }
}

// Staker count thresholds that trigger tier upgrades (mirrors trust-tiers.ts)
const TIER_MILESTONES = [
  { count: 3,  tier: 'Sandbox',  icon: '◐' },
  { count: 10, tier: 'Trusted',  icon: '✓' },
  { count: 25, tier: 'Verified', icon: '⭐' },
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
      description: `${input.agentName} was registered on AgentScore. Starting trust score: 50.`,
      scoreAtEvent: 50,
      scoreDelta: null,
      icon: '🎯',
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
        title: `${tier === 'Sage' ? '🧙 Sage' : '🔮 Oracle'} Evaluator Staked`,
        description: `High-accuracy ${tier} evaluator staked support (weight ${(evalWeight ?? 1).toFixed(2)}×). Effective stake is boosted, improving score quality.`,
        scoreAtEvent: null,
        scoreDelta: null,
        icon: tier === 'Sage' ? '🧙' : '🔮',
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
        icon: isDeposit ? (isSupport ? '👍' : '👎') : '↩️',
        severity: isDeposit ? (isSupport ? 'positive' : 'negative') : 'neutral',
        metadata: { accountId: ev.accountId, side: ev.side },
      })
    }
  }

  // ── 3. Tier Milestones ───────────────────────────────────────────────────
  // Find when each unique supporter joined (by first deposit per account)
  const sortedDeposits = input.stakingEvents
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

  // ── 4. Skill Events ──────────────────────────────────────────────────────
  for (const skill of input.skillEvents) {
    // Fall back to createdAt if no skill timestamp (happens with UI data)
    const ts = skill.timestamp ?? input.createdAt
    if (!ts) continue

    events.push({
      id: `skill_${skill.tripleId}`,
      timestamp: ts,
      type: 'skill_added',
      title: `Skill Added: ${skill.skillName}`,
      description: `Capability claim created: "${input.agentName} has skill ${skill.skillName}". This enables domain-specific scoring in the ${skill.skillName} leaderboard.`,
      scoreAtEvent: null,
      scoreDelta: null,
      icon: '⚡',
      severity: 'positive',
      metadata: { skillName: skill.skillName, skillId: skill.skillId },
    })
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
      icon: '🤖',
      severity: 'milestone',
    })
  }

  // ── Sort: newest first ────────────────────────────────────────────────────
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // ── Build score history ───────────────────────────────────────────────────
  const scoreHistory = buildScoreHistory(events, input.currentScore, input.createdAt)

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
    summary: {
      totalEvents: events.length,
      daysActive,
      highestScore: input.currentScore,
      lowestScore: 50,
      currentStreak: getStreakDescription(events),
    },
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Linear (ease-in) interpolation from 50 at registration to currentScore today.
 * Events are injected as waypoints on the curve.
 */
function buildScoreHistory(
  events: TimelineEvent[],
  currentScore: number,
  createdAt?: string,
): { date: string; score: number }[] {
  const oldest = events.length > 0 ? events[events.length - 1] : null
  const startDate = createdAt
    ? new Date(createdAt).getTime()
    : (oldest ? new Date(oldest.timestamp).getTime() : Date.now() - 7 * 86_400_000)
  const endDate = Date.now()
  const duration = endDate - startDate

  if (duration <= 0) return [{ date: new Date().toISOString(), score: currentScore }]

  const startScore = 50
  const steps = Math.max(8, Math.min(events.length + 2, 20))
  const points: { date: string; score: number }[] = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const date = new Date(startDate + duration * t).toISOString()
    const eased = Math.pow(t, 0.65)  // ease-in: slow start, faster later
    const score = Math.round(startScore + (currentScore - startScore) * eased)
    points.push({ date, score: Math.max(0, Math.min(100, score)) })
  }

  return points
}

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
