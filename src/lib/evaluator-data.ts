/**
 * Evaluator Data — GraphQL fetching for staker position history.
 *
 * Fetches all agent positions for a wallet and maps them to StakerPosition
 * objects used by the evaluator score engine.
 *
 * Schema note: Hasura-style GraphQL at NEXT_PUBLIC_GRAPHQL_URL
 *   positions.term_id      = which vault (support = atom.term_id)
 *   positions.account_id   = staker wallet
 *   positions.shares       = bigint as decimal string
 *   atom.as_subject_triples[0].counter_term_id = oppose vault term_id
 *
 * For PoC we track SUPPORT positions only (staker backed an agent).
 * Oppose position tracking is a future enhancement.
 */

import { APP_CONFIG } from './app-config'
import { AGENT_WHERE_STR, AGENT_VAULT_POSITION_STR } from './gql-filters'
import { calculateEvaluatorScore, type StakerPosition, type EvaluatorProfile } from './evaluator-score'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL
const TRUST_PREDICATE_ID = '0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba'
const FEE_PROXY_LC = '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41'

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data as T
}

function cleanName(label: string): string {
  return label.replace(/^(INTU:|Agent:|Skill:)/i, '').trim()
}

/**
 * Fetch all agent positions for a wallet.
 *
 * Returns StakerPosition[] ready for calculateEvaluatorScore().
 *
 * Approach (2 queries):
 *  1. Fetch agent atoms where this wallet has support positions
 *  2. Batch-fetch oppose vault shares for trust ratio calculation
 */
export async function fetchStakerPositions(
  walletAddress: string,
): Promise<StakerPosition[]> {
  if (!walletAddress) return []

  try {
    const wallet = walletAddress.toLowerCase()

    // Query 1: Agent atoms where wallet has support positions
    type AtomRow = {
      term_id: string
      label: string
      creator: { id: string } | null
      positions_aggregate: { aggregate: { sum: { shares: string | null } | null } }
      as_subject_triples: Array<{ counter_term_id: string }>
    }

    const data = await gql<{ atoms: AtomRow[] }>(`
      query StakerSupportPositions {
        atoms(
          where: {
            _and: [
              ${AGENT_WHERE_STR}
              { vault: { positions: { account_id: { _ilike: "${wallet}" } shares: { _gt: "0" } } } }
            ]
          }
          limit: 100
        ) {
          term_id
          label
          creator { id }
          positions_aggregate {
            aggregate { sum { shares } }
          }
          as_subject_triples(
            where: { predicate_id: { _eq: "${TRUST_PREDICATE_ID}" } }
            limit: 1
          ) { counter_term_id }
        }
      }
    `)

    const atoms = data?.atoms || []
    if (atoms.length === 0) return []

    // Query 2: Batch-fetch oppose vault shares for trust ratio
    const counterTermIds = atoms
      .map(a => a.as_subject_triples?.[0]?.counter_term_id)
      .filter((id): id is string => !!id)

    const opposeMap = new Map<string, bigint>()
    if (counterTermIds.length > 0) {
      try {
        const opposeData = await gql<{ positions: Array<{ term_id: string; shares: string }> }>(`
          {
            positions(where: { term_id: { _in: ${JSON.stringify(counterTermIds)} } shares: { _gt: "0" } }) {
              term_id
              shares
            }
          }
        `)
        for (const pos of opposeData?.positions ?? []) {
          const prev = opposeMap.get(pos.term_id) || 0n
          try { opposeMap.set(pos.term_id, prev + BigInt(pos.shares)) } catch { /* skip */ }
        }
      } catch { /* non-critical */ }
    }

    // Map atoms to StakerPosition[]
    return atoms.map(atom => {
      const supportWei = (() => {
        try { return BigInt(atom.positions_aggregate?.aggregate?.sum?.shares || '0') } catch { return 0n }
      })()

      const ctid = atom.as_subject_triples?.[0]?.counter_term_id
      const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n

      const totalWei = supportWei + opposeWei
      const trustScore = totalWei > 0n
        ? Math.round(Number(supportWei * 100n / totalWei))
        : 50

      return {
        agentAtomId: atom.term_id,
        agentName: cleanName(atom.label || 'Unknown'),
        side: 'support' as const,
        currentTrustScore: trustScore,
        // FeeProxy is creator_id for all atoms — always false for real users
        isCreator: atom.creator?.id?.toLowerCase() === wallet &&
                   atom.creator?.id?.toLowerCase() !== FEE_PROXY_LC,
      } satisfies StakerPosition
    })
  } catch (error) {
    console.warn('[fetchStakerPositions] Failed:', error)
    return []
  }
}

/**
 * Fetch all evaluator profiles for the leaderboard.
 *
 * Strategy (efficient — 2 queries total):
 *  1. Fetch all agent atom positions (up to 1500) with atom info
 *  2. Group by account_id, compute evaluator score for each
 *
 * Returns sorted by adjustedAccuracy desc, limited to top 50.
 */
export async function fetchEvaluatorLeaderboard(): Promise<EvaluatorProfile[]> {
  try {
    type PosRow = {
      account_id: string
      shares: string
      term_id: string
      vault: {
        term: {
          atom: {
            term_id: string
            label: string
            creator: { id: string } | null
            positions_aggregate: { aggregate: { sum: { shares: string | null } | null } }
            as_subject_triples: Array<{ counter_term_id: string }>
          } | null
        } | null
      } | null
    }

    const data = await gql<{ positions: PosRow[] }>(`
      {
        positions(
          where: { ${AGENT_VAULT_POSITION_STR} }
          limit: 1500
        ) {
          account_id
          shares
          term_id
          vault {
            term {
              atom {
                term_id
                label
                creator { id }
                positions_aggregate {
                  aggregate { sum { shares } }
                }
                as_subject_triples(
                  where: { predicate_id: { _eq: "${TRUST_PREDICATE_ID}" } }
                  limit: 1
                ) { counter_term_id }
              }
            }
          }
        }
      }
    `)

    const positions = data?.positions || []

    // Collect all counter_term_ids to batch-fetch oppose shares
    const counterTermIdSet = new Set<string>()
    for (const p of positions) {
      const ctid = p.vault?.term?.atom?.as_subject_triples?.[0]?.counter_term_id
      if (ctid) counterTermIdSet.add(ctid)
    }

    // Fetch oppose vault shares
    const opposeMap = new Map<string, bigint>()
    if (counterTermIdSet.size > 0) {
      try {
        const counterIds = Array.from(counterTermIdSet)
        const opposeData = await gql<{ positions: Array<{ term_id: string; shares: string }> }>(`
          {
            positions(where: { term_id: { _in: ${JSON.stringify(counterIds)} } shares: { _gt: "0" } }) {
              term_id shares
            }
          }
        `)
        for (const op of opposeData?.positions ?? []) {
          const prev = opposeMap.get(op.term_id) || 0n
          try { opposeMap.set(op.term_id, prev + BigInt(op.shares)) } catch { /* skip */ }
        }
      } catch { /* non-critical */ }
    }

    // Group positions by account_id, build StakerPosition[] per account
    const accountPositions = new Map<string, StakerPosition[]>()

    for (const p of positions) {
      const acct = p.account_id?.toLowerCase()
      if (!acct || acct === FEE_PROXY_LC) continue
      if (!p.shares || BigInt(p.shares || '0') <= 0n) continue

      const atom = p.vault?.term?.atom
      if (!atom) continue

      const supportWei = (() => {
        try { return BigInt(atom.positions_aggregate?.aggregate?.sum?.shares || '0') } catch { return 0n }
      })()

      const ctid = atom.as_subject_triples?.[0]?.counter_term_id
      const opposeWei = ctid ? (opposeMap.get(ctid) || 0n) : 0n
      const totalWei = supportWei + opposeWei
      const trustScore = totalWei > 0n
        ? Math.round(Number(supportWei * 100n / totalWei))
        : 50

      const isCreator =
        !!atom.creator?.id &&
        atom.creator.id.toLowerCase() === acct &&
        atom.creator.id.toLowerCase() !== FEE_PROXY_LC

      const stakerPos: StakerPosition = {
        agentAtomId: atom.term_id,
        agentName: cleanName(atom.label || 'Unknown'),
        side: 'support',
        currentTrustScore: trustScore,
        isCreator,
      }

      if (!accountPositions.has(acct)) accountPositions.set(acct, [])
      // Deduplicate by atom (keep only one position per agent per account)
      const existing = accountPositions.get(acct)!
      if (!existing.find(ep => ep.agentAtomId === stakerPos.agentAtomId)) {
        existing.push(stakerPos)
      }
    }

    // Calculate evaluator score for each account
    const profiles: EvaluatorProfile[] = []
    for (const [address, stakerPositions] of accountPositions) {
      const profile = calculateEvaluatorScore(address, stakerPositions)
      if (profile.totalPositions > 0) {
        profiles.push(profile)
      }
    }

    // Sort by adjusted accuracy desc, then by totalPositions desc (tiebreak)
    return profiles
      .sort((a, b) =>
        b.adjustedAccuracy !== a.adjustedAccuracy
          ? b.adjustedAccuracy - a.adjustedAccuracy
          : b.totalPositions - a.totalPositions
      )
      .slice(0, 50)
  } catch (error) {
    console.warn('[fetchEvaluatorLeaderboard] Failed:', error)
    return []
  }
}
