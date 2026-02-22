import type { TrustLevel } from '@/types/agent'
import type { GraphQLAtom, GraphQLTriple } from '@/lib/graphql'

export interface TrustFlowSnapshot {
  buySupportWei?: bigint
  sellSupportWei?: bigint
  buyOpposeWei?: bigint
  sellOpposeWei?: bigint
}

export interface TrustScoreConfig {
  confidenceTauTtrust: number
  momentumScale: number
  maxMomentumPoints: number
  minMomentumPointsWhenLowLiquidity: number
}

export interface TrustScoreResult {
  score: number
  level: TrustLevel
  baseScore: number
  anchoredScore: number
  confidence: number
  momentum: number
  supportStake: bigint
  opposeStake: bigint
  netStake: bigint
  totalStake: bigint
}

export interface TrustStakeSummary {
  supportStake: bigint
  opposeStake: bigint
  supportStakers: Set<string>
  opposeStakers: Set<string>
}

const SUPPORT_PREDICATES = new Set([
  'trusts',
  'verified_by',
  'vouches_for',
  'trustworthy',
  'is_trustworthy',
])

const OPPOSE_PREDICATES = new Set([
  'distrusts',
  'reported_for_scam',
  'reported_for_spam',
  'reported_for_injection',
  'untrustworthy',
  'is_untrustworthy',
])

const IS_TESTNET = process.env.NEXT_PUBLIC_CHAIN_ENV !== 'mainnet'

export const TRUST_SCORE_DEFAULTS: TrustScoreConfig = {
  // tau controls how much TVL is needed before score moves away from 50.
  // Testnet stakes are 0.01–1 tTRUST, mainnet will be 10–1000+.
  confidenceTauTtrust: IS_TESTNET ? 0.1 : 50,
  momentumScale: 30,
  maxMomentumPoints: 8,
  minMomentumPointsWhenLowLiquidity: 2,
}

export function isSupportPredicate(label: string): boolean {
  return SUPPORT_PREDICATES.has(label.toLowerCase())
}

export function isOpposePredicate(label: string): boolean {
  return OPPOSE_PREDICATES.has(label.toLowerCase())
}

export function summarizeTrustStakes(
  atom: GraphQLAtom,
  opposeVaultShares?: bigint
): TrustStakeSummary {
  // Atom vault = base support signal (direct stakers on the agent atom)
  let supportStake = parseBigIntSafe(atom.vault?.totalShares)
  let opposeStake = opposeVaultShares ?? BigInt(0)
  const supportStakers = new Set<string>()
  const opposeStakers = new Set<string>()

  atom.vault?.positions?.forEach(position => {
    supportStakers.add(position.user.address.toLowerCase())
  })

  // Subject triples add secondary support/oppose signals
  // (attestation triples like "trusts", "distrusts", "reported_for_*")
  atom.subjectTriples?.forEach(triple => {
    const label = triple.predicate.label
    const stake = parseBigIntSafe(triple.vault.totalShares)

    if (isSupportPredicate(label)) {
      supportStake += stake
      triple.vault.positions?.forEach(position => {
        supportStakers.add(position.user.address.toLowerCase())
      })
      return
    }

    if (isOpposePredicate(label)) {
      opposeStake += stake
      triple.vault.positions?.forEach(position => {
        opposeStakers.add(position.user.address.toLowerCase())
      })
    }
  })

  return { supportStake, opposeStake, supportStakers, opposeStakers }
}

export function calculateTrustScoreFromStakes(
  supportStake: bigint,
  opposeStake: bigint,
  flow: TrustFlowSnapshot = {},
  config: TrustScoreConfig = TRUST_SCORE_DEFAULTS
): TrustScoreResult {
  const totalStake = supportStake + opposeStake
  const baseScore = totalStake > BigInt(0)
    ? Number((supportStake * BigInt(10000)) / totalStake) / 100
    : 50

  const totalStakeTtrust = weiToTtrust(totalStake)
  const confidence = 1 - Math.exp(-totalStakeTtrust / config.confidenceTauTtrust)
  const anchoredScore = 50 + (baseScore - 50) * confidence

  const signedFlowWei =
    (flow.buySupportWei ?? BigInt(0)) -
    (flow.sellSupportWei ?? BigInt(0)) -
    (flow.buyOpposeWei ?? BigInt(0)) +
    (flow.sellOpposeWei ?? BigInt(0))

  const normalizedFlow = totalStakeTtrust > 0
    ? weiToTtrust(signedFlowWei) / totalStakeTtrust
    : 0

  const rawMomentum = config.momentumScale * normalizedFlow
  const momentumCap = Math.max(
    config.minMomentumPointsWhenLowLiquidity,
    config.maxMomentumPoints * confidence
  )
  const momentum = clamp(rawMomentum, -momentumCap, momentumCap)

  const score = clamp(Math.round(anchoredScore + momentum), 0, 100)
  const level = getTrustLevel(score)

  return {
    score,
    level,
    baseScore,
    anchoredScore,
    confidence,
    momentum,
    supportStake,
    opposeStake,
    netStake: supportStake - opposeStake,
    totalStake,
  }
}

export function calculateAgentTrustScore(
  atom: GraphQLAtom,
  flow: TrustFlowSnapshot = {},
  config: TrustScoreConfig = TRUST_SCORE_DEFAULTS,
  opposeVaultShares?: bigint
): TrustScoreResult {
  const summary = summarizeTrustStakes(atom, opposeVaultShares)
  return calculateTrustScoreFromStakes(summary.supportStake, summary.opposeStake, flow, config)
}

export function countReportedTriples(subjectTriples?: GraphQLTriple[]): number {
  if (!subjectTriples) return 0
  return subjectTriples.filter(triple =>
    triple.predicate.label.toLowerCase().includes('reported')
  ).length
}

function parseBigIntSafe(value?: string): bigint {
  if (!value) return BigInt(0)
  try {
    return BigInt(value)
  } catch {
    return BigInt(0)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function weiToTtrust(wei: bigint): number {
  return Number(wei) / 1e18
}

function getTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'moderate'
  if (score >= 30) return 'low'
  return 'critical'
}
