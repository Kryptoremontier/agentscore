import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api-helpers'
import { calculateProfileCompleteness, serializeAgentCard, type AgentCardData, type AgentCategory } from '@/lib/agent-card'

/**
 * POST /api/v1/agents/register
 *
 * "Prepare mode" — validates and structures agent registration data.
 * Returns the atomLabel and instructions for client-side signing.
 *
 * NO server-side transaction execution (no private key on server).
 * The client (human UI or AI agent) signs and submits the on-chain tx.
 */

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  skills: z.array(z.string().max(80)).max(10).optional(),
  endpoints: z.object({
    api:     z.string().url().optional(),
    mcp:     z.string().url().optional(),
    a2aCard: z.string().url().optional(),
    website: z.string().url().optional(),
    docs:    z.string().url().optional(),
  }).optional(),
  source: z.object({
    github:    z.string().max(200).optional(),
    version:   z.string().max(30).optional(),
    license:   z.string().max(50).optional(),
    framework: z.string().max(50).optional(),
  }).optional(),
  social: z.object({
    twitter:  z.string().max(100).optional(),
    discord:  z.string().max(200).optional(),
    telegram: z.string().max(100).optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = schema.parse(body)

    const cardData: AgentCardData = {
      name: validated.name,
      description: validated.description,
      category: validated.category as AgentCategory | undefined,
      skills: validated.skills,
      endpoints: validated.endpoints,
      source: validated.source,
      social: validated.social,
    }

    const atomLabel  = serializeAgentCard(cardData)
    const completeness = calculateProfileCompleteness(cardData)

    return NextResponse.json({
      success: true,
      data: {
        atomLabel,
        skills: validated.skills || [],
        profileCompleteness: completeness.percentage,
        isA2AReady: completeness.isA2AReady,
        missingFields: completeness.missingFields,
        instructions: [
          '1. Create atom with atomLabel as data via FeeProxy.createAtoms()',
          '2. Create type triple: [Agent] [is] [AI Agent]',
          '3. For each skill: findOrCreateAtom(skill) → createTriple([Agent][hasAgentSkill][Skill])',
          '4. All operations through AgentScore FeeProxy (see registrationUrl)',
        ],
        registrationUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agentscore-gilt.vercel.app'}/register`,
        network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
      },
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = (error as z.ZodError).issues ?? []
      return apiError(
        `Validation error: ${issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        400
      )
    }
    console.error('[API] /agents/register error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
