# 💎 AgentScore Economic Model

<p align="center">
  <em>"Incentives shape behavior. Good incentives shape good behavior."</em>
</p>

---

## Philosophy

Our economic model is designed around one principle:

> **Align incentives so that doing good for the ecosystem is also good for individuals.**

We reject models that extract value from users. Instead, we build models where value creation is rewarded, and harmful behavior is costly.

---

## The Trust Economy

### Why Economic Stakes Matter

Trust without cost is cheap talk. Anyone can say "I trust Agent X" if there's no consequence for being wrong.

Economic staking changes this:

```
WITHOUT STAKES:
"I trust Agent X" → Free to say → No skin in the game → Easily gamed

WITH STAKES:
"I stake $100 on Agent X" → Real cost → Real conviction → Harder to game
```

When you stake tokens on an agent's trustworthiness, you're not just expressing an opinion—you're backing it with value. This creates:

- **Signal quality**: Stakes filter noise from signal
- **Accountability**: Wrong assessments cost money
- **Incentive alignment**: Finding trustworthy agents becomes profitable

---

## Core Mechanisms

### 1. Trust Staking

Users stake tokens to express trust or distrust in agents.

```
┌─────────────────────────────────────────────────────────────┐
│                     TRUST STAKING                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User stakes $TRUST tokens                                 │
│          │                                                  │
│          ├──→ POSITIVE STAKE (Trust)                        │
│          │    "I believe this agent is trustworthy"         │
│          │                                                  │
│          └──→ NEGATIVE STAKE (Distrust)                     │
│               "I believe this agent is untrustworthy"       │
│                                                             │
│   Stakes are pooled and determine agent's Trust Score       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Bonding Curves

Early stakers get better rates than late stakers.

```
Price
  │
  │                                    ╭────── Late stakers
  │                               ╭────╯       pay more
  │                          ╭────╯
  │                     ╭────╯
  │                ╭────╯
  │           ╭────╯
  │      ╭────╯
  │ ╭────╯
  │─╯ Early stakers
  │   pay less
  └────────────────────────────────────────── Total Staked

WHY THIS MATTERS:
- Rewards early discovery of good agents
- Incentivizes research and due diligence
- Creates natural price discovery for trust
```

### 3. Expert Weighting

Not all attestations are equal. Experts have more influence.

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPERT BADGES                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   🛡️ Security Auditor (1.5x weight)                         │
│      Verified security professionals                        │
│                                                             │
│   💻 Developer (1.3x weight)                                │
│      Active code contributors                               │
│                                                             │
│   🔬 AI Researcher (1.4x weight)                            │
│      Published AI/ML researchers                            │
│                                                             │
│   ⭐ Early Adopter (1.2x weight)                            │
│      Long-term ecosystem participants                       │
│                                                             │
│   📊 Analyst (1.3x weight)                                  │
│      Track record of accurate assessments                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

A Security Auditor's $100 stake has same impact as
regular user's $150 stake (1.5x multiplier).
```

### 4. Dispute Resolution

When trust is contested, the community decides.

```
DISPUTE FLOW:

1. User A stakes TRUST on Agent X
2. User B stakes DISTRUST on Agent X (dispute triggered)
3. Evidence period (7 days)
   - Both sides can present evidence
   - Community can add supporting stakes
4. Resolution
   - If Agent X proven trustworthy → User B loses stake
   - If Agent X proven untrustworthy → User A loses stake
   - Winning side splits the losing stakes
```

---

## Trust Score Calculation

```
TrustScore = (PositiveStake × PositiveWeight) - (NegativeStake × NegativeWeight)
             ─────────────────────────────────────────────────────────────────────
                                    TotalStake

Where:
- PositiveWeight = Σ(stake_i × expert_multiplier_i × time_decay_i)
- NegativeWeight = Σ(stake_i × expert_multiplier_i × time_decay_i)
- time_decay = 0.95^(days_since_stake / 30)  // Older stakes matter less
```

**Example:**
```
Agent X:
- Positive stakes: $10,000 (weighted: $12,500 after expert bonuses)
- Negative stakes: $500 (weighted: $450 after time decay)

TrustScore = (12,500 - 450) / (12,500 + 450) × 100 = 93.1
```

---

## Incentive Alignment

### For Users

| Action | Incentive | Outcome |
|--------|-----------|---------|
| Stake early on good agent | Higher returns when others follow | Discovery rewarded |
| Stake on bad agent | Lose stake when exposed | Carelessness punished |
| Identify bad actor early | Earn from dispute resolution | Vigilance rewarded |
| Provide false attestation | Lose stake + reputation | Dishonesty punished |

### For Agents

| Behavior | Consequence | Outcome |
|----------|-------------|---------|
| Perform well | Attract positive stakes | Good behavior rewarded |
| Perform poorly | Attract negative stakes | Bad behavior punished |
| Scam users | Massive negative stakes | Scams become visible |
| Improve over time | Trust score recovers | Redemption possible |

### For the Ecosystem

| Dynamic | Effect |
|---------|--------|
| Skin in the game | Higher quality signals |
| Early discovery rewards | Faster identification of quality |
| Dispute mechanism | Self-policing community |
| Time decay | Continuous re-evaluation |

---

## Value Flows

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VALUE CREATION                                  │
│                                                                         │
│   Users                    Platform                    Ecosystem        │
│     │                         │                           │             │
│     │  ┌──────────────────────┼───────────────────────┐   │             │
│     │  │                      ▼                       │   │             │
│     │  │    ┌─────────────────────────────────┐      │   │             │
│     ├──┼───→│      TRUST DATA CREATION        │←─────┼───┤             │
│     │  │    │   (attestations, stakes)        │      │   │             │
│     │  │    └─────────────────┬───────────────┘      │   │             │
│     │  │                      │                       │   │             │
│     │  │                      ▼                       │   │             │
│     │  │    ┌─────────────────────────────────┐      │   │             │
│     │  │    │       TRUST SCORE EMERGES       │      │   │             │
│     │  │    │   (AgentRank computation)       │      │   │             │
│     │  │    └─────────────────┬───────────────┘      │   │             │
│     │  │                      │                       │   │             │
│     │  │         ┌────────────┼────────────┐         │   │             │
│     │  │         ▼            ▼            ▼         │   │             │
│     │  │    ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │             │
│     │  │    │ Better  │ │ Safer   │ │ Trusted │     │   │             │
│     │  │    │decisions│ │ agents  │ │ecosystem│     │   │             │
│     │  │    └────┬────┘ └────┬────┘ └────┬────┘     │   │             │
│     │  │         │           │           │          │   │             │
│     │  └─────────┼───────────┼───────────┼──────────┘   │             │
│     │            │           │           │              │             │
│     ▼            ▼           ▼           ▼              ▼             │
│  ┌──────────────────────────────────────────────────────────┐         │
│  │                  EVERYONE BENEFITS                        │         │
│  │                                                           │         │
│  │  • Users make better choices                              │         │
│  │  • Good agents get recognition                            │         │
│  │  • Bad actors get identified                              │         │
│  │  • Ecosystem becomes more trustworthy                     │         │
│  │                                                           │         │
│  └──────────────────────────────────────────────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sustainability Model

We believe infrastructure should be sustainable without being extractive.

### Platform Operations

| Cost | Coverage |
|------|----------|
| Hosting & Infrastructure | Minimal (Vercel free tier initially) |
| Development | Community + grants |
| Marketing | Organic + ecosystem support |

### Potential Revenue Streams (Future)

| Stream | Model | Philosophy |
|--------|-------|------------|
| Premium Features | Optional paid tier | Value-add, not paywall |
| API Access | Usage-based pricing | Developers pay for scale |
| Enterprise | Custom solutions | B2B sustainable revenue |

### What We Will NEVER Do

- ❌ Sell user data
- ❌ Pay-to-win trust scores
- ❌ Require tokens to use basic features
- ❌ Lock trust data behind paywalls
- ❌ Take fees that distort trust signal quality

> **Note:** A small platform fee is collected on staking operations (0.1 tTRUST fixed + 2.5%) to sustain platform development. See [FEE_MODEL.md](FEE_MODEL.md) for details.

---

## Comparison with Alternatives

### Centralized Reputation (Yelp, App Store)

| Aspect | Centralized | AgentScore |
|--------|-------------|------------|
| Who controls data | Platform | Community (on-chain) |
| Gaming resistance | Low (fake reviews) | High (economic stakes) |
| Transparency | Opaque algorithms | Open, auditable |
| Portability | Locked to platform | Universal, interoperable |

### Pure Token Voting

| Aspect | Token Voting | AgentScore |
|--------|--------------|------------|
| Plutocracy risk | High (whales dominate) | Mitigated (expert weights) |
| Sybil resistance | Low | High (staking cost) |
| Signal quality | Noisy | Filtered by stakes |

### Reputation NFTs

| Aspect | NFTs | AgentScore |
|--------|------|------------|
| Transferability | Transferable (can be sold) | Non-transferable (earned) |
| Dynamism | Static | Dynamic (changes with behavior) |
| Context | None | Rich (multiple dimensions) |

---

## Open Questions

We don't have all the answers. These are areas we're actively researching:

### 1. Optimal Bonding Curve Shape
- Linear? Logarithmic? Sigmoid?
- How steep should the curve be?

### 2. Expert Badge Criteria
- How to verify expertise without centralization?
- How to prevent badge gaming?

### 3. Time Decay Parameters
- How fast should old stakes decay?
- Should decay be linear or exponential?

### 4. Dispute Resolution Efficiency
- How to resolve disputes quickly but fairly?
- How to handle coordinated attacks?

### 5. Cross-Chain Economics
- How should trust transfer across chains?
- How to handle different token values?

---

## Invitation to Collaborate

Economic design is hard. We're building in public and welcome:

- **Researchers**: Formal analysis of incentive structures
- **Economists**: Game theory review
- **Developers**: Implementation feedback
- **Users**: Real-world testing and feedback

The goal is not to maximize our profit—it's to create a trust economy that works for everyone.

---

<p align="center">
  <em>"In a well-designed system, selfishness and altruism point in the same direction."</em>
</p>

---

<p align="center">
  <a href="../VISION.md">Our Vision</a> •
  <a href="../ROADMAP.md">Our Roadmap</a> •
  <a href="WHY_TRUST_MATTERS.md">Why Trust Matters</a>
</p>
