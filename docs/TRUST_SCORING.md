# AgentScore — Trust Scoring System

> Complete technical documentation of the trust scoring engine.
> All pricing data reads directly from MultiVault contract — no approximations.

---

## Overview

AgentScore uses a three-layer scoring system that combines economic
confidence with multi-dimensional quality metrics. The main score
displayed to users is the **AGENTSCORE** (Hybrid Trust Score).

```
AGENTSCORE = (Trust Score × 0.60 + Composite Score × 0.40) × soft_gate
```

---

## Layer 1: Trust Score (Economic Confidence)

**Weight in AGENTSCORE: 60%**

Measures how much economic stake backs an agent's reputation.

### Formula

```
base = supportStake / totalStake × 100
confidence = 1 - e^(-totalStake / tau)
anchored = 50 + (base - 50) × confidence
trustScore = anchored + momentum
```

### How it works

- **Anchored at 50** — starts neutral. Moves toward real ratio only
  as economic stake grows.
- **Confidence function** — exponential growth. Small stake = low
  confidence = score stays near 50. Large stake = high confidence =
  score reflects true support ratio.
- **Momentum** — 24-hour stake flow adds reactivity. Capped to
  prevent manipulation.

### Parameters

| Parameter | Testnet | Mainnet |
|-----------|---------|---------|
| tau (confidence rate) | 0.1 tTRUST | 50 TRUST |
| Momentum cap | ±5 points | ±5 points |

### Examples

| Scenario | Base Ratio | Total Stake | Confidence | Trust Score |
|----------|-----------|-------------|------------|-------------|
| 1 staker, tiny stake | 100% | 0.01 tTRUST | ~10% | ~55 |
| 5 stakers, medium stake | 80% | 0.5 tTRUST | ~99% | ~80 |
| Many stakers, split opinion | 60% | 2.0 tTRUST | ~100% | ~60 |
| No stakers | — | 0 | 0% | 50 (neutral) |

---

## Layer 2: Composite Trust Score (Quality Metrics)

**Weight in AGENTSCORE: 40%**

Multi-dimensional quality assessment with four pillars.

### Formula

```
composite = signalRatio × 0.40
          + stakerDiversity × 0.25
          + stability × 0.25
          + priceRetention × 0.10
```

### Pillar 1: Signal Ratio (40% of Composite)

Time-weighted support vs oppose ratio.

```
weight = 0.5 ^ (daysAgo / 90)          — half-life 90 days
if (daysAgo < 7): weight × 1.5         — freshness bonus

weightedRatio = sum(support × weight) / sum(all × weight) × 100
```

- Old stakes gradually lose influence (half-life 90 days)
- Fresh stakes get 1.5× bonus for first 7 days
- Agent ignored for 3 months naturally drops without anyone unstaking

### Pillar 2: Staker Diversity (25% of Composite)

Logarithmic scale measuring unique qualified stakers.

```
qualified = stakers with ≥ 0.1 tTRUST stake (anti-sybil threshold)
diversity = min(100, log2(qualified) / log2(100) × 100)
```

| Qualified Stakers | Diversity Score |
|-------------------|----------------|
| 1 | 0 |
| 5 | 33 |
| 10 | 50 |
| 20 | 65 |
| 50 | 85 |
| 100+ | 100 |

**Anti-sybil protection:** Only stakers with ≥ 0.1 tTRUST count
toward diversity. 20 wallets with dust amounts (0.001 tTRUST each)
produce 0 diversity score. Gaming diversity costs real money.

**Why logarithmic?** Linear scale (old model) maxed out at 20 stakers.
An agent with 20 vs 500 stakers scored the same. Logarithmic scale
rewards growth at all levels while making it progressively harder
to reach 100%.

### Pillar 3: Stability (25% of Composite)

Days maintaining trust ratio above 50%, with variance penalty.

```
baseStability = min(100, stableDays / 30 × 100)
variancePenalty = max(0, 1 - stdDev / 50)
stability = baseStability × variancePenalty
```

- Agent stable at 70% for 30 days → 100 × ~1.0 = ~100
- Agent bouncing 49–51% daily for 30 days → 100 × ~0.5 = ~50
- Agent stable at 70% for 15 days → 50 × ~1.0 = ~50

**Variance penalty** ensures that consistent performance is rewarded
over volatile oscillation, even if both spend the same number of days
above 50%.

### Pillar 4: Price Retention (10% of Composite)

Current on-chain share price vs all-time high.

```
priceRetention = (currentSharePrice / allTimeHigh) × 100
```

- Read from MultiVault `currentSharePrice()` — on-chain, real-time
- Measures market confidence — declining price = declining trust
- Lower weight (10%) because new agents always start at 100% retention
  (ATH = current price), making it less informative early on

---

## Soft Gate (Anti-Gaming Protection)

The soft gate ensures agents with low support can never achieve
high scores, regardless of diversity, stability, or price retention.

### Formula

```
if supportRatio < 50%:
  finalScore = hybridScore × (supportRatio / 50)
else:
  finalScore = hybridScore
```

### How it scales

| Support Ratio | Scale Factor | Example (raw=60) |
|---------------|-------------|-------------------|
| 10% | × 0.20 | 12.0 |
| 20% | × 0.40 | 24.0 |
| 30% | × 0.60 | 36.0 |
| 40% | × 0.80 | 48.0 |
| 50%+ | × 1.00 | 60.0 (full) |

**No hard cutoff.** Smooth, continuous scaling. An agent at 29% support
scores proportionally lower than one at 31% — no sudden jumps.

**Why this matters:** Without the soft gate, an agent with 10% support
but high diversity (many stakers opposing it) and high stability
(consistently low support) could achieve a Composite score of 60+.
The soft gate caps this to ~12, reflecting reality: most people
don't trust this agent.

---

## Time-Weighted Trust (Separate Indicator)

Independent metric displayed alongside AGENTSCORE. Not mixed into
the main score.

```
weight = 0.5 ^ (daysAgo / 90)
if (daysAgo < 7): weight × 1.5    — freshness bonus

timeWeightedTrust = sum(forStake × weight) / sum(allStake × weight) × 100
```

Shows **trend**: is trust growing or decaying? Useful for comparing
an agent's current momentum vs its historical average.

---

## Trust Tiers

Multi-dimensional thresholds — ALL criteria must be met to reach a tier.

| Tier | Min Stakers | Min Stake | Min Ratio | Min Days |
|------|------------|-----------|-----------|----------|
| ○ Unverified | 0 | 0 | — | 0 |
| ◐ Sandbox | 3 | 0.1 tTRUST | any | 0 |
| ✓ Trusted | 10 | 1 tTRUST | 60% | 7 |
| ⭐ Verified | 25 | 5 tTRUST | 75% | 30 |

Thresholds calibrated for testnet. Mainnet thresholds will be higher.

---

## Anti-Manipulation: Four Layers of Protection

| Layer | What it prevents |
|-------|-----------------|
| **Soft gate** | High scores for unpopular agents |
| **Logarithmic diversity** | Whales inflating trust alone |
| **Minimum stake threshold** | Sybil attacks with dust wallets |
| **Variance penalty** | Artificially maintaining 50%+ through oscillation |

Combined, these make gaming AgentScore economically expensive
and technically difficult. Real trust — backed by meaningful stake
from diverse participants over sustained time — is the only way
to achieve a high score.

---

## On-Chain Data Sources

All pricing data comes from Intuition MultiVault contract:

| Function | Used for |
|----------|---------|
| `currentSharePrice(termId, curveId)` | Price Retention pillar, UI display |
| `previewDeposit(termId, curveId, assets)` | Buy preview, slippage protection |
| `previewRedeem(termId, curveId, shares)` | Sell preview, P&L valuation |
| `convertToAssets(termId, curveId, shares)` | Position current value |

15-second cache. Automatic fallback to local approximation if RPC fails.

---

## Future: Phase 3 — Performance Pillar

When Proof of Performance launches, a 5th pillar will be added
to Composite Trust Score:

```
New weights:
  Signal Ratio:      35% (was 40%)
  Staker Diversity:  15% (was 25%)
  Stability:         20% (was 25%)
  Price Retention:   10% (unchanged)
  Performance:       20% (NEW)

Performance = avgTaskScore × 60 + successRate × 40
```

AI agents evaluate each other through task delegation and outcome
reporting. Performance data feeds directly into trust scores,
creating a self-reinforcing loop where good agents attract more
delegations and higher economic stakes.

---

*AgentScore Trust Scoring System v2.0 — March 2026*
