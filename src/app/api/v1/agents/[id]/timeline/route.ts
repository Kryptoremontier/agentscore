import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getAgentDetail } from '@/lib/api-data'
import { fetchTimelineData } from '@/lib/timeline-data'
import { buildAgentTimeline } from '@/lib/trust-timeline'
import { publishedAgentScore } from '@/lib/score-basis'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id) return apiError('Agent ID is required', 400)

    const [rawData, agentDetail] = await Promise.all([
      fetchTimelineData(id),
      getAgentDetail(id),
    ])

    // null = no such atom. A failed read threw above → 500, never a "not found".
    if (!rawData) return apiError('Agent not found', 404)

    // The measured AGENTSCORE or null — never the 50 prior or a fallback constant
    // (lib/score-basis.ts publishedAgentScore). scoreBasis says which.
    const published = publishedAgentScore(agentDetail)
    const timeline = buildAgentTimeline({
      agentId: rawData.agentId,
      agentName: rawData.agentName,
      createdAt: rawData.createdAt,
      currentScore: published.score,
      // The attestation tier (thesis §6) — null when unknown, never a fallback "unverified".
      currentTier: agentDetail?.trustTier ?? null,
      tierMilestones: 'none',
      stakingEvents: rawData.stakingEvents,
      skillEvents: rawData.skillEvents,
    })

    return apiSuccess(
      {
        agentId: timeline.agentId,
        agentName: timeline.agentName,
        currentScore: timeline.currentScore,
        // 'measured' | 'prior' (zero stake: no score) | null (not a scored AgentScore agent).
        scoreBasis: published.scoreBasis,
        currentTier: timeline.currentTier,
        tierBasis: 'attestations',
        summary: timeline.summary,
        events: timeline.events.slice(0, 50),
        // Exactly one real point (current score, now) — never a fabricated
        // curve. historyStatus / meta.history say so explicitly.
        scoreHistory: timeline.scoreHistory,
        historyStatus: timeline.historyStatus,
      },
      {
        history: 'not_recorded',
        historyNote: 'Historical score snapshots are not yet persisted — scoreHistory is the current score only, and events carry real on-chain timestamps.',
      },
    )
  } catch (error) {
    console.error('[API] /agents/:id/timeline error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
