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
  data: string
  created_at: string
  creator: { id: string } | null
  positions_aggregate: {
    aggregate: { count: number; sum: { shares: string | null } | null } | null
  } | null
  // [x][is][Intuition Project] triple — used for counter_term_id (staking)
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
    const data = await res.json()
    if (data.errors) {
      console.error('[forge/data] GraphQL errors:', JSON.stringify(data.errors))
    }
    if (!res.ok || !data.data) return null
    return (data.data as T) ?? null
  } catch (err) {
    console.error('[forge/data] GraphQL fetch error:', err)
    return null
  }
}

// ─── Fix 1: Batch-fetch oppose vault shares ──────────────────────────────────

/**
 * Fetch total shares in oppose vaults for a list of counter_term_ids.
 * Same pattern as batchFetchOpposeShares() in api-data.ts.
 */
async function batchFetchForgeOpposeShares(
  counterTermIds: string[],
): Promise<Map<string, bigint>> {
  const map = new Map<string, bigint>()
  if (!counterTermIds.length) return map

  const data = await gql<{ positions: Array<{ term_id: string; shares: string }> }>(`
    {
      positions(
        where: {
          term_id: { _in: ${JSON.stringify(counterTermIds)} }
          shares: { _gt: "0" }
        }
      ) {
        term_id
        shares
      }
    }
  `)

  for (const pos of data?.positions ?? []) {
    const prev = map.get(pos.term_id) || 0n
    try { map.set(pos.term_id, prev + BigInt(pos.shares)) } catch { /* skip malformed */ }
  }
  return map
}

// ─── Fix 2: Individual positions for detail view ─────────────────────────────

interface ForgePositionRow {
  address: string
  sharesWei: string
}

/**
 * Fetch individual staker positions for a project (support + oppose vaults).
 * Used only in fetchForgeProjectById — too heavy for the list view.
 */
async function fetchForgeProjectPositions(
  atomId: string,
  counterTermId: string | null,
): Promise<{ support: ForgePositionRow[]; oppose: ForgePositionRow[] }> {
  const buildQuery = (termId: string) => `
    {
      positions(
        where: {
          term_id: { _eq: "${termId}" }
          shares: { _gt: "0" }
        }
        limit: 50
        order_by: { shares: desc }
      ) {
        account { id }
        shares
      }
    }
  `

  const toRows = (data: { positions: Array<{ account: { id: string }; shares: string }> } | null): ForgePositionRow[] =>
    (data?.positions ?? [])
      .map(p => ({ address: p.account?.id ?? '', sharesWei: p.shares }))
      .filter(p => p.address.length > 0)

  const [supportData, opposeData] = await Promise.all([
    gql<{ positions: Array<{ account: { id: string }; shares: string }> }>(buildQuery(atomId)),
    counterTermId
      ? gql<{ positions: Array<{ account: { id: string }; shares: string }> }>(buildQuery(counterTermId))
      : Promise.resolve(null),
  ])

  return {
    support: toRows(supportData),
    oppose:  toRows(opposeData),
  }
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function atomToForgeProject(
  atom: RawForgeAtom,
  opposeWei = 0n,
  positions?: { support: ForgePositionRow[]; oppose: ForgePositionRow[] },
): ForgeProject | null {
  const meta = parseForgeAtomLabel(atom.data)
  if (!meta?.name) return null

  const supportWei = (() => {
    try { return BigInt(atom.positions_aggregate?.aggregate?.sum?.shares || '0') } catch { return 0n }
  })()
  const uniqueStakers = atom.positions_aggregate?.aggregate?.count || 0

  // Fix 4: neutral price defaults for testnet (no historical price data)
  const currentPrice = 1
  const peakPrice    = 1

  // Fix 10: stableDays — how long supportRatio has been > 50%
  const totalWei    = supportWei + opposeWei
  const supportRatio = totalWei > 0n ? Number(supportWei * 100n / totalWei) : 50
  const daysActive  = Math.max(0, Math.floor((Date.now() - new Date(atom.created_at).getTime()) / 86_400_000))
  const stableDays  = supportRatio > 50 ? daysActive : 0

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

  // Fix 2: map positions to scoring format
  const supportPositions = (positions?.support ?? []).map(p => ({
    account_id: p.address,
    shares: (() => { try { return BigInt(p.sharesWei) } catch { return 0n } })(),
  }))
  const opposePositions = (positions?.oppose ?? []).map(p => ({
    account_id: p.address,
    shares: (() => { try { return BigInt(p.sharesWei) } catch { return 0n } })(),
  }))

  const scoring = calculateForgeTrustScore({
    supportStakeWei:  supportWei,
    opposeStakeWei:   opposeWei,  // Fix 1: real oppose
    uniqueStakers,
    currentPrice,
    peakPrice,
    stableDays,
    supportPositions,             // Fix 2: real positions → real diversity weight
    opposePositions,
  })

  const counterTermId = atom.as_subject_triples?.[0]?.counter_term_id ?? null

  return {
    id:                atom.term_id,
    atomId:            atom.term_id,
    registeredAt:      atom.created_at,
    registrantAddress: atom.creator?.id ?? '0x0000000000000000000000000000000000000000',
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
    opposeStaked:      Number(opposeWei) / 1e18,  // Fix 1
    evaluatorCount:    0,
    momentum:          scoring.momentum,
    sparklineData:     buildSparkline([scoring.finalScore]),
    daysActive,
    supportPositions:  positions?.support,
    opposePositions:   positions?.oppose,
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
  data
  created_at
  creator { id }
  positions_aggregate { aggregate { count sum { shares } } }
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
        where: {
          as_subject_triples: {
            predicate: { label: { _eq: "is" } }
            object: { label: { _eq: "Intuition Project" } }
          }
        }
        order_by: { created_at: desc }
        limit: ${limit}
      ) {
        ${FORGE_ATOM_QUERY_FIELDS}
      }
    }
  `)

  if (!data?.atoms?.length) return []

  // Fix 1: batch-fetch oppose vault shares for all projects in one query
  const counterTermIds = data.atoms
    .map(a => a.as_subject_triples?.[0]?.counter_term_id)
    .filter((id): id is string => !!id)
  const opposeMap = await batchFetchForgeOpposeShares(counterTermIds)

  const projects: ForgeProject[] = []
  for (const atom of data.atoms) {
    const ctid = atom.as_subject_triples?.[0]?.counter_term_id
    const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n
    const p = atomToForgeProject(atom, opposeWei)
    if (p) projects.push(p)
  }
  return projects
}

/**
 * Fetch a single IntuForge project by its atom term_id.
 * Includes individual positions for staker list + diversity weight.
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

  const ctid = atom.as_subject_triples?.[0]?.counter_term_id ?? null

  // Fix 1 + Fix 2: fetch oppose shares and individual positions in parallel
  const [opposeMap, positions] = await Promise.all([
    batchFetchForgeOpposeShares(ctid ? [ctid] : []),
    fetchForgeProjectPositions(id, ctid),
  ])

  const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n
  return atomToForgeProject(atom, opposeWei, positions)
}
