/**
 * Attestation Gate — Layer 7 of anti-manipulation.
 *
 * evaluatorWeight ABOVE 1.0x requires inbound attestation triples
 * from N distinct wallets in the Intuition knowledge graph.
 *
 * Without sufficient attestations: weight CAPPED at 1.0x.
 * Staking still allowed (free market) — but no reputation amplifier.
 *
 * Design principle: protocol-native, no backend state, fully verifiable.
 * Anyone can independently query the same data and reach the same result.
 *
 * Schema note (Intuition testnet Hasura):
 *   triples.object.creator.id = checksummed wallet address of atom creator
 *   We match via _ilike for case-insensitive exact comparison.
 *   Attestation = inbound triple where object.creator.id = evaluator wallet
 *   Self-attestation excluded (subject.creator.id ≠ evaluator wallet).
 *
 * CONFIGURABLE PREDICATES:
 *   Testnet: accept ANY inbound triple from distinct wallet (low bar, limited data)
 *   Mainnet: narrow to specific predicates ("trust", "endorses")
 */

import { APP_CONFIG } from './app-config'

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AttestationConfig {
  /**
   * Minimum distinct wallets that attested this evaluator.
   * Testnet: 1 (low bar — test mechanics only)
   * Mainnet launch: 3
   * Mainnet mature: 5–10
   */
  minAttestations: number

  /**
   * Which predicates count as attestation.
   * Empty array = ANY inbound triple counts (testnet mode).
   * ['trust', 'endorses'] = only meaningful social predicates (mainnet).
   */
  acceptedPredicates: string[]

  /**
   * If true: attestor must itself have ≥1 attestation (recursive depth 1).
   * Prevents sybil from attesting other sybils.
   * Testnet: false (too restrictive with sparse data).
   * Mainnet: true.
   */
  requireAttestedAttestors: boolean
}

export const ATTESTATION_CONFIG_TESTNET: AttestationConfig = {
  minAttestations: 1,
  acceptedPredicates: [],  // any inbound triple
  requireAttestedAttestors: false,
}

export const ATTESTATION_CONFIG_MAINNET: AttestationConfig = {
  minAttestations: 3,
  acceptedPredicates: ['trust', 'endorses'],
  requireAttestedAttestors: true,
}

export function getAttestationConfig(): AttestationConfig {
  const isMainnet = process.env.NEXT_PUBLIC_CHAIN_ID !== '13579'
  return isMainnet ? ATTESTATION_CONFIG_MAINNET : ATTESTATION_CONFIG_TESTNET
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttestationResult {
  walletAddress: string       // lowercase
  attestationCount: number    // distinct wallets that attested
  attestors: string[]         // list of attestor wallet addresses (lowercase)
  meetsThreshold: boolean     // attestationCount >= config.minAttestations
  config: AttestationConfig
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const attestationCache = new Map<string, { result: AttestationResult; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

function getCached(wallet: string): AttestationResult | null {
  const key = wallet.toLowerCase()
  const entry = attestationCache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.result
  return null
}

function setCache(wallet: string, result: AttestationResult): void {
  attestationCache.set(wallet.toLowerCase(), { result, ts: Date.now() })
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Query inbound attestation triples for a single wallet.
 *
 * Counts distinct wallets that created triples pointing to ANY atom
 * created by this wallet. Self-attestation excluded.
 *
 * Uses _ilike for case-insensitive matching against checksummed DB values.
 */
export async function getAttestationCount(
  walletAddress: string,
  config?: AttestationConfig,
): Promise<AttestationResult> {
  const cfg = config ?? getAttestationConfig()
  const wallet = walletAddress.toLowerCase()

  // Check cache first
  const cached = getCached(wallet)
  if (cached) return cached

  const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

  const empty: AttestationResult = {
    walletAddress: wallet,
    attestationCount: 0,
    attestors: [],
    meetsThreshold: false,
    config: cfg,
  }

  try {
    // Build optional predicate filter
    let predicateFilter = ''
    if (cfg.acceptedPredicates.length > 0) {
      const list = cfg.acceptedPredicates.map(p => `"${p}"`).join(', ')
      predicateFilter = `predicate: { label: { _in: [${list}] } }`
    }

    // Query: inbound triples where object is an atom created by this wallet.
    // Uses _ilike for case-insensitive exact match (no wildcards).
    // This covers wallet atoms AND any other atoms the evaluator created.
    const query = `
      {
        triples(
          where: {
            object: { creator: { id: { _ilike: "${wallet}" } } }
            ${predicateFilter}
          }
          limit: 500
        ) {
          subject { creator { id } }
        }
      }
    `

    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    })

    const json = await res.json()

    if (json.errors || !json.data?.triples) {
      console.warn('[attestation-gate] GraphQL error for', wallet, json.errors)
      setCache(wallet, empty)
      return empty
    }

    const triples: Array<{ subject: { creator: { id: string } | null } | null }> =
      json.data.triples

    // Deduplicate by creator wallet — each attestor counted once
    const attestorSet = new Set<string>()
    for (const triple of triples) {
      const creatorId = triple.subject?.creator?.id
      if (!creatorId) continue
      const creatorLc = creatorId.toLowerCase()
      if (creatorLc === wallet) continue  // skip self-attestation
      attestorSet.add(creatorLc)
    }

    const attestors = Array.from(attestorSet)

    // Phase D placeholder: recursive attestor verification
    // (requireAttestedAttestors = true) skipped for now — implement in Phase D
    const validAttestors = attestors

    const result: AttestationResult = {
      walletAddress: wallet,
      attestationCount: validAttestors.length,
      attestors: validAttestors,
      meetsThreshold: validAttestors.length >= cfg.minAttestations,
      config: cfg,
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[attestation-gate] ${wallet.slice(0, 8)}…: ` +
        `attestationCount=${result.attestationCount}, ` +
        `meetsThreshold=${result.meetsThreshold}`,
      )
    }

    setCache(wallet, result)
    return result

  } catch (error) {
    console.error('[attestation-gate] Error fetching for', wallet, error)
    setCache(wallet, empty)
    return empty
  }
}

/**
 * Batch-fetch attestation counts for multiple wallets.
 * Runs N queries in parallel (acceptable on testnet; cache limits cost on mainnet).
 * Returns a Map keyed by lowercase wallet address.
 */
export async function batchGetAttestationCounts(
  walletAddresses: string[],
  config?: AttestationConfig,
): Promise<Map<string, AttestationResult>> {
  const cfg = config ?? getAttestationConfig()
  const results = await Promise.all(
    walletAddresses.map(w => getAttestationCount(w, cfg)),
  )
  const map = new Map<string, AttestationResult>()
  results.forEach(r => map.set(r.walletAddress, r))
  return map
}

// ─── Gate Application ─────────────────────────────────────────────────────────

/**
 * Apply attestation gate to evaluator weight.
 *
 * Rules:
 * - weight ≤ 1.0 (bad/neutral evaluator): always passes — punishment is unconditional
 * - weight > 1.0 (good evaluator): requires meetsThreshold=true to keep amplification
 *   otherwise capped at 1.0 (neutral, not punished)
 */
export function applyAttestationGate(
  evaluatorWeight: number,
  meetsThreshold: boolean,
): number {
  // Bad evaluators (weight ≤ 1.0) are always penalized — gate doesn't apply
  if (evaluatorWeight <= 1.0) return evaluatorWeight

  // Good evaluators need attestation to unlock amplification
  if (!meetsThreshold) return 1.0  // capped at neutral

  return evaluatorWeight  // full weight (up to 1.5x)
}
