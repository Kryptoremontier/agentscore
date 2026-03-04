/**
 * AgentScore Platform Configuration
 *
 * All settings are driven by NEXT_PUBLIC_ environment variables so they can be
 * overridden per deployment without changing code.
 *
 * Create a `.env.local` file in the project root to override locally.
 * See `.env.local.example` for the full reference with explanations.
 */

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
  AGENT_PREFIX: process.env.NEXT_PUBLIC_AGENT_PREFIX ?? 'Agent:',
  SKILL_PREFIX: process.env.NEXT_PUBLIC_SKILL_PREFIX ?? 'Skill:',

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
} as const

export type AppConfig = typeof APP_CONFIG
