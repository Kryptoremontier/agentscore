import { API } from './constants'

export async function graphqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  options?: RequestInit
): Promise<T> {
  const isTestnet = process.env.NEXT_PUBLIC_NETWORK === 'testnet'
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