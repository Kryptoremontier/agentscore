import { type NextRequest } from 'next/server'
import { apiSuccess, corsOptions, withReadLedger } from '@/lib/api-helpers'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'

async function handleGET(_request: NextRequest) {
  return apiSuccess({
    name: 'AgentScore Trust API',
    version: 'v1',
    network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
    documentation: '/docs#smart-contracts',
    endpoints: API_V1_ENDPOINTS,
  })
}

export async function OPTIONS() {
  return corsOptions()
}

// One read ledger per request: meta.dataAgeSeconds (lib/server-cache.ts).
export const GET = withReadLedger(handleGET)
