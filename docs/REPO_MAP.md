## AgentScore REPO MAP

### 1. Framework & Runtime
- **Next.js 14.2.0**, App Router only (`src/app/`, no `pages/` dir). React 18.3, TypeScript 5.3 (strict mode: `strict`, `strictNullChecks`, `noImplicitOverride` all on; `noUnusedLocals`/`noImplicitReturns` off).
- `next.config.js`: **`typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`** — production builds do NOT fail on type/lint errors; `npm run type-check` is the real gate.
- Path aliases: `@/*` → `src/*`, plus `@/components`, `@/app`, `@/lib`, `@/hooks`, `@/types`, `@/utils`.
- Deploy target: **Vercel**, project `agentscore` under team `kryptoremontiers-projects`. GitHub-integrated (auto-deploy per push/branch; `main` → production).
- Windows dev quirk: webpack cache disabled in dev (`config.cache = false`) to avoid HMR file-lock errors; TLS verification disabled in dev only (`NODE_TLS_REJECT_UNAUTHORIZED=0`) for corporate/VPN cert issues.

### 2. API Routes (`src/app/api`)
**`/api/v1`** (Trust API, all wrapped in `apiSuccess`/`apiError`, CORS `*`):
- `GET /api/v1` — index of all endpoints
- `GET /api/v1/agents` — list agents w/ scores (sort: score/stakers/newest), revalidate 300
- `GET /api/v1/agents/:id` — agent detail
- `GET /api/v1/agents/:id/trust` — full trust/quality/object score breakdown
- `GET /api/v1/agents/:id/card` — A2A-compatible agent card (detail+trust in parallel)
- `GET /api/v1/agents/:id/timeline` — trust score history
- `POST /api/v1/agents/register` — "prepare mode": validates + structures registration payload (no server-side tx signing)
- `GET /api/v1/skills` — list skill atoms w/ aggregate stats
- `GET /api/v1/skills/:id` — skill detail + agents in it
- `GET /api/v1/domains` — canonical domain buckets w/ aggregate stats
- `GET /api/v1/domains/:id/agents` — agents in one domain
- `GET /api/v1/evaluators` — evaluator leaderboard, filter by tier, revalidate 300
- `GET /api/v1/evaluators/:address` — one evaluator's accuracy/PNL/tier profile
- `GET /api/v1/trust/query` — filtered trust query (skill/minTrust/minStakers)
- `GET /api/v1/leaderboard` — ranked agent leaderboard, revalidate 60
- `GET /api/v1/stats` — platform-wide stats, revalidate 300
- `GET /api/v1/forge/projects` — list IntuForge projects
- `POST /api/v1/forge/projects` — register new IntuForge project
- `GET /api/v1/forge/projects/:id` — project detail
- `GET /api/v1/forge/projects/:id/trust` — project trust score
- `GET /api/v1/forge/stats` — forge-wide aggregate stats
- `GET /api/v1/forge/leaderboard` — forge leaderboard by category, revalidate 300

**Other:**
- `GET/POST /api/mcp` — 307 redirect to `/api/mcp/mcp`
- `GET/POST /api/mcp/[transport]` — MCP server (`mcp-handler`), 9 tools wired here (search/detail/trust/domains/evaluators/query/stats/register/timeline)
- `GET /api/feedback` — list feedback entries (admin-token protected)
- `POST /api/feedback` — submit feedback (public)
- `PATCH /api/feedback/:id` — mark resolved (admin-token protected)

### 3. Data Layer
- **No single shared GraphQL client** — the fetch-POST-to-Hasura pattern is reimplemented independently in several files: `api-data.ts` (own `gql<T>()`, server-side, `cache: 'no-store'`), `attestation-reader.ts` and `pnl-engine.ts` (each their own inline `fetch`/`gql`), and `graphql-client.ts` (`graphqlRequest()`, resolves testnet/mainnet URL from `constants.ts` `API.graphql`).
- **Liveness verified (grep, 2026-08-27; dead hooks removed 2026-08-28): `graphql-client.ts` has exactly one live consumer — `domain-data.ts`'s `fetchDomainCategoryGraph`, imported by `src/app/lab/poc/page.tsx`. The three client hooks that previously imported `graphql-client.ts` (`useTrustScore`, `useAgents`, `useAgent`) were confirmed unimported outside their own barrel (`hooks/index.ts`) and deleted; the stale month-old cleanup stash (which also deleted `graphql-client.ts` itself, wrongly) was dropped, not applied.**
- Endpoint: `APP_CONFIG.GRAPHQL_URL` (`app-config.ts`) = `NEXT_PUBLIC_GRAPHQL_URL` ?? `https://testnet.intuition.sh/v1/graphql`.
- Example query (from `pnl-engine.ts`): `GetWalletPositionsWithPNL($wallet: String!, $termIds: [String!]!) { positions(where: {...}) { term_id shares total_deposit_assets_after_total_fees total_redeem_assets_for_receiver vault { current_share_price total_shares total_assets } } }`.
- **On-chain reads**: `viem` `createPublicClient` against Intuition Testnet RPC (`api-data.ts` server client, `on-chain-pricing.ts` for cached share price, 15s TTL) — used for live share-price reads, not the bulk of data (Hasura indexer is primary source).
- IPFS/Pinata metadata upload is wired as an *optional*, currently-unused path (env var present, no `PINATA_JWT`/`createAtomFromThing` call found in `intuition.ts`).
- Env vars referenced in `src/`: `NEXT_PUBLIC_GRAPHQL_URL`, `NEXT_PUBLIC_NETWORK`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_CHAIN_ENV`, `NEXT_PUBLIC_INTUITION_RPC_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WC_PROJECT_ID`, `NEXT_PUBLIC_AGENT_PREFIX`, `NEXT_PUBLIC_SKILL_PREFIX`, `NEXT_PUBLIC_APP_SCOPE`, `NEXT_PUBLIC_ALPHA_DATE`, `NEXT_PUBLIC_PLATFORM_TAG`, `NEXT_PUBLIC_PLATFORM_FEE_WALLET`, `NEXT_PUBLIC_PLATFORM_REG_FEE`, `NEXT_PUBLIC_PLATFORM_STAKE_FEE_BPS`, `NEXT_PUBLIC_ENABLE_TEST_PAGE`, `FEEDBACK_ADMIN_TOKEN`, `NODE_ENV`.

### 4. Scoring
- **`lib/scoring/types.ts`** — canonical `ScoreEnvelope` returned by all endpoints:
```ts
interface ScoreEnvelope {
  objectType: 'agent'|'claim'|'evaluator'|'project'|'skill'
  trustScore: number          // 0–100
  qualityScore: number | null // 0–100, null on list endpoints
  objectScore: number | null  // trustScore×0.60 + qualityScore×0.40
  tier: TrustLevel
  softGateActive: boolean     // always false (removed)
  computedAt: string          // ISO-8601
}
```
- **`lib/scoring/engine.ts`** → `computeScoreEnvelope(input: ComputeScoreInput): ScoreEnvelope` — thin orchestrator, delegates math.
- **`lib/hybrid-trust.ts`** → `calculateHybridScore(trustScore, compositeScore, supportRatio): number` (60/40 blend, rounded to 0.1) and `getHybridLevel(score): TrustLevel` (80/60/40/20 bands).
- **`lib/composite-trust.ts`** → `calculateCompositeTrust(input: CompositeTrustInput): CompositeResult` — 4-pillar composite (signal 40%, staker diversity 25% log2-scaled, stability 25%, price retention 10%); also whale-exit helpers (`getMaxDailySell`, `getLoyaltyMultiplier`).
- **`lib/evaluator-score.ts`** → `calculateEvaluatorScore(address, positions, options): EvaluatorProfile` — accuracy-weighted evaluator tiering (0.5x–1.5x), consumes `PositionPNL`/`WalletPNL` from pnl-engine when present, falls back to raw trust-score good-pick logic otherwise. Tiers: newcomer/scout/analyst/oracle/sage.
- **`lib/pnl-engine.ts`** (pure + I/O split):
  - `computePositionPNL(raw): PositionPNL` — pure, wei→float via `Number(x)/1e18`, `pnlPercent = totalPNL/costBasis × 100`
  - `calculateWalletPNL(positions: PositionPNL[]): WalletPNL` — pure aggregate (win rate, total PNL)
  - `isProfitablePick(position): boolean`
  - `fetchPositionPNL(wallet, termIds): Promise<PositionPNL[]>` — async GraphQL fetch, degrades to `[]` on error (never throws)
  - `PositionPNL = { termId, shares, currentSharePrice, currentValue, costBasis, realizedValue, unrealizedPNL, realizedPNL, totalPNL, pnlPercent, isProfit }`
  - `WalletPNL = { totalUnrealized, totalRealized, totalPNL, totalCostBasis, pnlPercent, positions: PositionPNL[], profitablePositions, totalPositions, winRate }`
  - Consumed by `evaluator-data.ts` and `evaluator-score.ts` only; feeds "good pick" determination and best/worst-pick ranking in the evaluator pipeline. Does not touch `trustScore`/`qualityScore`/`objectScore` directly.

### 5. Auth & Admin
- **Wallet-gated pages**: `src/app/admin/layout.tsx` wraps all `/admin/*` routes (`feedback`, `predicates`) in `<AdminGuard>` (`src/components/auth/AdminGuard.tsx`) — client component, checks `wagmi.useAccount()` against `isAdminWallet()` in `lib/constants.ts` (single hardcoded `ADMIN_WALLET` address, case-insensitive compare). No SSR protection — client-side only, renders "Access Denied" if not connected as that wallet. Sidebar also conditionally shows the admin nav item via the same check.
- **Token-gated API**: `/api/feedback` GET and `/api/feedback/:id` PATCH call `requireFeedbackAdmin(req)` (`lib/feedback-store.ts`), checked against `FEEDBACK_ADMIN_TOKEN` env var — independent of the wallet mechanism above. `POST /api/feedback` is public (no auth) — anyone can submit feedback.
- **All other API routes are public**, no auth — read-only Trust API + MCP surface, rate-limiting/access control not implemented at this layer.

### 6. Conventions
- **Naming**: kebab-case for lib files (`evaluator-score.ts`, `pnl-engine.ts`, `skill-domain-map.ts`); PascalCase for components/pages; camelCase functions/vars.
- **Error handling**: API routes wrap logic in `try/catch`, log `console.error('[API] /x error:', error)`, return via `apiError(message, status)` / `apiSuccess(data, meta)` (`lib/api-helpers.ts`) — consistent `{success, data|error, meta}` envelope, CORS headers on every response. Data-layer async fetches (attestation-reader, pnl-engine) instead **degrade gracefully to `[]`/`null`** on error with `console.warn`, never throw — callers never see a rejected promise.
- **Shared libs**: `src/lib/` (business logic, scoring, data fetching — no React), `src/components/` (UI), `src/hooks/` (client-side hooks; only remaining hook is `useIntuition.ts`, wrapping `@0xintuition/sdk` + wagmi for reads/writes — the three GraphQL-client hooks were removed 2026-08-28 as dead code, see §3).
- **Tests**: Vitest 4.1.2, config `vitest.config.ts` (`environment: 'node'`, globals on, alias `@/*`→`src/*`, no global setup file). Pattern: `src/**/__tests__/**/*.test.ts`. 21 test files, 239 tests, colocated next to the module under test (e.g. `src/lib/scoring/__tests__/`, `src/lib/forge/__tests__/`).
