import { getEvaluators } from '@/lib/api-data'
import type { EvaluatorProfile } from '@/lib/evaluator-score'
import { EvaluatorsClient } from '@/components/evaluators/EvaluatorsClient'

// Dynamic, over the shared evaluator-leaderboard cache (lib/server-cache.ts: complete reads only,
// 300 s). Page-level ISR would store a failed read's page for five minutes.
export const dynamic = 'force-dynamic'

export default async function EvaluatorsPage() {
  // A failed read is its own state, never an empty leaderboard (REPO_MAP §7 rule 5).
  const rows = await getEvaluators({ limit: 50 }).catch((err) => {
    console.error('[evaluators] leaderboard read failed:', err)
    return null
  })
  if (!rows) return <EvaluatorsClient initialData={null} />

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
