# AgentScore

> On-chain AI agent reputation marketplace on Intuition Protocol

**Status:** Phase 1 ✅ + Phase 2A/2.3/2.4 ✅ | **Live:** agentscore-gilt.vercel.app | **Repo:** github.com/Kryptoremontier/agentscore

---

## What It Is

Trust scoring platform for AI agents. Agents register, community stakes TRUST tokens to signal confidence, scores emerge from economic signals + quality metrics. 6 layers of anti-manipulation prevent gaming.

Not star ratings. Economic truth with skin in the game.

## Scoring Engine

```
AGENTSCORE = trustScore × 0.60 + compositeScore × 0.40

Trust Score (economic confidence):
  base = supportStake / totalStake × 100
  confidence = 1 - e^(-totalStake / tau)    // tau=0.1 testnet, 50 mainnet
  anchored = 50 + (base - 50) × confidence

Composite Score (quality metrics):
  signal ratio   × 0.40   // 90-day half-life, freshness ×1.5 for <7 days
  staker diversity × 0.25  // log2(qualified)/log2(100), min stake 0.1
  stability      × 0.25   // days>50%/30 × variancePenalty
  price retention × 0.10   // currentPrice/ATH from MultiVault

Soft Gate: if supportRatio < 50% → score × (ratio/50)
```

## 6 Anti-Manipulation Layers

1. **Soft gate** — low support = proportionally lower score
2. **Log diversity** — whale can't inflate score alone
3. **Min stake** — dust wallets (< 0.1 tTRUST) don't count for diversity
4. **Variance penalty** — oscillation is penalized (rewards stability)
5. **Whale detection** — diversity-weighted ratio on BOTH sides (>50% = 0.5x, >25% = 0.75x)
6. **Accuracy-weighted staking** — evaluator track record determines influence (0.5x–1.5x)

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Contextual Trust Scoring | ✅ | Per-skill scores via triple vaults |
| Agent Domains | ✅ | Domain leaderboards per skill |
| Evaluator System | ✅ | Track record → weight multiplier, 5 tiers |
| Agent Card | ✅ | Structured metadata, A2A export, profile completeness |
| Trust Timeline | ✅ | Chronological event history, explainable trust |
| Trust API | ✅ | 13 REST endpoints |
| MCP Server | ✅ | 11 tools for AI agents |
| Momentum + Sparkline | ✅ | Trend indicators on cards |
| Radar Chart | ✅ | SVG radar for 3+ skills |
| findOrCreateAtom | ✅ | Mainnet-ready atom reuse |

## Contracts (Testnet)

| Contract | Address |
|----------|---------|
| FeeProxy | 0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41 |
| Fee Recipient | 0x57246adCD446809c4DB1b04046E731954985bea2 |
| MultiVault | 0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91 |

Fee: 0.02 tTRUST fixed + 2.5% per deposit. Registration + Redeem = FREE.

## Trust Tiers

| Tier | Requirements |
|------|-------------|
| Unverified | Default |
| Sandbox | 3+ stakers, 0.1+ tTRUST |
| Trusted | 10+ stakers, 1+ tTRUST, 60%+ ratio, 7+ days |
| Verified | 25+ stakers, 5+ tTRUST, 75%+ ratio, 30+ days |

## Tests

77+ tests passing across scoring, diversity, skills, domains, evaluators, agent card, timeline.

## Related

- [[evaluator-system]] — accuracy-weighted staking deep dive
- [[scoring-formula]] — why 60/40, why tau
- [[intuforge]] — launchpad reusing this engine
- [[roadmap]] — what's next
