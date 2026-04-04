import { type NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-helpers'
import { getAgentDetail } from '@/lib/api-data'
import { parseAgentCard, calculateProfileCompleteness } from '@/lib/agent-card'

/**
 * GET /api/v1/agents/:id/card
 *
 * Export agent identity as A2A-compatible card.
 * Machine-readable JSON for agent-to-agent discovery.
 *
 * Includes: capabilities with trust scores, endpoints, source provenance,
 * trust data (AGENTSCORE + tier), and profile completeness.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return apiError('Agent ID is required', 400)

    const agent = await getAgentDetail(id)
    if (!agent) return apiError('Agent not found', 404)

    const card = parseAgentCard(agent.rawLabel || agent.name)
    const completeness = calculateProfileCompleteness({ name: agent.name, ...card })

    return NextResponse.json({
      // A2A standard fields
      name: card.name || agent.name,
      description: card.description || '',
      url: card.endpoints?.website || '',

      // Capabilities with trust scores
      capabilities: (agent.skillBreakdown || []).map(s => ({
        skill: s.skillName,
        trustScore: s.score,
        stakerCount: s.stakerCount,
        level: s.level,
      })),

      // Endpoints for A2A communication
      endpoints: {
        api:    card.endpoints?.api    || null,
        mcp:    card.endpoints?.mcp    || null,
        a2aCard: card.endpoints?.a2aCard || null,
        website: card.endpoints?.website || null,
        docs:   card.endpoints?.docs   || null,
      },

      // Source provenance
      source: {
        github:    card.source?.github    || null,
        version:   card.source?.version   || null,
        license:   card.source?.license   || null,
        framework: card.source?.framework || null,
      },

      // Social
      social: {
        twitter:  card.social?.twitter  || null,
        discord:  card.social?.discord  || null,
        telegram: card.social?.telegram || null,
      },

      // Category
      category: card.category || null,

      // Trust data (unique to AgentScore)
      trust: {
        agentScore: agent.agentScore,
        tier: agent.trustTier,
        momentum: agent.momentumDirection,
        evaluatorWeighted: true,
        antiManipulationLayers: 6,
        profileCompleteness: completeness.percentage,
        isA2AReady: completeness.isA2AReady,
      },

      // Meta
      agentScoreUrl: `https://agentscore-gilt.vercel.app/agents?open=${id}`,
      network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[API] /agents/:id/card error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
