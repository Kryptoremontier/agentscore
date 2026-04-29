# AgentScore — Scoring & Performance Architecture

> Last updated: 29 April 2026
> Covers work from branches: `perf/leaderboard-optimization`, `perf/leaderboard-cache`, `refactor/scoring-architecture`

---

## Executive Summary

AgentScore is a universal trust scoring platform for any object on the Intuition knowledge graph (agents, skills, projects, evaluators, predictions). This document covers the canonical scoring vocabulary, API architecture, caching strategy, and lessons learned from the April 2026 performance refactor.

---

## 1. Scoring Vocabulary

### Three canonical scores

Every object on the platform produces three scores via the same engine:

| Field | Type | Description |
|-------|------|-------------|
| `trustScore` | `number` 0–100 | Economic confidence. Always present. 60% weight. |
| `qualityScore` | `number\|null` | 4-pillar composite. Null on list endpoints. 40% weight. |
| `objectScore` | `number\|null` | Headline score = `trustScore×0.60 + qualityScore×0.40`. Null when `qualityScore` null. |

### ScoreEnvelope

Every API endpoint returns a `score` field of type `ScoreEnvelope`:

```typescript
interface ScoreEnvelope {
  objectType: 'agent' | 'claim' | 'evaluator' | 'project' | 'skill'
  trustScore: number
  qualityScore: number | null
  objectScore: number | null
  tier: 'Unverified' | 'Sandbox' | 'Trusted' | 'Verified'
  softGateActive: boolean
  computedAt: string // ISO-8601
}
```

### List vs Detail endpoint contract

- **LIST endpoints** (`/api/v1/agents`, `/api/v1/evaluators`): `qualityScore=null`, `objectScore=null`
  Reason: `qualityScore` requires per-agent signal history (GraphQL) + on-chain price (RPC) = N calls
- **DETAIL endpoints** (`/api/v1/agents/:id/trust`): full 4-pillar composite computed
- **LRU quality cache bridges the gap**: detail visit populates cache → next list request shows `objectScore` for recently-viewed agents

### Quality cache

Key: `${termId}:${lastSignalAt}` — automatic invalidation when new stake arrives (new position = new max `created_at` = new cache key = cache miss = fresh compute). Max entries: 500. TTL: 5 minutes.

### The original bug

`calculateHybridScore(trustScore, trustScore, ratio)` was called with the same value for both arguments. Mathematically: `0.6×t + 0.4×t = t`. All API endpoints were returning `trustScore` under the name `agentScore`. Fixed by passing real `compositeScore` from `calculateCompositeTrust()` on detail endpoints.

Deprecated alias: `agentScore` field kept for one release = `objectScore ?? trustScore`.

### Soft gate

Layer 1 anti-manipulation: if `supportRatio < 50%`, `score × (supportRatio / 50)`. Encoded in `trustScore` itself — `softGateActive` is informational only.

---

## 2. Atom Label Architecture

### The problem

`MultiVault.createAtom(bytes data)` has ONE bytes field. Intuition/Hasura exposes this as:

- `atom.label` — Hasura heuristic: shows `"json object"` for any bytes that decode to JSON
- `atom.data` — full bytes (readable as string/JSON)

If you store JSON metadata as the atom bytes, Intuition Portal shows `"json object"`.

### Solution by object type

| Object | `atom` bytes (label) | Type identified by | Metadata location |
|--------|---------------------|-------------------|-------------------|
| Agent | clean name `"Talaria"` | `[agent][is][AI Agent]` triple | `atom.data` via Agent Card API |
| Skill | clean name `"CodeHelper"` | `[skill][is][Agent Skill]` triple | triple context |
| Forge project | clean name `"MyProject"` | `[project][is][Intuition Project]` triple | Atom2.data via `[related to]` triple |

### Forge two-atom pattern

Registration creates:

- **Atom1**: bytes = `"MyProject"` → Portal shows `"MyProject"` ✅
- **Atom2**: bytes = full JSON metadata
- Triple: `[Atom1][related to][Atom2]`
- Triple: `[Atom1][is][Intuition Project]`
- Triple: `[Atom1][hasForgeCategory][category]`

Fetch reads Atom1 via `[is][Intuition Project]`, follows `[related to]` to Atom2, reads `Atom2.data` for metadata. Backward compat: old atoms with JSON bytes parse via `try/catch` fallback in `parseForgeAtomLabel()`.

### Staking vault

Always Atom1 (name atom). The `[is][Intuition Project]` triple belongs to Atom1. `ForgeStakeButtons` receives `project.atomId = Atom1.term_id`.

---

## 3. Hasura GraphQL Rules

These rules were discovered through production debugging and must be followed:

### Rule 1: JOIN depth limit

```graphql
# ALWAYS TIMES OUT — 4-level JOIN on positions
positions(where: { vault: { term: { atom: { label: { _ilike: "..." } } } } })
```

Hasura cannot efficiently execute 4-level JOINs on `positions`.

**Pattern: two-fetch approach**

```typescript
// Fetch 1: get term_ids by label/triple filter (~1s)
const atoms = await gql(`{ atoms(where: { label: { _ilike: "..." } }) { term_id } }`)
const termIds = atoms.map(a => a.term_id)

// Fetch 2: filter positions by vault.term_id _in [...] (1 JOIN, fast)
const positions = await gql(`{
  positions(where: { vault: { term_id: { _in: ${JSON.stringify(termIds)} } } }) {
    account_id shares vault { term_id }
  }
}`)
```

### Rule 2: Checksummed Ethereum addresses

Hasura stores `account_id` in EIP-55 checksummed format. GraphQL `_eq`/`_neq`/`_in` filters are case-sensitive string comparisons.

```typescript
// WRONG — never matches in GraphQL
const FEE_PROXY_LC = '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41'
// positions(where: { account_id: { _neq: "${FEE_PROXY_LC}" } }) ← silently matches nothing

// CORRECT — use checksummed in GraphQL filters
const FEE_PROXY_CS = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41'
// positions(where: { account_id: { _neq: "${FEE_PROXY_CS}" } }) ← works

// OK in JS — toLowerCase() makes it safe
if (p.account_id?.toLowerCase() === FEE_PROXY_LC) { ... }
```

### Rule 3: FeeProxy registrant detection

FeeProxy is `creator_id` of atoms (it calls `createAtoms()` on-chain). BUT FeeProxy is **not** the first position holder. The `receiver` (user wallet) gets shares directly in the same transaction.

```typescript
// positions sorted asc by created_at: positions[0] = real registrant
const firstHolderByVault = new Map<string, string>()
for (const p of positions) {
  const vid = p.vault?.term_id
  if (vid && !firstHolderByVault.has(vid)) firstHolderByVault.set(vid, p.account_id)
}
```

### Other discovered quirks

- Use `creator { id }` not `account { address }`
- Order by `created_at: desc` not `vault: desc` (vault not in `atoms_order_by`)
- `atom.label` = `"json object"` for JSON atoms — read `atom.data` instead
- `as_subject_triples` JOIN (2 levels) is fast — only `positions` 4-level JOINs timeout
- BigInt fields: convert via `weiToFloat()` before `JSON.stringify`

---

## 4. Caching Architecture

### Layer diagram

```
User request
↓
Vercel Edge Cache (revalidate=300 on route handlers)
↓ miss
Next.js Route Handler
↓
unstable_cache: leaderboard (TTL 300s, tag: evaluator-leaderboard)
↓ miss
unstable_cache: agent-term-ids (TTL 900s, tag: agent-term-ids)  ← always warm
+
Hasura GraphQL positions query (1 JOIN, fast)
+
Attestation batch (in-memory 5min cache in attestation-gate.ts)
```

### Why sub-cache TTL > parent TTL

- Leaderboard cache: **300s TTL**
- Agent term-ids cache: **900s TTL**

When leaderboard cache expires (300s), agent term-ids cache is still warm (900s). So the cold leaderboard compute only runs Q2 (positions) + attestations, not Q1.

**Rule: sub-cache TTL must be > parent cache TTL or the optimization is lost.**

### Cache invalidation

| Cache | Key / Tag | Invalidation trigger |
|-------|-----------|---------------------|
| Quality score (LRU) | `${termId}:${lastSignalAt}` | New stake → new `lastSignalAt` → automatic miss |
| Evaluator leaderboard | `evaluator-leaderboard` | `revalidateEvaluatorLeaderboard()` on new stake |
| Agent term-ids | `agent-term-ids` | `revalidateTag('agent-term-ids')` on new registration |
| Route handlers | Vercel deploy | Automatic on each Vercel deployment |

### Performance results

| Surface | Before | Cold after | Warm after |
|---------|--------|------------|------------|
| `/api/v1/evaluators` | 6.9s (broken — 0 results) | ~1.4s | 6ms (800×) |
| `/api/v1/forge/leaderboard` | 1.5s | 0.37s | ~50ms |
| `/api/v1/agents` | ~0.86s | ~0.86s | ~50ms |
| `/leaderboard` page | timeout → blank screen | SSR ~1s | SSR ~1s |
| `/evaluators` page | 6.9s → spinner | SSR ~1.4s | SSR 6ms |

---

## 5. Server Component Pattern

### Problem

Both `/leaderboard` and `/evaluators` were `'use client'` with `useEffect` data fetching. User saw: blank page → spinner → content (3–5s perceived latency).

### Solution: hybrid server/client split

```typescript
// page.tsx — server component (no 'use client')
import { fetchLeaderboardData } from '@/lib/leaderboard-data'

export const revalidate = 300

export default async function LeaderboardPage() {
  const data = await fetchLeaderboardData()  // hits unstable_cache
  return <LeaderboardClient initialData={data} />
}
```

```typescript
// LeaderboardClient.tsx — client component
'use client'

import { useAccount } from 'wagmi'

export function LeaderboardClient({ initialData }: { initialData: LeaderboardEntry[] }) {
  const { address } = useAccount()  // wagmi stays client-only
  // "you" badge, tab switching, client-side sort — all on pre-fetched initialData
  // Table HTML is already in the SSR response before any JS executes
}
```

### The wagmi boundary rule

`useAccount()`, `usePublicClient()`, `useWalletClient()` — all wagmi hooks are client-only. Split server/client exactly at the wagmi boundary:

- **Server component**: fetch data, render static HTML
- **Client component**: overlay wallet-specific UI after hydration

### Page reduction

| Page | Before (lines) | After (lines) | Split |
|------|---------------|---------------|-------|
| `/evaluators` | 436 | 29 | `EvaluatorsClient.tsx` holds JSX |
| `/leaderboard` | 390 | 9 | `LeaderboardClient.tsx` holds JSX |

### Result

View Source on `/leaderboard` and `/evaluators` shows full table HTML with wallet addresses and scores before any JavaScript executes. LCP improvement: the largest contentful element (the table) is in the initial HTML response.

---

## 6. AI Agent Readability

AgentScore is self-describing for AI agents in three standards:

| File | Standard | Purpose |
|------|----------|---------|
| `public/llms.txt` | llmstxt.org | LLM crawler guide |
| `public/.well-known/agent.json` | Google A2A | Auto-discovery manifest |
| `CLAUDE.md` | Claude Code / Cursor | AI coding agent working notes |

- **MCP Server**: `/api/mcp` (11 tools)
- **REST API**: `/api/v1` (13+ endpoints, all return `ScoreEnvelope`)
- **A2A Cards**: `/api/v1/agents/:id/card`

---

## 7. Architecture Principles

Principles established or reinforced during this work:

**1. Hasura JOIN depth ≤ 2 levels.**
Always use two-fetch for relations deeper than 2 levels. `positions → vault` is fine. `positions → vault → term → atom` is timeout.

**2. Checksummed addresses in GraphQL, lowercase in JS.**
`FEE_PROXY_CS` for `_eq`/`_neq`/`_in` filters. `FEE_PROXY_LC` only for `.toLowerCase()` comparisons after data arrives.

**3. Atom label = human name. Triple = semantic type. `atom.data` = rich metadata.**
Never store type information in the label. Use triples. Never expect `atom.label` to survive Hasura heuristics for complex bytes.

**4. List endpoints: trustScore only. Detail endpoints: full composite.**
Document this contract in `llms.txt` and `agent.json`. Bridge with LRU cache keyed by `termId:lastSignalAt`.

**5. Sub-cache TTL must be > parent cache TTL.**
Otherwise the sub-cache miss always coincides with parent miss.

**6. Server component boundary = wagmi boundary.**
Everything above `useAccount()` can be server-rendered. Everything using `useAccount()` stays client.

**7. Public API field names are permanent.**
Test semantics (`calculateHybridScore(x, x, r) = x`), not just types. Rename before mainnet, not after.

**8. `calculateHybridScore(x, x, ratio) = x` — the identity trap.**
Passing the same value for both `trustScore` and `qualityScore` collapses the formula mathematically. Always verify distinct inputs in hybrid score calls.

---

## 8. Open Items (Phase 2C)

| Item | Priority | Notes |
|------|----------|-------|
| Remove `agentScore` deprecated alias | High | At mainnet launch |
| Redis cache for `qualityScore` | High | Phase 2C, replaces in-memory LRU |
| `revalidateAgentTermIds()` on registration | Medium | Wire up after registration flow |
| 0.1 tTRUST floor on evaluator positions | Medium | Mainnet only (testnet stakes too small) |
| Forge project old atoms on Portal | Low | Immutable on-chain, acceptable trade-off |
| Per-field triples for forge metadata | Low | Phase 2C: `[project][hasTagline][...]` etc. |
