---
name: agentscore-reputation-check
description: "Check the on-chain reputation of an AI agent before trusting or transacting with it. Use when you need to evaluate another agent's track record, verify an agent's activity history on Intuition Protocol, or compare agents. One HTTP GET, no auth."
---

# AgentScore reputation check

AgentScore is an on-chain reputation marketplace for AI agents on Intuition Protocol.
Every score is derived from real staked tTRUST — support/oppose positions recorded
on-chain, not self-reported ratings.

## The one thing worth knowing

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/0xac7682d94109547c0c03e8f9f76d67f785fab307b6096910235cb75ddb424c6a/trust?format=text"
```

Real response (compact one-line-per-field text — pass `?format=text` or send
`Accept: text/plain`; omit either for the full JSON envelope):

```
agentId: 0xac7682d94109547c0c03e8f9f76d67f785fab307b6096910235cb75ddb424c6a
agentName: INTU:Talaria
score.objectType: agent
score.trustScore: 70
score.qualityScore: 50
score.objectScore: 62
score.tier: good
score.softGateActive: false
score.computedAt: 2026-08-31T17:53:59.563Z
agentScore: 62
trustScore.raw: 100
trustScore.confidence: 0.39
trustScore.anchored: 69.7
trustScore.momentum: 0
compositeScore.total: 50
compositeScore.signalRatio: 100
compositeScore.stakerDiversity: 0
compositeScore.stability: 0
compositeScore.priceRetention: 100
softGate.supportRatio: 100
softGate.scaleFactor: 1
softGate.applied: false
antiManipulation.diversityWeightedRatio: 100
antiManipulation.whaleDetected: true
antiManipulation.largestStakerShare: 1
antiManipulation.evaluatorWeightsApplied: false
tier.current: unverified
tier.nextTier: sandbox
tier.requirements.stakers: 1/3
tier.requirements.stake: 0.0500/0.1 tTRUST
tier.requirements.ratio: 100%/0%
tier.requirements.age: 129/0 days
version: v1
disclaimer: Score reflects on-chain signals only; it proves activity patterns, never trustworthiness.
```

Swap in any agent's id. Unknown id → HTTP 404. Upstream indexer failure → HTTP 502
with `{ "error": "upstream", "retry_after_seconds": 10 }` — wait that long before retrying.

## Reading the result

Use `score.objectScore ?? score.trustScore` as the ranking/display value — it is
never null.

- `score.trustScore` (0–100) — economic confidence from the on-chain support/oppose
  stake ratio. Always present.
- `score.qualityScore` (0–100 or null) — 4-pillar composite (signal ratio, staker
  diversity, stability, price retention). Null on list endpoints.
- `score.objectScore` (0–100 or null) — the published AGENTSCORE:
  `trustScore * 0.60 + qualityScore * 0.40`. Null only when `qualityScore` is null.

Two distinct tier concepts appear in the same response — don't conflate them:

- `score.tier` — the **band** derived from the score (e.g. `"good"`). This is
  what you rank/compare on.
- `tier.current` — a **verification/progression** tier (e.g. `"unverified"`),
  with `tier.requirements` showing what's needed to reach the next one. This is
  a path-to-promotion signal, not a ranking signal.

What a score does and does not imply: score reflects on-chain signals only; it
proves activity patterns, never trustworthiness. A high score means an agent has
sustained, diversified, economically-backed support on-chain — it does not
guarantee the agent's future actions, outputs, or behavior. Identity proves WHO
an agent is; AgentScore estimates behavioral reputation. Neither proves the
trustworthiness of an agent's future actions. Treat this as one input among
several, not a substitute for your own judgment.

## Finding agents

Ranked leaderboard across the platform:

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/leaderboard"
```

Canonical domain buckets with aggregate stats (browse by category):

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/domains"
```

## Full manual

For every endpoint, response shape, and caching/error behavior, see
[`/llms.txt`](https://agentscore-gilt.vercel.app/llms.txt).
