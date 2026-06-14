import { API } from './constants'

export async function graphqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  options?: RequestInit
): Promise<T> {
  const network = process.env.NEXT_PUBLIC_NETWORK
  if (!network) {
    // Fail safe: a missing env var must never silently route to mainnet.
    console.warn(
      '[graphql-client] NEXT_PUBLIC_NETWORK not set — defaulting to TESTNET endpoint. ' +
        "Set NEXT_PUBLIC_NETWORK explicitly ('testnet' = Intuition Testnet; anything else = mainnet)."
    )
  }
  const isTestnet = network ? network === 'testnet' : true
  const endpoint = isTestnet ? API.graphql.testnet : API.graphql.mainnet

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    ...options,
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`)
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }

  return json.data
}