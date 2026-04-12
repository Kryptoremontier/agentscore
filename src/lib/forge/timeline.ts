/**
 * ForgeTrustTimeline — wrapper over the existing TrustTimeline engine.
 * Maps AgentScore event types to forge/project context.
 *
 * Does NOT modify buildAgentTimeline() — only imports and wraps it.
 */

import { buildAgentTimeline, type TimelineEvent } from '@/lib/trust-timeline'

export type { TimelineEvent }

/**
 * Map AgentScore timeline event types to Forge project context.
 * Same events, different labels and icons.
 */
export function mapForgeTimelineEvent(event: TimelineEvent): TimelineEvent {
  const mapping: Record<string, { title: string; description: string; icon: string }> = {
    registered: {
      title: 'Project Listed on IntuForge',
      description: `${(event.metadata?.agentName as string) || 'Project'} was listed on IntuForge. Initial trust score: 50 (neutral).`,
      icon: '🏗️',
    },
    staker_joined: {
      title: 'New Backer',
      description: 'A new community member staked support on this project.',
      icon: '🚀',
    },
    staker_opposed: {
      title: 'Opposition Signal',
      description: 'A community member staked against this project.',
      icon: '⚠️',
    },
    staker_left: {
      title: 'Backer Withdrew',
      description: 'A community member redeemed their position.',
      icon: '↩️',
    },
    skill_added: {
      title: `Integration: ${(event.metadata?.skillName as string) || 'Unknown'}`,
      description: `Project added capability: ${(event.metadata?.skillName as string) || 'Unknown'}`,
      icon: '🔗',
    },
    tier_upgrade: {
      title: `Trust Tier: ${(event.metadata?.tier as string) || 'Upgraded'}`,
      description: `Project reached ${(event.metadata?.tier as string) || 'new'} tier with ${(event.metadata?.stakerCount as number) || '?'} backers.`,
      icon: '⭐',
    },
    evaluator_staked: {
      title: `${event.metadata?.evaluatorTier === 'sage' ? '🧙 Sage' : '🔮 Oracle'} Backed This Project`,
      description: `High-accuracy evaluator (${event.metadata?.evaluatorTier as string}, ${event.metadata?.evaluatorWeight as number}x weight) staked support.`,
      icon: event.metadata?.evaluatorTier === 'sage' ? '🧙' : '🔮',
    },
    a2a_ready: {
      title: 'Ecosystem Ready',
      description: 'Project has API/MCP endpoints. Other projects and agents can integrate programmatically.',
      icon: '🤖',
    },
  }

  const mapped = mapping[event.type]
  if (!mapped) return event

  return {
    ...event,
    title: mapped.title,
    description: mapped.description,
    icon: mapped.icon,
  }
}

/**
 * Build forge-specific timeline by wrapping the existing engine.
 */
export function buildForgeTimeline(agentData: Parameters<typeof buildAgentTimeline>[0]) {
  const timeline = buildAgentTimeline(agentData)
  return {
    ...timeline,
    events: timeline.events.map(mapForgeTimelineEvent),
  }
}
