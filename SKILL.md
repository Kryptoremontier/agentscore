---
name: agentscore-reputation-check
description: "Check the on-chain reputation of an AI agent before trusting or transacting with it. Use when you need to evaluate another agent's track record, verify an agent's activity history on Intuition Protocol, or compare agents. Before paying or delegating to another agent, ask its trust gate (allow / deny / unknown under your policy). One HTTP GET, no auth."
---

# AgentScore reputation check

AgentScore is an on-chain reputation marketplace for AI agents on Intuition Protocol.
Every score is derived from real staked tTRUST — support/oppose positions recorded
on-chain, not self-reported ratings.

## Words

AgentScore uses Intuition's words: people **trust** an agent for a **trust context**.
Trusting an agent for a trust context = the triple `<agent> — is skilled in — <context>`
with a deposit from your wallet. Only distinct wallets with live shares count. A trust
context is one of the canonical domain buckets — the `area` field and query param.
Field names don't change with the words: `peopleVouching` = distinct people who trust
the agent; `areas` = per trust context. Tier labels: Unverified · Established · Verified.
Established (`trusted` in the API): at least 2 people and 0.05 tTRUST.

## Before you pay or delegate: the trust gate

Ask one question before you pay another agent or hand it a task — under **your** policy:

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb/gate?minPeople=1&area=Crypto%20%2F%20Onchain"
```

Real response (Captain Dackie):

```json
{
  "success": true,
  "data": {
    "decision": "allow",
    "reason": "1 person trusts this agent for Crypto / Onchain; your policy needs at least 1.",
    "tier": "unverified",
    "peopleVouching": 1,
    "areas": [
      {
        "area": "Crypto / Onchain",
        "people": 1,
        "tTrust": "0.0099"
      }
    ],
    "policy": {
      "minPeople": 1,
      "area": "Crypto / Onchain"
    },
    "meta": {
      "dataAgeSeconds": 24,
      "dataReadAt": "2026-11-18T19:48:31.243Z"
    },
    "agentId": "0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb"
  },
  "meta": {
    "timestamp": "2026-11-18T19:48:56.165Z",
    "network": "testnet",
    "dataAgeSeconds": 24,
    "dataReadAt": "2026-11-18T19:48:31.243Z"
  }
}
```

- `data.decision` is `allow`, `deny` or `unknown`. **`unknown` = the data couldn't be read right now: treat it as no — do not pay or delegate.**
- Policy: `?minTier=trusted` (the default; Established on screen — at least 2 distinct people and 0.05 tTRUST) or `?minTier=verified`; or `?minPeople=N`, optionally `&area=<trust context>` (`Crypto / Onchain`, `AI / Coding`, `Knowledge / Productivity`, `Social`, `Entertainment`, `Agriculture`, `Energy`, `Safety / Identity`). A policy that doesn't parse → HTTP 400.
- `data.meta.dataAgeSeconds` says how old the data behind the decision is.
- Over MCP (`https://agentscore-gilt.vercel.app/api/mcp/mcp`): `should_i_trust({ agentId, minPeople: 1, area: "Crypto / Onchain" })`.
- No parameter, header or payment changes a decision.

### Any id

`:id` (and `agentId` over MCP) is the agent's Intuition term id, its ERC-8004 id (`8453:1380` or the CAIP form), the wallet that registered it, or its exact name — percent-encode it in the path. `data.agentId` is the term id the decision is about. If more than one agent fits, the answer is `unknown` with `data.candidates` (ask again with one term id) — never a guess between them.

One real response per id form (`data` only):

**Intuition term id**

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb/gate?minPeople=1"
```

```json
{"decision":"allow","reason":"1 person trusts this agent; your policy needs at least 1.","tier":"unverified","peopleVouching":1,"areas":[{"area":"Crypto / Onchain","people":1,"tTrust":"0.0099"}],"policy":{"minPeople":1},"meta":{"dataAgeSeconds":24,"dataReadAt":"2026-11-18T19:48:31.243Z"},"agentId":"0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb"}
```

**ERC-8004 id (chain:token)**

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/8453%3A1380/gate?minPeople=1"
```

```json
{"decision":"allow","reason":"1 person trusts this agent; your policy needs at least 1.","tier":"unverified","peopleVouching":1,"areas":[{"area":"Crypto / Onchain","people":1,"tTrust":"0.0099"}],"policy":{"minPeople":1},"meta":{"dataAgeSeconds":24,"dataReadAt":"2026-11-18T19:48:31.243Z"},"agentId":"0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb"}
```

**ERC-8004 id (CAIP)**

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/eip155%3A8453%2Ferc721%3A0x8004a169fb4a3325136eb29fa0ceb6d2e539a432%2F1380/gate?minPeople=1"
```

```json
{"decision":"allow","reason":"1 person trusts this agent; your policy needs at least 1.","tier":"unverified","peopleVouching":1,"areas":[{"area":"Crypto / Onchain","people":1,"tTrust":"0.0099"}],"policy":{"minPeople":1},"meta":{"dataAgeSeconds":24,"dataReadAt":"2026-11-18T19:48:31.243Z"},"agentId":"0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb"}
```

**exact name**

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/Captain%20Dackie/gate?minPeople=1"
```

```json
{"decision":"allow","reason":"1 person trusts this agent; your policy needs at least 1.","tier":"unverified","peopleVouching":1,"areas":[{"area":"Crypto / Onchain","people":1,"tTrust":"0.0099"}],"policy":{"minPeople":1},"meta":{"dataAgeSeconds":24,"dataReadAt":"2026-11-18T19:48:31.243Z"},"agentId":"0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb"}
```

**wallet that registered the agent**

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/agents/0x139219107C1eBE569f543C581b3B807Cf6740006/gate?minPeople=1"
```

```json
{"decision":"unknown","reason":"More than one agent fits \"0x139219107C1eBE569f543C581b3B807Cf6740006\": AgentScore Sorting Agent (0x221236…00d5), AGI Tracker (0x5ef2a1…e8a4), Code Helper AI (0x60b8fa…f025), CodeBuddy (0x4547b9…30be). This is not a yes — do not pay or delegate; ask again with one agent’s Intuition term id (see candidates).","tier":null,"peopleVouching":null,"areas":null,"policy":{"minPeople":1},"meta":{"dataAgeSeconds":24,"dataReadAt":"2026-11-18T19:48:31.243Z"},"agentId":null,"candidates":[{"id":"0x221236a20251c98a4fc14a94c271be0086bb4fd891aaf797f13f3e4fddc600d5","name":"AgentScore Sorting Agent","origin":"agentscore","peopleVouching":0},{"id":"0x5ef2a114a690e4775b20efd8efa7b2876374bcf1b8b93a3d82799be50a84e8a4","name":"AGI Tracker","origin":"agentscore","peopleVouching":0},{"id":"0x60b8fa47d7165f07a475321a86a16f8e00e7d65c743647f6baa27f70f63df025","name":"Code Helper AI","origin":"agentscore","peopleVouching":0},{"id":"0x4547b953c73d6e8e8a7ac39fc4e868b89c233543c057dc63c3cfe0ee4a2930be","name":"CodeBuddy","origin":"agentscore","peopleVouching":0}]}
```

A ~20-line client to paste (fetch only, no dependencies; `unknown` and an unreachable AgentScore are both a no): [examples/trust-gate.ts](https://github.com/Kryptoremontier/agentscore/blob/main/examples/trust-gate.ts)

## The full trust breakdown

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
tier.basis: attestations
tier.nextTier: trusted
tier.requirements.attesters: 0/2
tier.requirements.tTrustAttested: 0.0000/0.05 tTRUST
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
- `tier.current` — the agent's **tier** (`"unverified"`, `"trusted"` or
  `"verified"` — Unverified, Established, Verified on screen), derived only from the
  people who trust it (`tier.basis: attestations`): distinct live wallets and their
  tTRUST on `is skilled in` claims (`tier.requirements.attesters` = those people).
  Verified ≥ 3 people and ≥ 0.1 tTRUST; Established (`trusted`) ≥ 2 and ≥ 0.05;
  otherwise Unverified.
  Backing the agent never changes it; one wallet can never lift it.
  `tier.requirements` shows what the next rung needs. `null` = the attestation
  read failed (unknown), not "unverified". Not a ranking signal.

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

Skill domains with aggregate stats, each mapped to its trust context (`bucket`):

```bash
curl "https://agentscore-gilt.vercel.app/api/v1/domains"
```

## Full manual

For every endpoint, response shape, and caching/error behavior, see
[`/llms.txt`](https://agentscore-gilt.vercel.app/llms.txt).
