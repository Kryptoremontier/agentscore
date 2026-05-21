import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiSuccess, apiError, corsOptions, parsePagination } from '@/lib/api-helpers'
import { fetchForgeProjectsFromChain } from '@/lib/forge/data'
import { calculateForgeCompleteness } from '@/lib/forge/completeness'
import { getForgeProjectScore } from '@/lib/forge/scoring'
import { ForgeCategory, ProjectStage } from '@/lib/forge/types'

export const revalidate = 300

// ─── Validation ───────────────────────────────────────────────────────────────

const TeamMemberSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  twitter: z.string().max(80).optional(),
  wallet: z.string().max(42).optional(),
})

const RegistrationSchema = z.object({
  name:           z.string().min(1, 'Name is required').max(80),
  tagline:        z.string().min(1, 'Tagline is required').max(100),
  description:    z.string().min(1, 'Description is required').max(500),
  category:       z.nativeEnum(ForgeCategory),
  stage:          z.nativeEnum(ProjectStage),
  website:        z.string().url().optional().or(z.literal('')),
  github:         z.string().max(200).optional(),
  twitter:        z.string().max(80).optional(),
  discord:        z.string().max(200).optional(),
  demo:           z.string().url().optional().or(z.literal('')),
  teamSize:       z.number().int().min(1).max(10000).optional(),
  isAnonymous:    z.boolean(),
  teamMembers:    z.array(TeamMemberSchema).max(20).optional(),
  isOpenSource:   z.boolean(),
  license:        z.string().max(50).optional(),
  techStack:      z.array(z.string().max(50)).max(20).optional(),
  intuitionAtoms: z.array(z.string().max(66)).max(20).optional(),
  usesFeeProxy:   z.boolean(),
  hasMCPServer:   z.boolean(),
  hasAPI:         z.boolean(),
})

// ─── GET /api/v1/forge/projects ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { limit, offset } = parsePagination(searchParams)

    const category = searchParams.get('category') as ForgeCategory | null
    const stage    = searchParams.get('stage') as ProjectStage | null
    const sort     = (searchParams.get('sort') || 'trustScore') as string
    const search   = (searchParams.get('search') || '').toLowerCase()

    let projects = await fetchForgeProjectsFromChain(200)

    // Filters
    if (category && Object.values(ForgeCategory).includes(category)) {
      projects = projects.filter(p => p.category === category)
    }
    if (stage && Object.values(ProjectStage).includes(stage)) {
      projects = projects.filter(p => p.stage === stage)
    }
    if (search) {
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(search) || p.tagline.toLowerCase().includes(search)
      )
    }

    // Sort
    projects.sort((a, b) => {
      switch (sort) {
        case 'trustScore':  return b.finalScore - a.finalScore
        case 'newest':      return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
        case 'mostStaked':  return b.totalStaked - a.totalStaked
        case 'mostStakers': return b.stakerCount - a.stakerCount
        default:            return b.finalScore - a.finalScore
      }
    })

    const total = projects.length
    const paginated = projects
      .slice(offset, offset + limit)
      .map(project => ({
        ...project,
        score: getForgeProjectScore(project),
      }))

    return apiSuccess({ projects: paginated, total, limit, offset })
  } catch (error) {
    console.error('[API] GET /forge/projects error:', error)
    return apiError('Internal server error', 500)
  }
}

// ─── POST /api/v1/forge/projects — prepare registration ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = RegistrationSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return apiError(`Validation error: ${firstError.path.join('.')} — ${firstError.message}`, 400)
    }

    const input = parsed.data
    const completenessResult = calculateForgeCompleteness(input)

    // Serialize atom label — same pattern as agent registration
    const atomLabel = JSON.stringify({
      type:        'IntuitionProject',
      name:        input.name,
      tagline:     input.tagline,
      description: input.description,
      category:    input.category,
      stage:       input.stage,
      links: {
        website: input.website || undefined,
        github:  input.github || undefined,
        twitter: input.twitter || undefined,
        discord: input.discord || undefined,
        demo:    input.demo || undefined,
      },
      team: {
        size:        input.teamSize,
        isAnonymous: input.isAnonymous,
        members:     input.teamMembers,
      },
      tech: {
        isOpenSource: input.isOpenSource,
        license:      input.license,
        stack:        input.techStack,
      },
      integrations: {
        usesFeeProxy: input.usesFeeProxy,
        hasMCPServer: input.hasMCPServer,
        hasAPI:       input.hasAPI,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        atomLabel,
        completeness: completenessResult.percentage,
        suggestions: completenessResult.suggestions,
        instructions: [
          '1. Connect wallet on Intuition Testnet (Chain ID 13579)',
          '2. Use the AgentScore IntuForge registration flow or existing app helpers so createAtom/createTriple route through FeeProxy',
          '3. Fund the wallet with tTRUST for protocol costs, initial stake, and the FeeProxy platform fee',
          '4. Create the project atom from atomLabel, then tag it with [termId] [is] [Intuition Project] via FeeProxy',
          '5. Optionally create category/metadata triples through the same FeeProxy-backed flow',
          '6. Your project will appear on IntuForge after indexer sync (~30s)',
        ],
        network: 'testnet',
      },
    })
  } catch (error) {
    console.error('[API] POST /forge/projects error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
