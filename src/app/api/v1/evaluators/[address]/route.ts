import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getEvaluatorProfile } from '@/lib/api-data'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    if (!address) return apiError('Address is required', 400)

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return apiError('Invalid Ethereum address format', 400)
    }

    const profile = await getEvaluatorProfile(address.toLowerCase())
    if (!profile) return apiError('Evaluator not found or has no positions', 404)

    return apiSuccess(profile)
  } catch (error) {
    console.error('[API] /evaluators/:address error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
