import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getEvaluators } from '@/lib/api-data'
import type { EvaluatorTier } from '@/lib/evaluator-score'

const VALID_TIERS: EvaluatorTier[] = ['newcomer', 'scout', 'analyst', 'oracle', 'sage']

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams

    const minAccuracy = parseFloat(sp.get('minAccuracy') || '0')
    if (isNaN(minAccuracy) || minAccuracy < 0 || minAccuracy > 1) {
      return apiError('minAccuracy must be a number between 0 and 1', 400)
    }

    const limit = Math.min(parseInt(sp.get('limit') || '50'), 100)

    let tiers: EvaluatorTier[] | undefined
    const tiersParam = sp.get('tier')
    if (tiersParam) {
      tiers = tiersParam.split(',').map(t => t.trim()) as EvaluatorTier[]
      const invalid = tiers.filter(t => !VALID_TIERS.includes(t))
      if (invalid.length > 0) {
        return apiError(`Invalid tier(s): ${invalid.join(', ')}. Use: ${VALID_TIERS.join(', ')}`, 400)
      }
    }

    const evaluators = await getEvaluators({ minAccuracy, tiers, limit })
    return apiSuccess(evaluators, { total: evaluators.length })
  } catch (error) {
    console.error('[API] /evaluators error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
