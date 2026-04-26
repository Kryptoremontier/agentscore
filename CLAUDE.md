# AgentScore — Working Notes for AI Coding Agents

> If you are an AI coding agent (Claude Code, Cursor, etc.) working on this repo,
> read this file first. It contains the conventions, gotchas, and architecture
> decisions you need to be productive without breaking things.

## What this project is

AgentScore is an on-chain reputation marketplace for AI agents on Intuition Protocol.
Three apps live in this repo:

1. **AgentScore** (`/agents`, `/skills`, `/claims`, `/profile`) — trust scoring for AI agents
2. **IntuForge** (`/explore/intuforge`) — project launchpad reusing the same scoring engine
3. **API + MCP** (`/api/v1`, `/api/mcp`) — programmatic access for agents and frameworks

## Stack

- Next.js 15 (App Router, RSC + Client Components)
- TypeScript (strict)
- Tailwind CSS
- viem + wagmi v2 for blockchain
- Hasura GraphQL for indexed Intuition data
- mcp-handler for MCP server

## Key files (read these before editing)

- `src/lib/hybrid-trust.ts` — main scoring formula (60/40 split, no soft gate)
- `src/lib/composite-trust.ts` — 4-pillar composite score
- `src/lib/evaluator-score.ts` — accuracy-weighted evaluator weights (0.5x–1.5x)
- `src/lib/attestation-gate.ts` — Layer 7 sybil defense
- `src/lib/pnl-engine.ts` — position PNL computation (unrealized/realized)
- `src/lib/api-data.ts` — central data fetching layer (REST + MCP share this)
- `src/lib/intuition.ts` — all on-chain writes (createAtom, deposit, FeeProxy pattern)
- `src/lib/on-chain-pricing.ts` — cached MultiVault reads (15s TTL)
- `src/lib/agent-card.ts` — A2A-compatible agent card schema

## Conventions

- All `writeContract` calls MUST include explicit `gas: <number>n` —
  Intuition Testnet `eth_estimateGas` is unreliable. See `src/lib/intuition.ts`
  for the standard gas budgets per operation.
- All `useEffect` hooks doing async work MUST use a `cancelled` flag pattern
  to prevent React #310 errors on unmount. See `ForgeStakeButtons.tsx`.
- Server components fetch data directly via `getAgent*` functions in `api-data.ts`.
  Client components use the same functions through API routes.
- BigInt values are converted via `weiToFloat()` (or `Number(x) / 1e18`) before
  serializing to JSON — `JSON.stringify(bigint)` throws.
- Atom labels for JSON data are stored in `atom.data` field, NOT `atom.label`
  (Hasura limitation — see `src/lib/forge/data.ts` parsing logic).
- ALL write operations (createAtom, createTriple, deposit) route through FeeProxy,
  NOT directly to MultiVault. The FeeProxy address is in `src/lib/app-config.ts`.
  Redeem (sell) goes direct to MultiVault — no fee.

## Scoring model

```
AGENTSCORE = trustScore × 0.60 + compositeScore × 0.40
```

- No soft gate — the Trust Score already encodes oppose > support when score < 50.
  Adding a separate gate was triple-penalizing the same signal (removed Apr 2026).
- Composite = 40% signal ratio + 25% staker diversity + 25% stability + 10% price retention
- Evaluator weight multiplies each staker's effective stake (0.5x newcomer → 1.5x sage)
- Attestation gate: evaluator weight > 1.0x requires ≥1 inbound attestation (testnet)

## GraphQL quirks (Intuition Hasura)

- Use `creator { id }` not `account { address }`
- Order by `created_at: desc` not `vault: desc` (latter doesn't exist)
- `as_subject_triples` JOIN can time out on large datasets — use prefix label filter
- Positions are NOT nested in atoms — fetch separately
- `atom.label` shows "json object" for JSON atoms — read `atom.data` instead
- `_ilike` for case-insensitive match (creator.id is checksummed)

## Testing

- Unit tests: `npm test` (vitest)
- Type check only (no full build): `npm run type-check` — use this when dev server is running
- NEVER run `npm run build` while dev server is running — destroys .next cache

## Don'ts

- DO NOT use `npm run build` while dev server is running — use `npm run type-check` instead
- DO NOT add gas to `redeemFromVault` — direct MultiVault call, no FeeProxy
- DO NOT modify `src/lib/predicates.ts` without checking `ontology.intuition.box`
  first — canonical atoms exist on mainnet via PR #7 to Intuition Ontology
- DO NOT change scoring weights without updating tests AND CLAUDE.md scoring section
- DO NOT use regex with `/gs` flags for multi-line JSX replacements — causes
  catastrophic deletion (known footgun)
- DO NOT use `BigInt("decimal.float")` — always wrap in try/catch or pre-round

## Dev server

```bash
npm run dev          # normal start
npm run dev:clean    # clear .next cache + start (use when build errors appear)
npm run dev:fresh    # kill ports 3000-3002 + clear .next + start (nuclear option)
```

## Environment variables

- `NEXT_PUBLIC_NETWORK` — `testnet` or `mainnet`
- `NEXT_PUBLIC_INTUITION_GRAPHQL_URL` — Hasura endpoint
- `NEXT_PUBLIC_WC_PROJECT_ID` — WalletConnect project ID

## MCP Server (11 tools at `/api/mcp`)

Tools: `search_agents`, `get_agent_trust`, `get_domain_ranking`, `list_domains`,
`trust_query`, `get_evaluator`, `top_evaluators`, `compare_agents`,
`register_agent`, `platform_stats`, `get_agent_timeline`

## REST API (13 endpoints at `/api/v1`)

Index: `GET /api/v1` — lists all routes with descriptions.

## When in doubt

1. Search the codebase for similar patterns before inventing new ones
2. `npm run type-check` — zero errors = safe to ship
3. Tests pass = ship. Tests fail = stop and fix.
