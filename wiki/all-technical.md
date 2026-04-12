# GraphQL Schema Notes

> Discovered quirks and workarounds for Intuition GraphQL.

---

## Key Discoveries

### termId vs id
- Atoms use `term_id` not `id` in some queries
- Positions reference atoms by `term_id`
- Always check which identifier is expected

### Positions are separate
- Positions NOT nested inside atoms in GraphQL response
- Must batch-fetch positions separately by vault IDs
- Pattern: query triples → extract vault IDs → batch fetch positions

### as_subject_triples JOIN timeout
- Hasura JOIN on `as_subject_triples` in WHERE clause causes 30s+ timeout
- Fix: replaced with lightweight prefix filter on indexed `label` column (~1s)
- Discovered when Evaluator Leaderboard was empty

### Timestamps available
- `atoms.created_at` — registration timestamp ✅
- `signals.created_at` — staking event timestamp ✅ (used in Trust Timeline)
- `triples.created_at` — available via API/MCP

### BigInt serialization
- vault.totalShares returns BigInt strings
- JSON.stringify fails on BigInt → must convert to number via weiToFloat()
- Pattern: `Number(BigInt(shares) * BigInt(price) / BigInt(1e18)) / 1e18`

---

# FeeProxy Pattern

> How our monetization works on-chain.

---

## Flow
```
User clicks "Stake 1 tTRUST"
  → UI calculates: 1 + 0.02 fixed + 2.5% = ~1.045 tTRUST
  → User approves 1.045 tTRUST to FeeProxy
  → FeeProxy.depositTriple(vaultId, amount)
  → FeeProxy takes fee → sends to feeRecipient
  → FeeProxy forwards rest → MultiVault.deposit()
  → User gets shares in vault
```

## Key Points
- approve() must be called BEFORE deposit (ERC-20 pattern)
- Slippage protection: 2% tolerance from on-chain previewDeposit quote
- Registration = direct MultiVault (not FeeProxy) → creator = user wallet
- Redeem = direct MultiVault (free, no fee)

## Bug History
- FeeProxy approve bug (early March) — Zet helped resolve, Bright Senpai had same issue

---

# Bug Log

| Date | Bug | Fix | Impact |
|------|-----|-----|--------|
| Early March | FeeProxy approve not called before deposit | Added approve step in staking flow | Staking failed |
| Mid March | Evaluator weights calculated but not connected to AGENTSCORE | Wired useAgentStakerWeights into calculateDiversityWeightedRatio | Evaluator system decorative only |
| Mid March | Evaluator Leaderboard empty (timeout) | Replaced as_subject_triples JOIN with prefix filter | 30s→1s query |
| Late March | DomainAgent BigInt not JSON serializable | weiToFloat() conversion | API 500 errors |
| Late March | termId vs id mismatch in GraphQL | Standardized on term_id | Missing data |

---

# Cursor Prompts Log

> All 20 prompts executed, with outcomes.

| # | Prompt | Status | Tests | Key Outcome |
|---|--------|--------|-------|-------------|
| 1 | Hybrid Trust Score | ✅ | — | 60/40 formula, soft gate |
| 2 | Trust Model Improvements | ✅ | — | Composite 4 pillars |
| 3 | README Update | ✅ | — | Professional README |
| 4 | Diversity-Weighted Ratio | ✅ | 14 | Whale detection both sides |
| 5 | Contextual Trust Scoring | ✅ | 6 | Per-skill breakdown |
| 6 | Momentum Arrow + Sparkline | ✅ | — | Trend indicators |
| 7 | Visual Polish | ✅ | — | Unified tier colors |
| 8 | Agent Domains | ✅ | 13 | Domain leaderboards |
| 9 | Create Claims Redesign | ✅ | — | 3 categories |
| 10 | Accuracy-Weighted Staking | ✅ | 17 | Evaluator system + leaderboard |
| 11 | Docs Redesign | ✅ | — | 6 tabs |
| 12 | Navigation Redesign | ✅ | — | Sidebar + mobile bottom bar |
| 13 | Roadmap Update | ✅ | — | Phase 1-4 detailed |
| 14 | Landing Features Update | ✅ | — | Evaluator + contextual + domains cards |
| 15 | Trust API Week 1 | ✅ | — | 12→13 REST endpoints |
| 16 | MCP Server | ✅ | — | 11 tools |
| 17 | Agent Card Phase 2A | ✅ | 16 | Structured metadata, A2A export |
| 18 | Trust Timeline | ✅ | 11 | Explainable trust history |
| 19 | IntuForge Phase 1 | ✅ | 33 | Launchpad UI shell |
| 20 | IntuForge Phase 1.5 | 📝 Ready | — | Connect real data (not executed yet) |

**Total tests from prompts: 110+**
