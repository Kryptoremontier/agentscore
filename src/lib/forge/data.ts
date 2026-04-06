/**
 * IntuForge data layer.
 *
 * - serializeForgeProject: JSON label for on-chain atom (shared client+server)
 * - fetchForgeProjectsFromChain: query Hasura for real projects (server-side)
 * - fetchForgeProjectById: single project by term_id (server-side)
 *
 * Follows the same patterns as api-data.ts (Hasura dialect).
 * Does NOT modify AgentScore scoring or transform functions.
 */

import { APP_CONFIG } from '@/lib/app-config'
import { calculateForgeTrustScore, buildSparkline } from '@/lib/forge/scoring'
import { calculateForgeCompleteness } from '@/lib/forge/completeness'
import { ForgeCategory, ProjectStage, FORGE_CATEGORY_LABELS } from '@/lib/forge/types'
import type { ForgeProject, ForgeProjectRegistrationInput } from '@/lib/forge/types'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

// ─── Serialization ─────────────────────────────────────────────────────────────

/**
 * Serialize ForgeProject registration input to a JSON atom label.
 * Same format used by the API POST /api/v1/forge/projects route.
 * Callable client-side.
 */
export function serializeForgeProject(input: ForgeProjectRegistrationInput): string {
  return JSON.stringify({
    type:        'IntuitionProject',
    name:        input.name,
    tagline:     input.tagline,
    description: input.description,
    category:    input.category,
    stage:       input.stage,
    links: {
      website: input.website  || undefined,
      github:  input.github   || undefined,
      twitter: input.twitter  || undefined,
      discord: input.discord  || undefined,
      demo:    input.demo     || undefined,
    },
    team: {
      size:        input.teamSize,
      isAnonymous: input.isAnonymous,
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
}

// ─── Parsing ────────────────────────────────────────────────────────────────────

function safeCategory(raw: unknown): ForgeCategory {
  return Object.values(ForgeCategory).includes(raw as ForgeCategory)
    ? (raw as ForgeCategory)
    : ForgeCategory.OTHER
}

function safeStage(raw: unknown): ProjectStage {
  return Object.values(ProjectStage).includes(raw as ProjectStage)
    ? (raw as ProjectStage)
    : ProjectStage.IDEA
}

function parseForgeAtomLabel(label: string): Partial<ForgeProjectRegistrationInput> | null {
  try {
    const parsed = JSON.parse(label)
    if (parsed.type !== 'IntuitionProject') return null
    return {
      name:        parsed.name        || '',
      tagline:     parsed.tagline     || '',
      description: parsed.description || '',
      category:    safeCategory(parsed.category),
      stage:       safeStage(parsed.stage),
      website:     parsed.links?.website,
      github:      parsed.links?.github,
      twitter:     parsed.links?.twitter,
      discord:     parsed.links?.discord,
      demo:        parsed.links?.demo,
      teamSize:    parsed.team?.size,
      isAnonymous: !!parsed.team?.isAnonymous,
      isOpenSource:!!parsed.tech?.isOpenSource,
      license:     parsed.tech?.license,
      techStack:   Array.isArray(parsed.tech?.stack) ? parsed.tech.stack : [],
      usesFeeProxy:!!parsed.integrations?.usesFeeProxy,
      hasMCPServer:!!parsed.integrations?.hasMCPServer,
      hasAPI:      !!parsed.integrations?.hasAPI,
    }
  } catch {
    return null
  }
}

// ─── GraphQL ────────────────────────────────────────────────────────────────────

interface RawForgeAtom {
  term_id: string
  label: string
  created_at: string
  account: { address: string } | null
  vault: {
    position_count: number
    positions_aggregate: {
      aggregate: { sum: { shares: string | null } | null } | null
    }
    current_share_price: string | null
  } | null
  as_subject_triples: Array<{
    term_id: string
    counter_term_id: string
  }>
}

async function gql<T>(query: string): Promise<T | null> {
  if (!GRAPHQL_URL) return null
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.data as T) ?? null
  } catch (err) {
    console.error('[forge/data] GraphQL error:', err)
    return null
  }
}

function atomToForgeProject(atom: RawForgeAtom): ForgeProject | null {
  const meta = parseForgeAtomLabel(atom.label)
  if (!meta || !meta.name) return null

  const supportWei = BigInt(atom.vault?.positions_aggregate?.aggregate?.sum?.shares || '0')
  const uniqueStakers = atom.vault?.position_count || 0
  const currentPrice = parseFloat(atom.vault?.current_share_price || '0') / 1e18

  const completenessInput: ForgeProjectRegistrationInput = {
    name:         meta.name        ?? '',
    tagline:      meta.tagline     ?? '',
    description:  meta.description ?? '',
    category:     safeCategory(meta.category),
    stage:        safeStage(meta.stage),
    website:      meta.website,
    github:       meta.github,
    twitter:      meta.twitter,
    discord:      meta.discord,
    demo:         meta.demo,
    teamSize:     meta.teamSize,
    isAnonymous:  meta.isAnonymous  ?? false,
    isOpenSource: meta.isOpenSource ?? false,
    license:      meta.license,
    techStack:    meta.techStack    ?? [],
    usesFeeProxy: meta.usesFeeProxy ?? false,
    hasMCPServer: meta.hasMCPServer ?? false,
    hasAPI:       meta.hasAPI       ?? false,
  }

  const completeness = calculateForgeCompleteness(completenessInput).percentage

  const scoring = calculateForgeTrustScore({
    supportStakeWei: supportWei,
    opposeStakeWei:  0n,
    uniqueStakers,
    currentPrice,
    peakPrice: Math.max(currentPrice, 1),
    stableDays: 0,
  })

  const counterTermId = atom.as_subject_triples?.[0]?.counter_term_id ?? null

  return {
    id:                atom.term_id,
    atomId:            atom.term_id,
    registeredAt:      atom.created_at,
    registrantAddress: atom.account?.address ?? '0x0000000000000000000000000000000000000000',
    name:              completenessInput.name,
    tagline:           completenessInput.tagline,
    description:       completenessInput.description,
    category:          completenessInput.category,
    stage:             completenessInput.stage,
    website:           completenessInput.website,
    github:            completenessInput.github,
    twitter:           completenessInput.twitter,
    discord:           completenessInput.discord,
    demo:              completenessInput.demo,
    teamSize:          completenessInput.teamSize,
    isAnonymous:       completenessInput.isAnonymous,
    isOpenSource:      completenessInput.isOpenSource,
    license:           completenessInput.license,
    techStack:         completenessInput.techStack ?? [],
    usesFeeProxy:      completenessInput.usesFeeProxy,
    hasMCPServer:      completenessInput.hasMCPServer,
    hasAPI:            completenessInput.hasAPI,
    completeness,
    trustScore:        scoring.trustScore,
    compositeScore:    scoring.compositeScore,
    finalScore:        scoring.finalScore,
    stakerCount:       uniqueStakers,
    totalStaked:       Number(supportWei) / 1e18,
    evaluatorCount:    0,
    momentum:          scoring.momentum,
    sparklineData:     buildSparkline([scoring.finalScore]),
    intuitionAtoms:    [],
    counterTermId,
  }
}

// Category label → FORGE_CATEGORY_LABELS lookup (used by categorylabel filtering)
export function getCategoryLabel(category: ForgeCategory): string {
  return FORGE_CATEGORY_LABELS[category]
}

// ─── Public API ─────────────────────────────────────────────────────────────────

const FORGE_ATOM_QUERY_FIELDS = `
  term_id
  label
  created_at
  account { address }
  vault {
    position_count
    positions_aggregate { aggregate { sum { shares } } }
    current_share_price
  }
  as_subject_triples(
    where: {
      predicate: { label: { _eq: "is" } }
      object: { label: { _eq: "Intuition Project" } }
    }
    limit: 1
  ) {
    term_id
    counter_term_id
  }
`

/**
 * Fetch all IntuForge projects registered on-chain.
 * Returns empty array if GraphQL is unavailable — callers should fall back to MOCK_PROJECTS.
 */
export async function fetchForgeProjectsFromChain(limit = 100): Promise<ForgeProject[]> {
  const data = await gql<{ atoms: RawForgeAtom[] }>(`
    {
      atoms(
        where: { label: { _ilike: "%\\"type\\":\\"IntuitionProject\\"%" } }
        order_by: { vault: { position_count: desc_nulls_last } }
        limit: ${limit}
      ) {
        ${FORGE_ATOM_QUERY_FIELDS}
      }
    }
  `)

  if (!data?.atoms?.length) return []

  const projects: ForgeProject[] = []
  for (const atom of data.atoms) {
    const p = atomToForgeProject(atom)
    if (p) projects.push(p)
  }
  return projects
}

/**
 * Fetch a single IntuForge project by its atom term_id.
 * Returns null if not found or not a forge project atom.
 */
export async function fetchForgeProjectById(id: string): Promise<ForgeProject | null> {
  if (!id || !id.startsWith('0x')) return null

  const data = await gql<{ atoms: RawForgeAtom[] }>(`
    {
      atoms(
        where: { term_id: { _eq: "${id}" } }
        limit: 1
      ) {
        ${FORGE_ATOM_QUERY_FIELDS}
      }
    }
  `)

  const atom = data?.atoms?.[0]
  if (!atom) return null
  return atomToForgeProject(atom)
}
