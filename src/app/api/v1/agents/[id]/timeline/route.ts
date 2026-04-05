import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getAgentDetail } from '@/lib/api-data'
import { fetchTimelineData } from '@/lib/timeline-data'
import { buildAgentTimeline } from '@/lib/trust-timeline'

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

    if (!rawData) return apiError('Agent not found', 404)

    const timeline = buildAgentTimeline({
      agentId: rawData.agentId,
      agentName: rawData.agentName,
      createdAt: rawData.createdAt,
      currentScore: agentDetail?.agentScore ?? 50,
      currentTier: agentDetail?.trustTier ?? 'unverified',
      stakingEvents: rawData.stakingEvents,
      skillEvents: rawData.skillEvents,
    })

    return apiSuccess({
      agentId: timeline.agentId,
      agentName: timeline.agentName,
      currentScore: timeline.currentScore,
      currentTier: timeline.currentTier,
      summary: timeline.summary,
      events: timeline.events.slice(0, 50),
      scoreHistory: timeline.scoreHistory,
    })
  } catch (error) {
    console.error('[API] /agents/:id/timeline error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
