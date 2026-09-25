# 4b-list recon — `/agents` list page

> Recon only — no UI code changed in this run. `main` @ `d86573a` (Etap 4b-modal merged, PR #9).
> Written 2026-09-24. Line references are to that commit.

## How this was gathered (read first)

| Evidence | Source | Live? |
|---|---|---|
| AgentScore rows, scores, stake, staker counts, junk count | `GET /api/v1/agents?limit=100` on production (`agentscore-gilt.vercel.app`, = `main`), 2026-09-24 21:54 UTC | **live** |
| `/api/v1/stats` agent count | production, 21:52 UTC | **live** |
| Cohort agent profile (Dackie) | `GET /api/v1/agents/<dackie>` on production, 21:55 UTC | **live** |
| ERC-8004 cohort size **264** | `src/lib/cohort-reader.ts:72` comment (live 2026-09-15) + the brief | **not re-observed** in this run |
| Harness screenshots `screenshots/2026-09-24/{desktop,mobile}/*.png` | `npm run shots` in this run | page renders, **but no data** — see below |
| Fixture screenshots `screenshots/2026-09-24/synthetic/{desktop,mobile}/*.png` | `node tests/e2e/agents-fixture.js shots` | **synthetic data**, real render path |
| Render-cost numbers (§5) | `node tests/e2e/agents-fixture.js measure …` against a production build | synthetic data, real render path |

**Why the harness shots have no data:** this run's sandbox network policy denies `testnet.intuition.sh` and the Intuition RPC (only npm/GitHub are reachable). `npm run shots` runs end to end, but every GraphQL call fails, so the pages show their error/empty states. 22 of 26 PNGs are on disk from this run: all 20 page shots, plus `agent-modal-luda` at both viewports, which shows `/agents` with the modal never opened and correctly fails its readiness check. The Dackie and OPEN CLAW modal PNGs were lost to a harness bug (waits exceeded the test timeout before capture). That is fixed: every wait is now a concrete DOM condition capped at 10 s, with a browser warm-up that pre-compiles each route (REPO_MAP §6). A later full run here wrote all 26, with the 6 modal shots failing as expected because no modal can open without data. Re-run `npm run shots` anywhere with testnet access to get the live set; nothing in the harness changes. Where a finding needs populated cards, the report cites the **synthetic** shots. Those use the real `/agents` code path fed by a fixture: the 9 live AgentScore rows exactly as the production API returned them, plus N synthetic cohort rows with no vault data. That matches what the page itself gives cohort rows (`page.tsx:379-389`).

Screenshot paths below are relative to the repo root (gitignored; regenerate with the commands above).

---

## TL;DR

1. **Score `50` is the formula's prior, rendered as if it were a measurement. That's the most serious honesty issue on this page.** At zero stake, `calculateTrustScoreFromStakes` returns exactly its neutral anchor (confidence = 0), and six more `?? 50` / `: 50` / `: 100` literals in `page.tsx` fill in when data is missing or still loading. Live today, 2 of the 9 AgentScore agents have **0 tTRUST** staked and show a coloured **50 · AGENTSCORE**, because the card's "—" gate is `stakers > 0`, not `stake > 0`. Every cohort row inherits the same 50 in the quality filter, the card icon colour, and the modal's Agent Score block. Proposal: `—` plus a tooltip, gated on stake. (§3)
2. **Counters don't come from one source.** `/agents` header, the `/agents` results line, `/api/v1/stats` (**15**, pre-junk), and the landing badge (**8 indexed**, a `limit: 8` fetch) all report different "agent counts". On `/agents` itself, search changes the AgentScore count but not the ERC-8004 count, and a failed cohort fetch looks exactly like an empty cohort. Truncation line: correctly absent at 264 < 500. (§1)
3. **Zero-signal ERC-8004 card:** confirmed. "Unverified" three times (chip, label, dash), `Stakes: 0.0000 tTRUST · Stakers: 0`, an empty bar, and a yellow "moderate" icon. For cohort rows, the stake/staker values are **never fetched**: they're `undefined || 0`. Dropping them hides nothing. (§2)
4. **Quality buckets today:** Excellent 2 · Good 4 · **Moderate 267** (3 AgentScore rows at exactly 50 + all 264 cohort rows, all prior-only) · Low 0 · Critical 0. (§4)
5. **Render cost:** still an unvirtualized `.map()` over the merged array, with BigInt parsing and a JSON.parse-that-throws in every card on every render of a ~4,200-line component. Production build, median of 5: **TTI 1.16 s at 264 rows / 2.0 s at 500** (vs 0.53 s with no cohort); at 4× CPU **5.4 s / 8.1 s**, TBT **2.8 s / 5.5 s**. Opening the modal at 4× CPU takes **664 ms** at 264 rows. (§5)
6. **Mobile:** worst to least: the modal's default Timeline tab is clipped and unreachable; list view collapses names to one character; the grid is 52,714 px tall; the toolbar pushes every card below the fold; the modal score block is squeezed into two ~140 px columns. (§6)

---

## 1. Counters

### What `/agents` renders now

Header (`src/app/agents/page.tsx:1563-1565`):

```
{agents.length} AgentScore · {cohortAgents.length} ERC-8004 · {junk} hidden · showing first {cohortAgents.length} of {cohortTotal} · GraphQL live feed
```

Results line above the grid (`page.tsx:1780-1781`): `{sorted.length} [of {sourceAgents.length}] agents`.

With today's data it reads **`9 AgentScore · 264 ERC-8004 · 6 hidden · GraphQL live feed`** and **`273 agents`**. 9 and 6 match the live API's `meta.total: 9, junkFiltered: 6`. 264 is from the 2026-09-15 count and wasn't re-observed here. 9 + 264 = 273, so the header and the results line agree on the unfiltered page. The historical "183 agents" was the same results line when the cohort was 168 and the junk filter didn't exist yet (15 + 168).

### Is every number derived from one source? No.

| Surface | Number today | Derived from | Problem |
|---|---|---|---|
| `/agents` header "N AgentScore" | 9 | `agents.length`: page's own `atoms(limit: 50)` fetch (`page.tsx:279`), post-junk-filter | **Search-dependent**: `fetchAgents(searchTerm)` re-queries with `_ilike` (`page.tsx:263-265, 409-412`), so typing changes this number… |
| `/agents` header "N ERC-8004" | 264 | `cohortAgents.length` (deduped subjects) | …but this one is **not** search-filtered (search only filters the cohort inside the grid IIFE, `page.tsx:1748-1750`). During a search the header's two numbers no longer sum to the results line. |
| `/agents` header truncation | hidden | `cohortTotal` = `triples_aggregate` count (`cohort-reader.ts:211`) | Units differ: `total` counts **same-as triples**, `cohortAgents.length` counts **deduped subjects** (1/168 subjects had 2 triples on 2026-09-03). If truncation ever fires, "showing first X of Y" compares different units. |
| `/agents` results line | 273 | `sorted.length` / `sourceAgents.length` | Consistent with the header only when no search is active. "1 agents" at n = 1 (seen in the fixture run). |
| `/api/v1/stats` → `agents` | **15** | `agentRows.length` (`api-data.ts:1103`), **no junk filter** | Contradicts `/api/v1/agents` `total: 9` from the same deployment at the same minute. Also what MCP `platform_stats` serves. The "15 agents indexed" in the brief came from this path. |
| Landing `FeaturedAgents` badge "N indexed" | **8** | `items.length` of an `atoms(limit: 8)` fetch (`FeaturedAgents.tsx:100, 155, 248`), no junk filter | Reports its own fetch cap as the corpus size, and "View all 8 agents in Explorer" (`:426`). Can show junk fixtures. |

Also on `/agents`:
- **The AgentScore fetch is capped at `limit: 50` with no truncation reporting** (`page.tsx:279`). That violates REPO_MAP §7 rule 1. It's dormant at 15 atoms, but it's the same class of bug cohort-limits fixed for the cohort.
- **A failed cohort fetch is indistinguishable from an empty cohort.** `fetchCohortAgents()` returns `{agents: [], total: 0}` on any error (`cohort-reader.ts:249-252`), and the header's `cohortAgents.length > 0` guard then drops the ERC-8004 segment silently. Harness evidence: `screenshots/2026-09-24/desktop/agents-list.png` reads **"0 AgentScore · GraphQL live feed"** while both fetches had failed. The AgentScore failure shows an error box; the cohort failure leaves no trace, and "live feed" is claimed regardless.

### Truncation line at 264 rows

Correct: it doesn't appear. `truncated = total > COHORT_FETCH_LIMIT (500)` (`cohort-reader.ts:212`) and 264 < 500. Two caveats for when it matters: the unit mismatch above, and the documented count-query-failure fallback (`total = rows.length`, `:211`). With exactly 500 rows returned and a failed count query, `truncated` stays `false`. That's deliberate, but it's a silent case.

---

## 2. ERC-8004 card redundancy

### Confirmed against current code

A zero-signal cohort card (grid view, `page.tsx:1838-1908`) renders:

| # | Element | Code | Carries per-row information? |
|---|---|---|---|
| 1 | Shield icon, colour from `effectiveLevel` | `:1845-1849, 1869-1873` | **No.** Always yellow "moderate", because the level comes from the 50 prior (§3). |
| 2 | Name | `:1877` | yes |
| 3 | `TrustTierBadge` → **"Unverified"** chip | `:1878`: `calculateTier(stakers, stake, 50, age)` with a **hardcoded `50` trust ratio** | No, constant for the class. (The hardcoded 50 also means no card can ever show Trusted/Verified; both need ratio ≥ 60/75, `trust-tiers.ts:44, 31`.) |
| 4 | Origin chip "ERC-8004" | `:1880-1884` | yes |
| 5 | **"—"** in the score slot | `:1888-1894` | No, constant. |
| 6 | **"UNVERIFIED"** caption | `:1896` | No, constant. Third statement of #3/#5. |
| 7 | `Stakes: 0.0000 tTRUST · Stakers: 0` | `:1899-1901` | **No, and it isn't even a measurement.** Cohort rows are built without `positions_aggregate` (`page.tsx:379-389`), so this is `undefined ?? 0n` / `undefined \|\| 0`: data that was never fetched, printed as a zero (thesis §6: null ≠ 0.0). The `$` from the brief is gone since 4a's `formatTTrust`. |
| 8 | Progress bar at width 0 | `:1903-1905` | No, constant. |

So "Unverified" is stated three times (#3, #5, #6), plus two zeros and an empty bar that restate "no data". Fixture evidence: `screenshots/2026-09-24/synthetic/desktop/agents-list-erc8004.png`, `…/mobile/agents-list-erc8004.png`.

Related, and it matters for the gate below: **the list card never shows the canonical unit.** Captain Dackie has 1 attester / 0.0099 tTRUST attested (`agent-profile.test.ts:139`), but the list only reads the atom vault, so Dackie's card is identical to a row with nothing at all. Thesis §4/§5 say AGENTS answers "good at what, who stands behind it". The card answers neither.

### Proposed compact variant (zero-signal rows only)

```
┌───────────────────────────────────────────────┐
│ Captain Example            [ERC-8004]          │
│ No attestations yet · [Be the first to attest] │
└───────────────────────────────────────────────┘
```

Keep: **name**, **origin chip**, **one CTA**: the existing Attest flow, which opens the modal pre-scrolled to ATTESTED (the modal already gates CTA-per-viewport correctly, 4b-modal).

Drop: #1 icon colour, #3 tier chip, #5 dash, #6 caption, #7 stakes/stakers, #8 bar.

**Gate (must be all of these, not `stakers === 0`):** no vault data *or* vault stake = 0, **and** 0 distinct attesters, **and** 0 reports. Gating on vault stakers alone would compact Dackie, the first cohort attestation, which is exactly the row the page should highlight. So the list needs a bulk attester/report count per visible row. That's one chunked aggregate query on `is skilled in` / `reported for` triples by `subject_id _in […]`, the same chunking as `fetchClassification` (`cohort-reader.ts:139-160`). That fetch is the one new data dependency in the plan (commit 3).

**Why dropping these fields doesn't violate REPO_MAP §7 / thesis §6:**
- §6 forbids *hiding* information and *faking* it. Every dropped field is **constant across the whole class** the gate selects, so for any row in it the field's value is fully determined by the row being in the compact variant. A constant carries zero bits per row, and nothing that varies between rows is removed.
- #7 is worse than constant: for cohort rows it was **never read** (`undefined → 0`). Keeping it would keep a §6 violation (null rendered as 0.0), not avoid one.
- The class itself stays visible and counted. The header gains an explicit segment, e.g. `264 ERC-8004 (263 without any signal)`, from the same pure counts function as the rest of the header (commit 2). That satisfies §7 rule 1's spirit: never silently drop, always say how many.
- Removing the "—" isn't hiding a score: there is no score (§3). The compact card's copy, "No attestations yet", *is* the §6 "Unverified + be the first" state, said once.

---

## 3. The `50` score: verdict

**It's a prior, and at zero stake it's indistinguishable from a fallback constant. The UI shows it as a measurement. This is the most serious honesty issue on the page.**

### Trace

`src/lib/trust-score-engine.ts:118-151`, `calculateTrustScoreFromStakes(support, oppose)`:

```ts
baseScore     = totalStake > 0 ? support/total × 100 : 50        // :125-127
confidence    = 1 − exp(−totalStakeTtrust / 0.1)                  // :129-130 (τ = 0.1 tTRUST on testnet, :64)
anchoredScore = 50 + (baseScore − 50) × confidence                // :131
score         = round(anchoredScore + momentum)                   // :150
```

That's a shrinkage estimator anchored at 50. At `totalStake = 0`, confidence = 0 and the output is **exactly 50 with no data in it**. Thesis §6 asks for shrinkage for small samples, so shrinkage itself is legitimate. What isn't legitimate is n = 0 producing a number.

On top of the prior, the page adds **literal** fallbacks that render 50 whenever a value is missing or still loading:

| Where | Code | Renders |
|---|---|---|
| Modal "Agent Score" block, always visible | `page.tsx:2557` `t?.score ?? 50` | "Agent Score **50**", "Trust Score **50** (60%)" |
| Same block | `page.tsx:2565-2567` `totalWei > 0 ? … : 100` | "Support (**100.0%**) · Oppose (0.0%)" for an agent with no stake at all |
| Modal Overview tab | `page.tsx:2848-2849` `agentTrust?.score ?? 50`, `?? 'moderate'` | "**50.0**/100", **MODERATE** chip, half-filled bar |
| Timeline / trajectory inputs | `page.tsx:1493, 3241, 3722` `hybridScore ?? agentTrust?.score ?? 50` | fed to charts (hidden today by the single-point guard, `TrustTimeline.tsx:380-398`) |
| Modal tier progress | `page.tsx:1432` and hybrid `:1393` `… : 50` | trust-ratio input to `calculateTier` / hybrid |
| Every list card's tier | `page.tsx:1878` literal `50` | tier computed on an invented ratio |
| API | `api-data.ts:215` `… : 50` | `/api/v1/agents` returns `trustScore: 50, tier: "moderate"` to REST and MCP consumers |

### Where it's visible today (live data)

Production `/api/v1/agents`, 2026-09-24 21:54 UTC. Three of the 9 agents score exactly 50:

| Agent | Stake | Stakers | Score | What it really is |
|---|---|---|---|---|
| Luda | 0.00098 tTRUST | 1 | 50 | computed: confidence = 1 − e^(−0.0098) ≈ **0.98 %**, so 50.49 → 50. 99 % prior. |
| On-Chain Data Analyzer | **0** | 1 | 50 | **pure prior** (a zero-share position) |
| Agent Avatar Coder | **0** | 1 | 50 | **pure prior** |

The grid's "—" gate is `stakers > 0` (`page.tsx:1888, 1896, 1904`), not `stake > 0`. A fully-redeemed or zero-share position still counts as a staker (thesis §8 mine 6: that is *not* an attestation), so **the last two render a yellow "50", the AGENTSCORE caption and a half-filled bar with zero tTRUST behind them.** Fixture evidence, shaped on Agent Avatar Coder: `screenshots/2026-09-24/synthetic/desktop/agents-list.png` (bottom of the staked group) and the modal `screenshots/2026-09-24/synthetic/desktop/modal-zero-stake-agentscore.png`.

All 264 cohort rows correctly show "—" on the card, but the same prior still decides their **quality bucket** (§4), their **icon colour** (§2 #1), and everything in the **modal** Agent Score block and Overview tab: `screenshots/2026-09-24/synthetic/desktop/modal-cohort.png`.

### Proposal

- **`—` plus a tooltip** wherever the score would come from no stake: *"No score yet: nobody holds a non-zero position on this agent. Unverified ≠ 50."* Gate on **total stake > 0** (support + oppose shares), not staker count.
- One pure display helper, e.g. `displayTrustScore(result) → number | null`, used by the card, the list row, the modal block, the Overview tab and the quality filter. Delete every `?? 50` / `: 50` / `: 100` literal listed above. While `agentTrust` is loading, show the loading "—" the 4b-modal stat row already uses, never 50.
- Card tier: pass the real ratio, or `null` → Unverified. Never the literal 50.
- Small-but-nonzero (Luda): keep the number, show its window next to it (thesis §6: "every ratio ships with its window size"), e.g. `50 · 1 backer · 0.001 tTRUST`. A confidence floor below which the number turns into "—" is a product decision. This report doesn't make it.
- **API/MCP:** `trustScore` is documented as *always present* (`CLAUDE.md`, `ScoreEnvelope`). Making it nullable is a contract change and needs its own decision. The 4b-list plan fixes the UI and leaves the envelope alone. The API's 50 stays a known, flagged gap.

---

## 4. Origin vs quality filters

### Rows per quality bucket today

The `/agents` filter uses `cardTrust.level` from `trust-score-engine.ts:202-208` (≥90 / ≥70 / ≥50 / ≥30). Scores are the live API `trustScore`s, which use the same function on the same inputs (`api-data.ts:212-217` vs `page.tsx:1756-1759`). Cohort rows have no vault data, so they score 50.

| Bucket | AgentScore (live) | ERC-8004 (264) | Total | Rows |
|---|---|---|---|---|
| Excellent (≥90) | 2 | 0 | **2** | OPEN CLAW 98, Code Helper AI 95 |
| Good (70–89) | 4 | 0 | **4** | AGI Tracker 85, Sorting Agent 82, CodeBuddy 81, Talaria 70 |
| Moderate (50–69) | 3 | 264 | **267** | all 267 at **exactly 50**: 2 pure prior + Luda (99 % prior) + 264 pure prior |
| Low (30–49) | 0 | 0 | **0** | n/a |
| Critical (<30) | 0 | 0 | **0** | n/a |

"Moderate" is 98 % of the page, and none of it is a moderate *quality* judgement. It's the unscored class. Fixture evidence: `screenshots/2026-09-24/synthetic/desktop/agents-quality-moderate.png` (267 cards), `…/agents-quality-low.png` ("No agents match this filter").

Separate inconsistency: the **API labels the same scores with different thresholds**. `ScoreEnvelope.tier` uses `getHybridLevel` (80/60/40/20, `hybrid-trust.ts:31-37`), so AGI Tracker (85), Sorting Agent (82) and CodeBuddy (81) are `"excellent"` in `/api/v1/agents` but land under **Good** on `/agents`.

### Proposal

- **Origin as tabs**, the primary split, with counts from the shared counts function: `All 273 · AgentScore 9 · ERC-8004 264`. It replaces the right-hand pill group (`page.tsx:1634-1666`).
- **Quality as a single dropdown** ("Score: Any"), options generated from the rows in view, each with its count, **0-count options hidden**. After the §3 fix, unscored rows get their own option, **"No score yet (266)"**, instead of inflating Moderate. That leaves Moderate at 1 (Luda).
- **Hide today:** Low and Critical (0 rows each). Excellent (2) and Good (4) stay as dropdown options, not permanent chips. Hiding follows the data, never a hardcoded list, so the buckets come back when rows exist.
- Unify the tier thresholds between the page and the API as part of the same commit, or at least name the difference in the tooltip. Picking which scale wins is a scoring decision for `CLAUDE.md` ("DO NOT change scoring weights without updating tests AND CLAUDE.md").

---

## 5. Render cost

### Still unvirtualized? Yes.

- The grid and list are `sorted.map(...)` over the full merged array (`page.tsx:1838`, `:1920`), inside an IIFE in the JSX of `AgentsPageContent`. That's one ~4,200-line component holding ~80 `useState` hooks, including all modal state.
- Per render, not memoized: `enriched` does one `BigInt()` parse + `calculateTrustScoreFromStakes` per row (`:1755-1761`), `filter`, then a full `sort` (`:1770`; the `stake` sort does 2 `BigInt`s per comparison, `agent-list-sort.ts:44-48`).
- Per card, per render: `formatTTrust(string)` → `BigInt(String(v))` (`format.ts:27-28`); `calculateTier(…Number(shares)/1e18…)` inside a try/catch IIFE (`:1878`); `getAgentNameFromAtom`, which **`JSON.parse`s every label and throws on each plain-string one** (`:1263-1269`), and every cohort label is a plain string; `getMomentumIndicator`; plus a `framer-motion` `motion.div` with an entrance animation per card (`:1855`). The list view staggers `i × 0.015 s`, so row 509 starts animating 7.6 s in (`:1938`).
- Because the list lives in the same component as the modal, **every modal state change re-renders every card**: opening the modal, the 15 s positions poll (`:753-759`), toggling "Back this agent", typing an amount.

### Measured

Method: `next build` + `next start` (production React). Headless Chromium 1194 at 1440×900. `/agents` fed by the fixture tool, all other external requests aborted. **Median of 5 runs.** The build used a stub `NEXT_PUBLIC_GRAPHQL_URL` so prerender could run offline; the `/agents` bundle is identical apart from that inlined string (first-load JS **491 kB**). Rows = cohort fixture rows; the page also renders the 9 AgentScore rows.

`listMs` = navigation start → all cards in the DOM. `TTI` = later of list-rendered, DCL, and the end of the last ≥50 ms long task before a ≥5 s quiet window (Lighthouse-style heuristic). `TBT` = Σ(long task − 50 ms) from FCP to TTI. Interaction columns are Event Timing durations (input delay + handlers + paint), i.e. INP-style.

| Cohort rows (cards) | CPU | List rendered | **TTI** | **TBT** | Long tasks | DOM nodes | JS heap | Open modal | "Back this agent" toggle | Origin tab click | Search keystroke |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 (9) baseline | 1× | 529 ms | **529 ms** | **0 ms** | 2 | 630 | 16 MB | 120 ms | 40 ms | 56 ms | 32 ms |
| **264 (273)** | 1× | 597 ms | **1,160 ms** (1,129–1,562) | **136 ms** | 7 | 6,438 | 33 MB | 176 ms | 56 ms | 88 ms | 56 ms |
| 500 (509) | 1× | 898 ms | **2,005 ms** (1,884–2,280) | **509 ms** | 14 | 11,630 | 45 MB | 240 ms | 88 ms | 144 ms | 88 ms |
| 0 (9) baseline | 4× | 2,090 ms | **2,090 ms** | **463 ms** | 8 | 631 | 18 MB | 392 ms | 72 ms | 96 ms | 56 ms |
| **264 (273)** | 4× | 2,878 ms | **5,350 ms** (5,141–5,507) | **2,817 ms** | 20 | 6,438 | 30 MB | **664 ms** | 216 ms | 296 ms | 264 ms |
| 500 (509) | 4× | 3,564 ms | **8,091 ms** (7,291–8,176) | **5,502 ms** | 21 | 11,640 | 43 MB | **992 ms** | 328 ms | 432 ms | 392 ms |

TTI parentheses are the min–max over the 5 runs.

What the numbers say:
- **The list is the cost.** At today's 264 rows, TTI more than doubles against the same page with no cohort (1.16 s vs 0.53 s at 1×). At 4× CPU (a common stand-in for a mid-range phone) it goes from 2.1 s to **5.4 s**, with **2.8 s of main-thread blocking**. At the 500-row cap: **2.0 s / 8.1 s** TTI and **0.5 s / 5.5 s** TBT.
- **~22 DOM nodes per card** ((6,438 − 630) / 264). The page grows linearly: 11.6k nodes at 509 cards.
- **Modal interactions pay for the list.** "Back this agent" only flips one boolean in the modal, yet it costs 40 → 56 → 88 ms at 1× and **72 → 216 → 328 ms at 4×** as rows go 0 → 264 → 500. That delta is the whole list re-rendering behind the modal. Opening the modal at 4× is **664 ms at 264 rows**, which is past the 500 ms "poor" INP line. It's 176 ms at 1×.
- Caveats: headless Chromium; 4× is CDP CPU throttling, not a real device; fixture responses are instant, so real Hasura latency adds wall-clock time before the list renders but doesn't change these render costs. The 0-row baseline still includes the rest of the page (9 cards, header, sidebar, wallet SDK init).

Reproduce: `npm run build && npx next start -p 3100`, then `node tests/e2e/agents-fixture.js measure <rows> <cpu> 5`.

---

## 6. Mobile

Captured at 390×844. The harness shots (`screenshots/2026-09-24/mobile/*.png`) show the empty/error layouts. Populated layouts are in the synthetic set (`screenshots/2026-09-24/synthetic/mobile/*.png`). Ranked by severity (broken before degraded before cosmetic):

1. **Modal tab bar hides the default tab (broken).** The four tabs sit in a non-wrapping `flex` row inside an `overflow-hidden` box (`page.tsx:2823-2824`). At 390 px only Overview / Attestations / Activity fit, and **Timeline**, the tab the modal opens on (`activeTab` defaults to `'timeline'`, `page.tsx:140`), is clipped: not visible and not scrollable, so once you leave it you can't get back to it. Evidence: `synthetic/mobile/modal-cohort.png`, `synthetic/mobile/modal-zero-stake-agentscore.png`.
2. **List view is unusable (broken).** Rows are `grid-cols-[auto_1fr_auto_auto_auto]` with fixed `w-20`/`w-16`/`w-12` columns, `gap-4`, `px-4` and a 32 px icon (`page.tsx:1913, 1940`). That leaves the `1fr` name column about **38 px** at 390 px, so names render as a single character, and the ERC-8004 chip is drawn **over** the stake value. Evidence: `synthetic/mobile/agents-list-listview.png`. (Grid is the default, so reach is lower than #3, but it's broken rather than degraded.)
3. **The card grid is 52,714 px tall (degraded).** 273 cards in one column at ~193 px each (`synthetic/mobile/agents-list.png`: 390 × 52,714). About 51,000 px of that is 264 zero-signal cohort cards carrying no per-row information (§2). Add the §5 4× numbers (TTI 5.4 s, TBT 2.8 s) and this is the most-felt mobile cost. The compact card (commit 3) and windowing (commit 5) fix it.
4. **The toolbar pushes every agent below the fold (degraded).** Six quality chips + three origin pills + the sort select wrap into **4 rows** (`page.tsx:1606-1678`). Below the 3-line title and the header line, the results line lands at y ≈ 750 and the first card at y ≈ 800, behind the 64 px bottom nav, so **the first screen shows no agent at all.** Evidence: `mobile/agents-list.png` (harness, same toolbar) and `synthetic/mobile/agents-list.png`. Origin tabs + one quality dropdown (commit 4) make it one row.
5. **Modal "Agent Score / Stake Breakdown" block is squeezed (degraded).** `grid grid-cols-2 gap-6` with no breakpoint (`page.tsx:2592`) gives two ~140 px columns: "Support (100.0%)" and every tTRUST value wrap to two lines. This is also the block that shows the prior-50 (§3). Evidence: `synthetic/mobile/modal-zero-stake-agentscore.png`.
6. **Fixed chrome over the modal (cosmetic).** The AttestStickyBar (`bottom: 4rem`, z-45, `AttestStickyBar.tsx:22-24`) plus the bottom nav (64 px, z-40, `MobileNav.tsx:70`) permanently cover ~128 px (15 %) of the 844 px viewport. The modal's `pb-36` keeps everything reachable, so nothing is lost, only space. (In full-page PNGs these fixed bars paint mid-image. That's a capture artifact, see REPO_MAP §6.)
7. **Sidebar: nothing broken.** It's desktop-only (`Sidebar` in `layout.tsx:86`), and mobile gets the bottom nav.

---

## Proposed 4b-list plan (not implemented)

Five commits, each independently shippable and each with its own test story. The order follows severity: honesty first, then counters, then layout, then performance.

### Commit 1: `fix(agents): no stake, no score — "—" instead of the 50 prior`
- Pure `displayTrustScore(result)` → `number | null` (null when support + oppose shares = 0), in `trust-score-engine.ts` or a new `score-display.ts`. The card, list row, modal Agent Score block, Overview tab, card tier and quality-filter level all read it. Remove the `?? 50` / `: 50` / `: 100` literals listed in §3. Card tier gets the real ratio, or Unverified.
- Tooltip copy per §3. Luda-type rows keep their number and gain "· n backers · x tTRUST".
- API envelope untouched (contract). The gap stays documented in `CLAUDE.md`'s scoring section.
- **Tests:** unit tests for `displayTrustScore`: 0/0 → null; 1 position with 0 shares → null; Luda (0.00098) → 50; OPEN CLAW → 98. Then `grep -nE "\?\? 50|: 50\b|: 100$" src/app/agents/page.tsx` → 0 (REPO_MAP §6 grep-rule style). Harness: `modal-zero-stake-agentscore` and `agents-list` shots show "—" for On-Chain Data Analyzer and Agent Avatar Coder.

### Commit 2: `fix(agents): one counts source for header + results line; failure ≠ empty`
- Pure `computeAgentListCounts({ agentScore, cohort, junkCount, search, originFilter, errors })` in `lib/`. The header and results line render only from it. Search applies to both corpora consistently. Pluralization ("1 agent").
- `fetchCohortAgents()` gains `error: boolean` (or a discriminated result). The header shows "ERC-8004 cohort unavailable" instead of dropping the segment, and "live feed" only when both fetches succeeded.
- AgentScore fetch reports truncation per REPO_MAP §7 rule 1 (aggregate count on the same `where`). Truncation compares deduped subjects on both sides.
- Out of this commit, filed as follow-ups: `/api/v1/stats` counting pre-junk rows, and the landing badge counting its `limit: 8`.
- **Tests:** unit tests for `computeAgentListCounts`: search filters both corpora; cohort error vs empty cohort produce different output; truncated/untruncated; singular/plural. `fetchCohortAgents` error-flag tests alongside the existing truncation tests.

### Commit 3: `feat(agents): compact zero-signal card + attester/report counts on the list`
- One chunked bulk query for distinct attesters and reports per visible row (pattern: `fetchClassification`). `isZeroSignal(row)` is pure, per the §2 gate. The compact card renders name + origin + one Attest CTA. Header segment "(N without any signal)" comes from commit 2's counts function.
- Full cards gain the canonical unit: "1 attester · 0.0099 tTRUST attested", above the vault line (4b-modal's order).
- **Tests:** `isZeroSignal` unit tests: Dackie (1 attester, 0 vault) → **full** card; cohort row without data → compact; Luda → full. Chunking test (≤200 ids per request). Harness: `agents-list-erc8004` desktop and mobile before/after.

### Commit 4: `feat(agents): origin tabs + data-driven quality dropdown`
- Origin as tabs with counts. Quality as a dropdown built from the rows' `displayTrustScore` levels, including "No score yet", with 0-count options hidden.
- Tier thresholds: page and API unified, or explicitly labelled (needs a `CLAUDE.md` scoring-section decision first).
- **Tests:** a pure `qualityOptions(rows)` unit test: today's fixture gives Excellent 2 / Good 4 / Moderate 1 / No score 266, with Low and Critical absent. Harness mobile `agents-list` shows a one-row toolbar.

### Commit 5: `perf(agents): memoized AgentCard, list state split from modal, windowed rendering`
- Extract `AgentCard` / `AgentRow` as `React.memo` components. Precompute `enriched` / `sorted` in `useMemo` keyed on data + filters only. Move the modal into its own component so modal state no longer re-renders the list. Parse `atom.data` JSON once per row, not per render. Drop per-card entrance animations beyond the first screen.
- Windowing: no new dependency is needed for 273–509 rows. Render the first ~60 cards and append via `IntersectionObserver` ("showing 60 of 273 · load more", counted per §7). A virtualization library is a separate decision if the cohort cap is ever raised past 500.
- **Tests:** unit tests for the extracted pure row derivation. Performance acceptance with `tests/e2e/agents-fixture.js measure` at 264 and 500 rows, 1× and 4× CPU, against the §5 table: TBT and the modal-open / accordion interaction durations must fall. Record the new table in this file.

Mobile fixes from §6 ride the commits that already touch the same markup, so there's no separate "mobile" commit:
- §6 #1: the modal tab strip gets `overflow-x-auto` (and the active tab scrolled into view). Commit 1, which already edits the modal's score blocks.
- §6 #5: the Agent Score grid gets `grid-cols-1 sm:grid-cols-2`. Commit 1.
- §6 #2: list-view Stakes/Stakers columns go `hidden sm:block`, and the origin chip moves under the name. Commit 3, which reworks the row content.
- §6 #3 and #4: compact card (commit 3), one-row toolbar (commit 4), windowing (commit 5).
- Test story for all of these: `npm run shots` mobile + `node tests/e2e/agents-fixture.js shots`. Compare before/after PNGs for `modal-*`, `agents-list-listview`, `agents-list`; the first mobile screen must show at least one card.

## Side findings (outside 4b-list)

- **`/agents/[id]` cannot show any ERC-8004 agent.** `getAgentDetail` only searches the AgentScore label-prefixed atoms (`api-data.ts:322-325`), so the live `GET /api/v1/agents/<dackie>` → **404 "Agent not found"**. `agent-profile-dackie` will be "Agent Not Found" even with live data (`screenshots/2026-09-24/*/agent-profile-dackie.png` shows the offline variant). Nothing links cohort cards there today (cards open the modal), so this is latent until something does.
- **`/leaderboard` prerender has no graceful degradation.** The build prerenders it, and a non-JSON GraphQL response (this sandbox's proxy denial body) throws `SyntaxError: Unexpected token 'H'` and fails `next build`. On Vercel it passes because the endpoint answers, but it contradicts REPO_MAP §6 ("data-layer fetches degrade gracefully").
- **The modal timeline says a cohort agent "was registered on AgentScore."** `trust-timeline.ts:129` uses that copy for every agent, including ERC-8004 cohort atoms, which were indexed by Intuition and never registered here (`synthetic/desktop/modal-cohort.png`). Small copy fix; its origin should decide the wording.
- REPO_MAP §6's test count ("33 test files, 388 tests") is stale; it's 35 / 411 today. Not changed in this run.
