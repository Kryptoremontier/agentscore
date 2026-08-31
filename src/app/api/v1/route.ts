import { type NextRequest } from 'next/server'
import { apiSuccess, corsOptions } from '@/lib/api-helpers'
import { API_V1_ENDPOINTS } from '@/lib/api-endpoints'

export async function GET(_request: NextRequest) {
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
