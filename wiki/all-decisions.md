# Scoring Formula Decision

> Why 60/40? Why tau? Why soft gate?

---

## AGENTSCORE = trustScore × 0.60 + compositeScore × 0.40

### Why 60% economic, 40% quality?
- Economic signal (how much staked) is primary — it has real cost
- Quality metrics prevent pure capital domination
- 50/50 would give too much weight to metrics that can be gamed (diversity, stability)
- 70/30 would make quality metrics almost irrelevant
- 60/40 = economic truth with quality correction

### Why tau = 0.1 (testnet)?
- Low tau = score moves faster with less stake → good for testnet with small amounts
- Mainnet tau = 50 → requires significant stake for confidence
- Formula: confidence = 1 - e^(-totalStake/tau)
- At tau=0.1: 0.1 tTRUST → 63% confidence
- At tau=50: 50 TRUST → 63% confidence

### Why soft gate?
- Problem: agent with 10% support and 90% oppose shouldn't score 40+
- Solution: if supportRatio < 50% → score × (ratio/50)
- 10% support → score × 0.20 (crushed)
- 30% support → score × 0.60 (penalized)
- 50%+ support → full score (no penalty)

---

# Evaluator System Decision

> Why accuracy-weighted? Why 0.5x–1.5x? Why tau=5?

---

## Core Insight
Every TRUST weighs the same regardless of who staked it. A staker who correctly identified 10 good agents has the same influence as a staker who was wrong 10 times. This is unfair and exploitable.

## Formula
```
rawAccuracy = goodPicks / totalPicks
confidence = 1 - e^(-totalPicks / 5)
adjustedAccuracy = 0.5 + (rawAccuracy - 0.5) × confidence
evaluatorWeight = 0.5 + adjustedAccuracy
```

### Why 0.5x–1.5x range?
- 0.5x floor: bad evaluators still have SOME influence (not zero — that would be punitive)
- 1.5x cap: good evaluators get 50% bonus, not 10x (prevents Oracle oligarchy)
- Narrow range prevents any single evaluator from dominating

### Why tau=5?
- 5 evaluations → 63% confidence
- 20 evaluations → 98% confidence
- Fast enough to differentiate after ~10 picks
- Slow enough that 1 lucky pick doesn't grant Oracle status

### Why self-staking excluded?
- You can't build evaluator reputation by staking on your own agents
- Prevents: register agent → stake on it → get 100% accuracy → high weight
- Only EXTERNAL evaluations count

### Why "good pick" = support on >50% trust?
- Support agent that maintained trust → correct evaluation
- Oppose agent that lost trust → correct evaluation
- Threshold at 50% = neutral line (could discuss 60% as "clearly good")

### Edge case: trust exactly 50%
- Currently: neither good nor bad for both sides
- TODO: consider excluding from track record

### Feedback loop analysis
- Evaluator weight → higher score → better track record → higher weight?
- Bounded at 1.5x, track record across ALL agents (not one), confidence anchoring
- Minimal loop risk. Monitor on mainnet.

---

# Fee Model Decision

> Why hybrid? Why 2.5%? Why free registration?

---

## Hybrid Model
- Registration (createAtom/createTriple) → direct MultiVault → creator = user wallet
- Staking (deposit) → FeeProxy → fee taken → rest to MultiVault
- Redeem → direct MultiVault → free (no fee on exit)

### Why free registration?
- Barrier removal: anyone can register without paying platform fee
- Creator = user wallet (important for ownership)
- Protocol fee (~0.002 tTRUST) still applies (Intuition's fee)

### Why 2.5%?
- Low enough: not a barrier to staking
- High enough: generates revenue at scale
- Industry standard: similar to DEX fees (Uniswap 0.3%, but we're app layer)
- 0.02 tTRUST fixed + 2.5% variable = covers dust-amount transactions

### Why free redeem?
- User-friendly: no fee to exit
- Prevents lock-in feeling
- MultiVault bonding curve already captures value on entry

---

# Agent Card Design Decision

> Why JSON labels? Why profile completeness? Why not separate triples per field?

---

## JSON Atom Labels (Option A — chosen)
Store all metadata in atom label as JSON string:
```json
{"name":"CodeBuddy","description":"...","endpoints":{"api":"..."},"source":{"github":"..."}}
```

### Why not separate triples per field (Option B)?
- Each triple needs its own atom for the value → many atoms for one agent
- Each atom creation = gas cost
- On testnet: fast iteration, JSON is simpler
- On mainnet (Phase 2): migrate to Option B with dedicated predicates

### Backward compatibility
- Old agents: plain string labels → parseAgentCard() returns {name: label}
- New agents: JSON labels → full metadata
- Both work in UI and API

## Profile Completeness

### Why gamification?
- Motivates filling optional fields without making them required
- Visual progress bar triggers completion instinct
- A2A Ready badge when endpoint + skill filled

### Why NOT in scoring?
- Profile completeness ≠ trust
- Gaming: fill fake URLs → 100% completeness → higher score? NO.
- Completeness is VISUAL credibility signal, not mathematical input

---

# IntuForge Concept Decision

> Why launchpad? Why inside AgentScore? Why not separate app?

---

## Why launchpad?
- Gap: Intuition has protocol but no project discovery layer
- Every ecosystem has this: Ethereum→ICOs, Solana→pump.fun
- Builders work in isolation, no structured way to announce/find collaborators
- Grant alignment: high trust projects = strong grant candidates

## Why inside AgentScore?
- 90% code reuse (scoring, evaluator, FeeProxy, UI, API patterns)
- Shared user base (wallet already connected)
- Unified evaluator track record (stake on agents AND projects)
- Faster to build (weeks, not months)
- Separate app = duplicate infrastructure + split attention

## Why NOT token launchpad?
- Token launches attract speculators, not builders
- Regulatory risk
- Intuition's value is knowledge graph, not token creation
- "Trust launchpad" > "token launchpad" for ecosystem health
