# Rate-limit exposure in production — recon

> Recon only: no code changed in this commit. Branch `feat/etap4b-close` @ `9b3040c` (commits 1–4 of Etap 4b-close).
> Written 2026-09-26. Line references are to that commit.

## Status — implemented in Etap 4b-cache (measured 2026-09-26, production builds)

| | before (`main` @ `3d034d2`) | after (`feat/etap4b-cache`) |
|---|---|---|
| Server, synthetic load of 30 REST/MCP calls/min | 344 · 344 · 346 GraphQL req/min, 19–28 HTTP 429 from minute 2, 3 failed answers | 54 · 35 · **23** req/min, 0 × 429, 0 failed; every answer carries `meta.dataAgeSeconds` |
| Browser, cold `/agents` + 3 modals within one minute | 69 (list 23, modals 15 / 17 / 14) | **32** (list 13, modals 5 / 7 / 7) |
| Browser, a modal left open in a hidden tab | 8 req/min | 0 (one refresh when shown again) |

What was built is §4.1 (shared server cache, complete reads only, with the age reported) plus two things this recon didn't list: the pager's first page and count in one request, and the modal reusing the list's reads. §4.2's optional step — serving the `/agents` list from the server cache — was not needed for one user (32 of 75); a shared IP with three heavy users in the same minute would still exceed the limit. See REPO_MAP §3 "Shared server cache" and §7 rule 6.

## TL;DR

1. **The Intuition Hasura endpoint allows 75 requests per minute per caller IP** (Kong: `ratelimit-limit: 75`, `x-ratelimit-limit-minute: 75`, fixed one-minute window). A read over the limit gets a 429. `gqlRequest` throws on it, and the UI shows its honest "couldn't read" state (REPO_MAP §7 rule 5).
2. **Browser, per user IP:** one cold `/agents` load makes **23** GraphQL requests. One modal open adds **15**, and an open modal polls **8/min**. One `/agents/[id]` profile makes **10–15**. So one fast user can exhaust the per-IP budget alone: **/agents + 3 modal opens in a minute = 23 + 45 + 8 = 76 > 75**. So can **4 users behind one NAT** loading `/agents` in the same minute (4 × 23 = 92).
3. **Server side (Vercel functions: REST, MCP, the landing's API calls):** Every declared `revalidate` on an API route is **inert**. `api-data.ts`'s `gql()` passes `cache: 'no-store'`, which makes the routes dynamic; none of the API routes appears in `prerender-manifest.json`, and a second `/api/v1/stats` call re-ran all 18 of its warm reads. What actually caches is:
   - the CDN (`s-maxage=15, stale-while-revalidate=30` on every `apiSuccess` GET), per URL;
   - two `unstable_cache` reads (evaluator leaderboard 300 s, agent term ids 900 s);
   - `/leaderboard` and `/evaluators` pages (ISR 300 s);
   - per-instance in-memory maps.

   **MCP is POST, so it is never cached.**
4. **Server thresholds, if server egress shares one 75/min budget:**
   - **4 `get_agent_trust` calls per minute** (18 reads each) is the ceiling. **9 `search_agents`/min**, **4 `platform_stats`/min**.
   - Steady landing traffic alone costs up to **4 × 18 + 4 × 8 = 104 reads/min** once the CDN revalidates every 15 s. That is over budget before any MCP call.
5. **Smallest fix (proposed, not implemented):** wrap the four shared heavy reads in `unstable_cache` (the Vercel Data Cache is shared across instances), each tagged:
   - agent corpus: 60 s
   - platform stats: 300 s (the value already declared)
   - domain triples: 60 s
   - per-agent detail/trust: 30 s

   Also pause the modal poll while the tab is hidden. Only a fully successful read may be cached; a `null` from a failed sub-read must not be. Server steady state drops from "scales with traffic" to **about 20 reads/min, flat**. The cost: REST/MCP/landing numbers can be up to one TTL behind the chain. The staker's own modal is not cached and stays live.

---

## 1. How this was measured

| Evidence | How | Live? |
|---|---|---|
| Rate limit | Response headers from `https://testnet.intuition.sh/v1/graphql`, re-read 2026-09-26: `ratelimit-limit: 75`, `x-ratelimit-limit-minute: 75`, `ratelimit-reset: 36` (seconds to the window's end) | **live** |
| Browser counts | Playwright (`tests/e2e/.local/ratecount.spec.ts`, git-excluded) against a **production build** (`next start`, commit `9b3040c`). Counts every POST to the GraphQL URL by operation name, and every `/api/*` call. 62 s pause between scenarios so each starts in a fresh window. | **live** Hasura |
| Server counts | The same production build, started with a `--require` preload that wraps `globalThis.fetch` and logs every GraphQL POST (operation name + status). Each handler was called once, alone, 63 s apart. Count = log lines between call start and 1.5 s after the response. All 29 calls returned 200 and all their reads were 200 (no 429 skewed a count). | **live** Hasura |
| Cold vs warm | Evaluator/term-id counts were taken again after killing the server and deleting `.next/cache/fetch-cache` (cold). | **live** |
| What is cached | `prerender-manifest.json` of the build, response headers (`x-nextjs-cache`, `cache-control`), repeat calls, code. | local build |
| Production CDN | **Not observed** — `agentscore-gilt.vercel.app` is not reachable from this sandbox. The CDN behaviour below is derived from the `Cache-Control` headers the build emits and Vercel's documented handling of `s-maxage` on function responses. | derived |

**Dev numbers are double.** `next dev` runs React StrictMode, which runs every effect twice. Cold `/agents` in dev = 46, profile 25/20, landing 6. All numbers below are from the production build.

**Numbers scale with data.** The reads are paged: Hasura caps positions at 100 rows and atoms/triples at 250. Every page is one more request, and every paged read is preceded by one `…Count` request. Today's corpus: 9 AgentScore agents and 264 ERC-8004 cohort agents (2 pages). The cohort read pages at 250 rows, and the positions and classification reads at 100 rows. At 500 cohort agents, cold `/agents` gains about 5 requests.

## 2. Browser side — counts against each user's own IP

These reads go straight from the browser to Hasura (`src/app/agents/page.tsx`, `src/lib/cohort-reader.ts`, `src/lib/attestation-reader.ts`). Each user spends their own 75/min.

| Page view | GraphQL | Also calls | Breakdown |
|---|---:|---|---|
| **Cold `/agents`** | **23** | — | corpus 2 (`AgentListCorpus` + Count) · cohort 4 (rows 2 pages + Rows count + distinct Count) · vault positions 4 · classification 9 (5 row pages + 4 counts) · attestations 4 |
| **Modal open (Luda, AgentScore)** | **15** | — | signals 1 · all triples 2 · vault positions 6 (3 vaults × read + count) · attestations 2 · reports 2 · `FindTrustTriple` 1 · `StakerSupportPositions` 1 |
| Modal poll while open | **8 / min** | — | 2 every 15 s (`VaultPositions` + Count), `page.tsx:673` |
| Deep link `/agents?open=<Dackie>` (list + modal) | **37** | — | list 23 + cohort modal 14 |
| **`/agents/[Dackie]` profile** (ERC-8004) | **15** | — | attestations, reports, trust counter, profile atom, vault positions, cohort agent 1, classification 2 |
| **`/agents/[Luda]` profile** (AgentScore) | **10** | `/api/v1/agents/:id` (→ 11 server reads, §3) | |
| Landing `/` | **3** | `/api/v1/stats` (→ 18–28 server), `/api/v1/agents?limit=1` (→ 8 server) | featured agents: atoms 1 + positions 2 |

`/skills` and `/claims` modals poll the same way (`skills/page.tsx:564`, `claims/page.tsx:494`: 15 s).

### When a browser user hits the limit

The Kong window is a fixed calendar minute per IP, so these are sums within one minute:

| Pattern in one minute | Reads | Result |
|---|---:|---|
| `/agents` + 2 modal opens (poll running) | 23 + 30 + 8 = 61 | OK |
| `/agents` + 3 modal opens | 23 + 45 + 8 = **76** | the 76th read → 429 → "couldn't read" |
| 3 × cold `/agents` (reloads, or 3 tabs) | 69 | OK, barely |
| 4 × cold `/agents` from **one NAT IP** (office, campus, mobile CGNAT) | **92** | the 4th user's page partly fails |
| Deep link + profile + back to list | 37 + 15 + 23 = **75** | at the edge |

So the browser threshold is not "concurrent users" in the abstract. It is **about 3 page-loads-worth of /agents per IP per minute**. Heavy single users and shared-IP groups reach it; spread-out users on their own IPs never do.

## 3. Server side — reads that run on Vercel

Every REST route, every MCP tool, and the landing's two API calls run in Vercel Functions and read Hasura from **Vercel's egress IPs**. Vercel gives no static or per-user egress IP without Secure Compute. Server traffic comes from a shared, dynamic pool, so treat it as **one shared 75/min budget (worst case)**. If traffic is actually spread over several IPs, every threshold below rises by that unknown factor.

### Requests per call (cold instance; "warm" where an in-process or data cache changed the count)

| Handler | GraphQL / call | Cache on it today |
|---|---:|---|
| `GET /api/v1/agents` (any query) | **8** | CDN 15 s + SWR 30 s, per URL |
| `GET /api/v1/agents/:id` — AgentScore agent | **11** | CDN 15 s |
| `GET /api/v1/agents/:id` — ERC-8004 agent | **10** | CDN 15 s |
| `GET /api/v1/agents/:id/trust` | **7** | CDN `s-maxage=60, swr=300` |
| `GET /api/v1/agents/:id/timeline` | **18** | CDN 15 s |
| `GET /api/v1/agents/:id/card` | **18** | CDN `s-maxage=60` |
| `GET /api/v1/stats` | **28** cold / **18** warm | CDN 15 s; `revalidate = 300` **inert** |
| `GET /api/v1/leaderboard` | **8** | CDN 15 s; `revalidate = 60` **inert** |
| `GET /api/v1/evaluators` | **10** cold / **0** within 300 s | `unstable_cache` 300 s (+ term ids 900 s) |
| `GET /api/v1/evaluators/:address` | **1** warm | reuses the cached leaderboard |
| `GET /api/v1/skills` | **5** | CDN 15 s |
| `GET /api/v1/domains`, `/trust/query` | **4** | CDN 15 s |
| `GET /api/v1/forge/{projects,leaderboard,stats}` | **3** each | CDN 15 s; `revalidate = 300` **inert** |
| MCP `search_agents` | **8** | **none** (POST) |
| MCP `get_agent_trust` — AgentScore / ERC-8004 | **18** / **11** | none |
| MCP `platform_stats` | **28** cold / **18** warm | none |
| MCP `get_agent_timeline` | **18** | none |
| MCP `compare_agents` (2 agents) | **12** | none |
| MCP `get_evaluator` | **11** cold / **1** warm | leaderboard `unstable_cache` |
| MCP `top_evaluators` | **10** cold / **0** within 300 s | `unstable_cache` 300 s |
| MCP `list_domains`, `trust_query` | **4** | none |
| Page `/explore/intuforge` (SSR) | **3** every request | `revalidate = 60` **inert** (served `no-store`) |
| Page `/leaderboard` (ISR) | **4** per 300 s | ISR 300 s (`x-nextjs-cache: HIT`) |
| Pages `/`, `/agents`, `/agents/[id]`, `/evaluators` (SSR) | **0** | static shell, or `unstable_cache` |

A repeat `/api/v1/agents` and a repeat `search_agents` on the same warm instance were again **8**. The quality LRU (`scoring/quality-cache.ts`) saves computation, not reads.

### What is cached, and for how long

| Cache | Scope | TTL | Covers |
|---|---|---|---|
| Vercel CDN via `apiSuccess` (`api-helpers.ts:20`) | per URL (query string included), per edge region; **GET only** | 15 s fresh + 30 s stale-while-revalidate | every REST GET |
| Trust/card routes (`agent-surface.ts:19`, `card/route.ts:97`) | per URL | 60 s (+300 s SWR on trust) | `/trust`, `/card`, `llms.txt`, agent.json |
| `unstable_cache` (Vercel Data Cache, shared across instances) | global | 300 s / 900 s | evaluator leaderboard, agent term ids, leaderboard page data |
| ISR pages | global | 300 s | `/leaderboard`, `/evaluators` |
| `export const revalidate` on `/api/v1/{agents,stats,leaderboard,evaluators,forge/*}` and `/explore/intuforge` | — | **none in effect** | the routes are dynamic: `no-store` fetch in `api-data.ts:60` and `forge/data.ts:140`; the API routes read `searchParams` |
| `attestation-gate.ts:90` map | one function instance | 5 min | evaluator attestation gate |
| `scoring/quality-cache.ts` LRU 500 | one function instance | 5 min | quality score computation (no reads saved) |
| `on-chain-pricing.ts:23` | one instance / one tab | 15 s | RPC reads (not Hasura) |
| **MCP** | — | **none** | POST bodies are never CDN-cached |

### When the server hits the limit (shared 75/min)

**Baseline from the landing page alone.** Each landing visit calls `/api/v1/stats` (18–28) and `/api/v1/agents?limit=1` (8). The CDN absorbs repeats for 15 s, then revalidates in the background. With at least one visitor every 15 s per region, that is up to 4 revalidations per minute: **4 × 18 + 4 × 8 = 104 reads/min**. That is over 75 with zero MCP traffic, per active region. A trickle of landing traffic (one visit a minute) costs about 26/min.

**MCP (uncached), with a quiet landing (~26/min baseline, leaving ~49):**

| Traffic | Reads/min | Starts failing at |
|---|---:|---|
| `get_agent_trust` only | 18 each | **3/min** with baseline, 5th call/min on an idle server (4 × 18 = 72) |
| `search_agents` only | 8 each | **7/min** with baseline, 10th/min idle |
| `platform_stats` only | 18 each (warm) | **3/min** with baseline, 5th/min idle |
| A typical agent workflow (`search_agents` + 2 × `get_agent_trust`) | 44 | **1 workflow/min**; the 2nd in the same minute fails partway |

**REST:** distinct URLs each pay in full, because the CDN key includes the query string. 10 distinct `/api/v1/agents/:id` lookups in a minute = 110 reads. So a crawler or an agent iterating over agents fails from about the **7th distinct detail URL per minute**.

A 429 inside a server handler surfaces as:
- a 500, for detail/list reads that throw;
- or a `null` field ("couldn't read"), for sub-reads that settle, e.g. the attestation read in `loadAgentCorpus` (`api-data.ts:297`) → every tier `null`.

That field is honest, but it is served to every caller for the CDN's 15–45 s.

## 4. Proposal — the smallest caching layer (not implemented)

**Goal:** make server-side reads flat (independent of traffic) and keep every browser page under a third of the per-IP budget.

### 4.1 Shared server cache for the four heavy reads (the one change that matters)

Wrap in `unstable_cache`, each with a tag. The Vercel Data Cache is shared across instances, so the reads per TTL are paid once, not once per instance or per URL:

| Read | Used by | TTL | Reads/min after |
|---|---|---:|---:|
| `loadAgentCorpus()` (`api-data.ts:291`) | `/api/v1/agents` (any query), `/api/v1/leaderboard`, `/api/v1/stats`, MCP `search_agents`, `platform_stats`, landing | **60 s** | 8 |
| `getPlatformStats()` | `/api/v1/stats`, MCP `platform_stats` | **300 s** (the value `stats/route.ts:5` already declares) | ~4 (18/5) |
| domain triples (`GetAllDomainTriples` + positions) | `/domains`, `/skills`, `/trust/query`, `list_domains`, `trust_query` | **60 s** | 4 |
| per-agent detail + trust (`getAgentDetail`, `getAgentTrustBreakdown`, `getCohortAgentDetail`), keyed by `termId` | `/agents/:id`, `/trust`, `/card`, `/timeline`, MCP `get_agent_trust`, `compare_agents`, `get_agent_timeline` | **30 s** | ≤ 11–18 per *distinct* agent per 30 s |

Server steady state: about **8 + 4 + 4 + ~4 ≈ 20 reads/min flat** for all list, stats, domain and landing traffic. That leaves about 55/min for distinct-agent detail reads, which are now shared between REST and MCP and repeat-free for 30 s. Search, stats and domain MCP calls become effectively free.

**Also** remove the inert `export const revalidate` lines, or leave a comment that the `no-store` fetch overrides them. As written they tell a reader the routes are cached when they are not.

**Rule 5 — the one trap.** `unstable_cache` stores whatever the function *returns*. `loadAgentCorpus` catches a failed attestation read and returns `null` tiers. Cached as is, one 429 would pin "tier unknown" on every surface for the full TTL.
- The cached function must **throw** when any sub-read failed, so nothing is stored.
- The route then serves the un-cached fallback (the current behaviour).
- Only complete reads are cached.
- The same applies to the vault-read annotation: `stakeReading` `unread` must not be cached.

**BigInt.** Cached values are JSON-serialised. The corpus rows carry `__opposeWei` / wei strings: keep them strings (as they already are) and convert after the cache (CLAUDE.md BigInt rule).

### 4.2 Browser: two small changes

- **Pause the modal poll while the tab is hidden** (`document.visibilityState`), and **slow it to 30 s**. An open modal goes from 8 to 4 reads/min, and to 0 in a background tab. The three pollers (`agents`, `skills`, `claims`) get the same change.
- *(Optional, larger)*: serve the `/agents` list from one cached API route instead of 23 browser reads. That moves the 23 reads behind the 60 s corpus cache (§4.1) plus a cohort/classification cache. Browser cost drops to 1 request, and NAT groups stop colliding. It is deliberately not part of the smallest layer: it changes where the "couldn't read" state originates and needs its own recon.

### 4.3 Staleness trade-off

| What can be stale | Max staleness | Who notices |
|---|---|---|
| Agent list, scores, tiers on REST / MCP / landing | 60 s (+ CDN 15–45 s ≈ **~2 min** worst case) | API/MCP consumers; the landing numbers |
| Platform stats | 300 s (+ CDN) ≈ **~6 min** | landing tiles, `platform_stats` |
| One agent's detail/trust on REST / MCP | 30 s (+ CDN) ≈ **~75 s** | an agent polling its own score right after a stake |
| **The staker's own view** (modal, profile, "your position") | **none** | browser reads stay direct and un-cached, so a user sees their own stake immediately |

Stakes and attestations are wallet transactions sent from the browser, so no server action runs after a write that could call `revalidateTag`. If "~2 minutes on the API" is too slow, the follow-up is a tiny authenticated `POST /api/revalidate` that the client calls after a confirmed transaction, calling `revalidateTag('agent-corpus')` and `revalidateTag('agent:<termId>')`. It is not needed for the first cut.

## 5. Open questions (not answered by this recon)

- **Production egress.** How many distinct IPs does production actually use toward Hasura? Only Vercel logs, or an API key from Intuition, can answer. An authenticated key would likely lift the 75/min anonymous limit altogether, which makes it the cheapest fix of all, if Intuition issues one.
- **CDN on the live deployment.** `x-vercel-cache` was not observed from here. Confirm `HIT`/`STALE` on `/api/v1/stats` before trusting the landing baseline in §3.
