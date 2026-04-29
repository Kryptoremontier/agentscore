import { getEvaluators } from '@/lib/api-data'
import type { EvaluatorProfile } from '@/lib/evaluator-score'
import { EvaluatorsClient } from '@/components/evaluators/EvaluatorsClient'

export const revalidate = 300

export default async function EvaluatorsPage() {
  const rows = await getEvaluators({ limit: 50 })

  const profiles: EvaluatorProfile[] = rows.map(r => ({
    address: r.address,
    evaluatorTier: r.tier,
    adjustedAccuracy: r.adjustedAccuracy,
    rawAccuracy: r.accuracy,
    evaluatorWeight: r.evaluatorWeight,
    rawEvaluatorWeight: r.rawEvaluatorWeight,
    totalPositions: r.totalEvaluations,
    goodPicks: r.correctEvaluations,
    streakCount: r.streakCount,
    bestPick: r.bestPick ?? null,
    worstPick: null,
    confidence: 0,
    meetsAttestationThreshold: r.meetsAttestationThreshold ?? null,
    attestationCount: r.attestationCount,
    walletPNL: r.walletPNL ?? undefined,
  }))

  return <EvaluatorsClient initialData={profiles} />
}
