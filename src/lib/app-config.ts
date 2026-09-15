/**
 * AgentScore Platform Configuration
 *
 * All settings are driven by NEXT_PUBLIC_ environment variables so they can be
 * overridden per deployment without changing code.
 *
 * Create a `.env.local` file in the project root to override locally.
 * See `.env.local.example` for the full reference with explanations.
 */

import { intuitionMainnet, intuitionTestnet } from '@0xintuition/protocol'

// ── Network coherence guard ─────────────────────────────────────────────────
// Three independent env vars each imply a network, and nothing enforced they
// agreed before this: NEXT_PUBLIC_NETWORK is a display label only (API meta,
// logs — see PLATFORM_TAG below); NEXT_PUBLIC_GRAPHQL_URL alone decides what
// actually gets queried (this file); NEXT_PUBLIC_CHAIN_ID picks
// attestation-gate.ts's sybil-defense config. A silent mismatch means the UI
// SAYS one network while every read comes from another — exactly the risk
// the 2026-09-15 ERC-8004 recon flagged: Deep3 Labs' ~28.7k-agent publish
// landed on Intuition mainnet, a dataset this app has never queried, and
// flipping NEXT_PUBLIC_NETWORK alone would not have changed that — nor
// would anything have said so. Chain ids come from the SDK's own chain
// definitions (@0xintuition/protocol), not a second hand-maintained constant.
type NetworkLabel = 'testnet' | 'mainnet'

function inferNetworkFromGraphqlUrl(url: string): NetworkLabel | null {
  if (url.includes('testnet.intuition.sh')) return 'testnet'
  if (url.includes('mainnet.intuition.sh')) return 'mainnet'
  return null
}

function inferNetworkFromChainId(chainId: string | undefined): NetworkLabel | null {
  if (!chainId) return null
  if (chainId === String(intuitionTestnet.id)) return 'testnet'
  if (chainId === String(intuitionMainnet.id)) return 'mainnet'
  return null
}

/**
 * Throws when NEXT_PUBLIC_NETWORK, NEXT_PUBLIC_GRAPHQL_URL, and
 * NEXT_PUBLIC_CHAIN_ID don't all agree on the same network. A URL or chain id
 * this doesn't recognize (a local proxy, a future third network) is not
 * itself an error — only a RECOGNIZED, DISAGREEING value throws. Exported so
 * this can be exercised directly with explicit inputs, without reloading the
 * module per env-var combination.
 */
export function assertNetworkCoherence(network: string, graphqlUrl: string, chainId: string | undefined): void {
  const declared: NetworkLabel = network === 'mainnet' ? 'mainnet' : 'testnet'

  const urlNetwork = inferNetworkFromGraphqlUrl(graphqlUrl)
  if (urlNetwork && urlNetwork !== declared) {
    throw new Error(
      `[app-config] Network mismatch: NEXT_PUBLIC_NETWORK="${network}" but NEXT_PUBLIC_GRAPHQL_URL points at ` +
      `${urlNetwork} (${graphqlUrl}). Every read goes through this URL — fix one of the two env vars; ` +
      `don't ship a build that SAYS ${declared} and READS ${urlNetwork}.`
    )
  }

  const chainNetwork = inferNetworkFromChainId(chainId)
  if (chainNetwork && chainNetwork !== declared) {
    throw new Error(
      `[app-config] Network mismatch: NEXT_PUBLIC_NETWORK="${network}" but NEXT_PUBLIC_CHAIN_ID="${chainId}" is ` +
      `${chainNetwork} (testnet=${intuitionTestnet.id}, mainnet=${intuitionMainnet.id}). attestation-gate.ts picks ` +
      `its sybil-defense config from this value — a mismatch silently applies the wrong network's gating rules.`
    )
  }
}

// Runs once, at import time — a mismatch fails the build/boot immediately
// rather than reading the wrong network silently at runtime.
assertNetworkCoherence(
  process.env.NEXT_PUBLIC_NETWORK ?? 'testnet',
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'https://testnet.intuition.sh/v1/graphql',
  process.env.NEXT_PUBLIC_CHAIN_ID,
)

export const APP_CONFIG = {
  // ── GraphQL endpoint ────────────────────────────────────────────────────────
  GRAPHQL_URL: process.env.NEXT_PUBLIC_GRAPHQL_URL
    ?? 'https://testnet.intuition.sh/v1/graphql',

  // ── Platform label prefixes ─────────────────────────────────────────────────
  // These prefixes are prepended to atom labels on creation AND used to filter
  // data on read. Change them when launching on a new network to create a clean
  // separation from any previous data.
  //
  // Examples:
  //   NEXT_PUBLIC_AGENT_PREFIX=Agent:          → "Agent: My Bot"       (default)
  //   NEXT_PUBLIC_AGENT_PREFIX=Agent:alpha:    → "Agent:alpha: My Bot" (alpha tag)
  //   NEXT_PUBLIC_AGENT_PREFIX=Agent:v2:       → "Agent:v2: My Bot"    (version tag)
  AGENT_PREFIX: process.env.NEXT_PUBLIC_AGENT_PREFIX ?? 'Agent:INTU:',
  SKILL_PREFIX: process.env.NEXT_PUBLIC_SKILL_PREFIX ?? 'Skill:INTU:',

  // ── App-scoping ─────────────────────────────────────────────────────────────
  // When true (default): only show data created via the AgentScore platform.
  //   Uses label prefix filters (AGENT_PREFIX / SKILL_PREFIX).
  //
  // When false: show ALL atoms/triples on the Intuition network regardless of
  //   who created them or what label format they use.
  //   Use this on mainnet to discover community-created content.
  //
  //   NEXT_PUBLIC_APP_SCOPE=false
  APP_SCOPE_ENABLED: process.env.NEXT_PUBLIC_APP_SCOPE !== 'false',

  // ── Alpha launch date filter ─────────────────────────────────────────────────
  // Optional ISO-8601 date string. When set, ALL data queries will only return
  // entities created on or after this date. This ensures a clean slate when
  // migrating to a fresh testnet for the alpha phase.
  //
  //   NEXT_PUBLIC_ALPHA_DATE=2025-06-01T00:00:00Z
  //
  // Set to empty string or omit to show all historical data.
  ALPHA_DATE: process.env.NEXT_PUBLIC_ALPHA_DATE || null,

  // ── Platform tag (informational) ────────────────────────────────────────────
  // Human-readable tag shown in logs / UI for debugging.
  PLATFORM_TAG: process.env.NEXT_PUBLIC_PLATFORM_TAG ?? 'testnet',

  // ── Platform Fee Collection ──────────────────────────────────────────────────
  // Wallet address that receives platform fees.
  // Leave unset (or empty) to disable fee collection entirely.
  //   NEXT_PUBLIC_PLATFORM_FEE_WALLET=0x...
  PLATFORM_FEE_WALLET: (process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET || null) as `0x${string}` | null,

  // Fixed fee (in ETH/tTRUST) charged on each Agent/Skill registration.
  // Default: '0' (disabled). Example: '0.001'
  //   NEXT_PUBLIC_PLATFORM_REG_FEE=0.001
  PLATFORM_REG_FEE: process.env.NEXT_PUBLIC_PLATFORM_REG_FEE ?? '0',

  // Fee on staking transactions in basis points (1 bps = 0.01%).
  // Default: 0 (disabled). Example: 50 = 0.5%, 100 = 1%.
  //   NEXT_PUBLIC_PLATFORM_STAKE_FEE_BPS=50
  PLATFORM_STAKE_FEE_BPS: parseInt(process.env.NEXT_PUBLIC_PLATFORM_STAKE_FEE_BPS ?? '0', 10),
} as const

export type AppConfig = typeof APP_CONFIG
