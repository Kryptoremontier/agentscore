<p align="center">
  <img src="https://agentscore-gilt.vercel.app/images/brand/gold/logo.png" alt="AgentScore" width="120" />
</p>

<h1 align="center">AgentScore</h1>

<p align="center">
  <strong>Decentralized Trust & Reputation Layer for AI Agents</strong>
</p>

<p align="center">
  Built on <a href="https://intuition.systems">Intuition Protocol</a> · Live on Intuition Testnet
</p>

<p align="center">
  <a href="https://agentscore-gilt.vercel.app">
    <img src="https://img.shields.io/badge/🚀%20Live%20App-Visit%20Site-C8963C?style=for-the-badge" alt="Live App" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-C8963C?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/built%20on-Intuition%20Protocol-8A63D2?style=flat-square" alt="Built on Intuition" />
  <img src="https://img.shields.io/badge/network-Intuition%20Testnet-blue?style=flat-square" alt="Network" />
  <img src="https://img.shields.io/badge/status-testnet%20alpha-orange?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/FeeProxy-Active-green?style=flat-square" alt="FeeProxy" />
  <img src="https://img.shields.io/badge/pricing-on--chain-blue?style=flat-square" alt="On-chain Pricing" />
</p>

---

## The Vision

> *"If Ethereum decentralized money, Intuition is decentralizing trust in information."*

We live in an era of **AI agents operating everywhere** — coding, trading, creating, interacting on our behalf. But:

**How do you know which agent to trust?**

AgentScore is the answer. An open, on-chain reputation system where **anyone can stake tTRUST tokens** to signal confidence in an AI agent or skill. Every signal is permanent, transparent, and economically meaningful — no fake reviews, no platform bias.

### Where We're Going

AgentScore is evolving beyond a human marketplace:

1. **Today** — Humans register agents and stake on trust
2. **Tomorrow** — AI agents query trust scores to pick collaborators
3. **Next** — Agents evaluate each other — trust grows autonomously

We're building the first Intuition dApp where AI is both the producer and consumer of trust data.

---

## What's on the Platform

AgentScore handles three types of on-chain entities, all powered by Intuition Protocol atoms and triples:

### 🤖 Agents
AI agent identities registered as Intuition **Atoms**. Each agent gets a unique on-chain ID, a live Trust Score (0–100), and a staking vault. Anyone can stake tTRUST to back agents they believe in. Early stakers get more shares per tTRUST — bonding curve economics reward conviction.

### ⚡ Skills
Specific capabilities exposed by an agent (e.g. *Code Generation*, *RAG Search*, *Image Analysis*). Registered as Atoms and scored independently — a skilled agent should be backed at both the agent level and skill level.

### 💬 Claims
Verifiable **triples** (Subject → Predicate → Object) expressing structured relationships:
- *Agent X [has skill] Code Generation*
- *Agent Y [is trusted by] CommunityDAO*
- *Skill Z [competes with] Skill W*

Claims are also stakeable — support or oppose any statement with real tTRUST.

---

## How Trust Scores Work

![Trust Scoring Model](docs/images/trust-model.svg)

AgentScore uses a **Hybrid Trust Score** combining economic confidence with multi-dimensional quality metrics:

### AGENTSCORE (Main Score)
```
Hybrid Score = 60% × Trust Score + 40% × Composite Score
```

With **soft gate**: if support ratio < 50%, score is proportionally reduced (ratio/50). An agent with 10% support gets score × 0.20, 30% support gets score × 0.60. Above 50% — full score applies.

### Trust Score (Economic Confidence)
```
base = supportRatio
confidence = 1 - e^(-totalStake / tau)
anchoredScore = 50 + (base - 50) × confidence
```
Anchored at 50 until sufficient economic stake accumulates. More stake = higher confidence = score moves further from 50.

### Composite Trust Score (Quality Metrics)

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Signal Ratio | 40% | Time-weighted support ratio (90-day half-life decay) |
| Staker Diversity | 25% | Unique stakers count (whale resistance) |
| Sustained Stability | 25% | Days maintaining >50% trust ratio |
| Price Retention | 10% | Current on-chain share price vs ATH |

All pricing data read directly from MultiVault contract — no local approximations.

### Trust Tiers

| Tier | Threshold | Description |
|------|-----------|-------------|
| ○ **Unverified** | 0 stakers | No signals yet |
| ◐ **Sandbox** | 3+ stakers, 0.1+ tTRUST | Early community activity |
| ✓ **Trusted** | 10+ stakers, 1+ tTRUST, 60%+ ratio | Solid conviction |
| ⭐ **Verified** | 25+ stakers, 5+ tTRUST, 75%+ ratio, 30+ days | High community confidence |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND                             │
│             Next.js 14 · TypeScript · Tailwind            │
│                                                           │
│  ┌──────────┬──────────┬──────────┬──────────┬─────────┐ │
│  │  Landing │  Agents  │  Skills  │  Claims  │ Profile │ │
│  │  Page    │  Explorer│  Explorer│  Registry│ Badges  │ │
│  └──────────┴──────────┴──────────┴──────────┴─────────┘ │
│  ┌──────────┬──────────┬──────────┬──────────┐           │
│  │ Register │  Docs    │Leaderboard│  /terms │           │
│  └──────────┴──────────┴──────────┴──────────┘           │
│                                                           │
│        wagmi v2 + viem + on-chain-pricing.ts              │
└──────────┬────────────────────────┬───────────────────────┘
           │ WRITE                  │ READ
           ▼                        ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│   AgentScore          │  │  Intuition GraphQL API        │
│   FeeProxy Contract   │  │  + MultiVault on-chain reads  │
│   0x2f76...ec41       │  │                               │
│                       │  │  currentSharePrice()          │
│  fee (0.02 + 2.5%)   │  │  previewDeposit()             │
│    → feeRecipient     │  │  previewRedeem()              │
│  rest → MultiVault    │  │  convertToAssets()            │
└──────────┬────────────┘  └──────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────┐
│                  INTUITION PROTOCOL                       │
│                                                           │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   ATOMS    │  │   TRIPLES    │  │   MULTIVAULT     │ │
│  │ • Agents   │  │ [Subject]    │  │ • Bonding curves │ │
│  │ • Skills   │  │ [Predicate]  │  │ • Deposit/Redeem │ │
│  │ • Users    │  │ [Object]     │  │ • Share pricing  │ │
│  └────────────┘  └──────────────┘  └──────────────────┘ │
│                                                           │
│            Intuition Network L3 (Chain 13579)             │
└──────────────────────────────────────────────────────────┘
```

---

## Fee Model

AgentScore monetizes through Intuition's FeeProxy pattern — one of the first dApps to implement it in production alongside Sofia and Inturank.

### How it works

All write operations (register, stake) route through our FeeProxy smart contract. The proxy takes a fee and forwards the rest to MultiVault.

| Operation | Fee | Route |
|-----------|-----|-------|
| Register Agent (createAtom) | 0.02 tTRUST + 2.5% | FeeProxy → MultiVault |
| Register Skill (createAtom) | 0.02 tTRUST + 2.5% | FeeProxy → MultiVault |
| Create Claim (createTriple) | 0.02 tTRUST + 2.5% | FeeProxy → MultiVault |
| Stake / Buy Shares (deposit) | 0.02 tTRUST + 2.5% | FeeProxy → MultiVault |
| Redeem / Sell Shares | **FREE** | MultiVault directly |

Fee is collected **instantly** in the same transaction — no claiming, no epochs.

### Smart Contracts

| Contract | Address |
|----------|---------|
| AgentScore FeeProxy | [`0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41`](https://testnet.explorer.intuition.systems/address/0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41) |
| Fee Recipient | [`0x57246adCD446809c4DB1b04046E731954985bea2`](https://testnet.explorer.intuition.systems/address/0x57246adCD446809c4DB1b04046E731954985bea2) |
| Intuition MultiVault | [`0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91`](https://testnet.explorer.intuition.systems/address/0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91) |

---

## On-Chain Pricing

Unlike applications using local bonding curve approximations, AgentScore reads all pricing data directly from MultiVault contract:

| Function | Purpose |
|----------|---------|
| `currentSharePrice()` | Live marginal price per share |
| `previewDeposit()` | Exact shares for deposit amount |
| `previewRedeem()` | Exact proceeds for share amount |
| `convertToAssets()` | Position valuation |

- **15-second cache** prevents RPC spam
- **Automatic fallback** to local approximation if RPC fails
- **2% slippage protection** using on-chain `previewDeposit` quotes

---

## Features

### Core Platform
| Feature | Status |
|---------|--------|
| Agent Registry (on-chain Atoms) | ✅ Live |
| Skill Registry (on-chain Atoms) | ✅ Live |
| Claims Registry (on-chain Triples) | ✅ Live |
| Staking via MultiVault bonding curves | ✅ Live |
| Buy / Sell shares panel | ✅ Live |
| On-chain pricing (MultiVault reads) | ✅ Live |
| Slippage protection (2% tolerance) | ✅ Live |

### Trust & Reputation
| Feature | Status |
|---------|--------|
| Hybrid Trust Score (AGENTSCORE) | ✅ Live |
| Composite Trust Score (4 pillars) | ✅ Live |
| Time-weighted reputation decay (90-day half-life) | ✅ Live |
| Trust Tiers (Unverified → Verified) | ✅ Live |
| Bonding curve charts with on-chain price marker | ✅ Live |
| Trust History chart | ✅ Live |
| Community Sentiment visualization | ✅ Live |

### User Experience
| Feature | Status |
|---------|--------|
| User profiles with achievement badges | ✅ Live |
| Leaderboard (multi-metric scoring) | ✅ Live |
| My Agents / Supporting tabs | ✅ Live |
| Badge system (Newcomer → Legend, 6 tiers) | ✅ Live |
| Activity feed | ✅ Live |
| Platform Documentation (/docs) | ✅ Live |
| Terms of Service & Privacy Policy | ✅ Live |

### Monetization
| Feature | Status |
|---------|--------|
| FeeProxy integration (0.02 tTRUST + 2.5%) | ✅ Live |
| Instant fee collection per transaction | ✅ Live |
| Fee breakdown in UI (transparent pricing) | ✅ Live |
| Contract links in footer | ✅ Live |

---

## Bonding Curve Economics

Every vault runs an independent bonding curve managed by Intuition's MultiVault contract:

- **Early believers get more shares per tTRUST** — price rises with each buy
- **Sell anytime** — redeem shares at current curve price, no lock-up period
- **On-chain pricing** — all prices read directly from contract, no approximations
- **Transparent fee** — platform fee shown before every transaction

```
User stakes 1 tTRUST on Agent X:
├── Platform fee:     0.045 tTRUST (0.02 fixed + 2.5%)
├── Protocol fee:     built into bonding curve
└── Deposited:        0.955 tTRUST → MultiVault
    └── Shares:       credited to user's wallet
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion |
| Web3 | wagmi v2 + viem |
| Protocol | Intuition Protocol SDK (`@0xintuition/sdk`) |
| Pricing | On-chain reads from MultiVault (`currentSharePrice`, `previewDeposit`, `previewRedeem`) |
| Smart Contracts | AgentScore FeeProxy + Intuition MultiVault |
| Trust Scoring | Hybrid model (Economic confidence + Composite quality metrics) |
| Data | Intuition GraphQL API + on-chain contract reads (15s cache) |
| Registration Tracking | localStorage + first position holder detection |
| Deployment | Vercel (Production + Preview) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/Kryptoremontier/agentscore.git
cd agentscore

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

```env
# WalletConnect (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id

# Network: 'testnet' or 'mainnet'
NEXT_PUBLIC_NETWORK=testnet
```

### Useful Scripts

```bash
npm run dev          # Start dev server
npm run dev:clean    # Clear .next cache and start fresh (fixes HMR issues)
npm run build        # Production build
npm start            # Run production server
```

---

## Roadmap

### Phase 1 ✅ Complete: Trust Marketplace
* Core UI/UX with gold/dark design system
* Agent, Skill, Claims registration (on-chain Atoms & Triples with type tagging)
* Staking via FeeProxy (hybrid model: create=direct MultiVault, deposit=FeeProxy)
* FeeProxy monetization (0.02 tTRUST + 2.5% per operation)
* On-chain pricing (MultiVault contract reads, bonding curves)
* Hybrid Trust Score (AGENTSCORE): 60% economic confidence + 40% quality metrics + soft gate
* Composite Trust Score (4 pillars): signal ratio (40%), staker diversity (25%), stability (25%), price retention (10%)
* 5-layer anti-manipulation: soft gate, log diversity, min stake threshold, variance penalty, diversity-weighted ratio (whale detection on both sides)
* Contextual Trust Scoring: per-skill trust breakdown via triple vaults — each `[Agent] [hasAgentSkill] [Skill]` triple scored independently
* Agent Domains: domain leaderboards with per-domain agent rankings — "who is best FOR this skill?"
* Momentum indicators + Trust Sparkline (trend visibility on agent cards and detail panels)
* findOrCreateAtom(): mainnet-ready atom reuse (links to existing atoms instead of creating duplicates)
* 90-day reputation half-life (time-weighted signals with freshness bonus)
* Trust Tiers (Unverified → Sandbox → Trusted → Verified)
* User profiles, badges, leaderboard
* Slippage protection (2% tolerance from on-chain quotes)
* Platform documentation, Terms of Service, Privacy Policy
* Testnet deployment on Vercel

### Phase 2 🔧 In Progress: Mainnet + Intelligence Layer

**2.1 Mainnet Migration**
* Branded AgentScoreFeeProxy (separate deploy, not shared with other apps)
* Gnosis Safe multisig for fee recipient
* Link to existing skills.sh atoms via findOrCreateAtom()
* Tau parameter calibration (0.1 testnet → 50 mainnet)
* Custom domain (agentscore.xyz)

**2.2 Agent Identity Verification**
* Optional social links at registration (GitHub, X, Website, Discord)
* Stored as on-chain triples: `[Agent] [hasGithub] [url]`, `[Agent] [hasTwitter] [@handle]`
* Verified badge for agents with 2+ verified social accounts (6+ months old)
* Future: ZK-verified attestations (Gitcoin Passport or similar)
* Credibility multiplier on Trust Tiers (verified = boost, unverified = baseline)

**2.3 Trust API + MCP Server**
* Public Trust API (`/api/v1/trust/query?skill=X&minTrust=Y`)
* MCP tools for AI agents to query trust scores programmatically
* Integration with Sofia MCP (EigenTrust, personalized trust, trust paths)
* Interactive API documentation (/api-docs)

**2.4 Accuracy-Weighted Staking**
* Staker track record becomes influence weight (0.5x–1.5x)
* Meritocratic: consistently good evaluators gain more influence over scores
* Graph-based trust quality layer on top of EigenTrust traversal
* Economic Sybil resistance: building weight requires many correct evaluations across many agents

**2.5 Skill Standardization**
* Canonical skill list synced with skills.sh mainnet atoms
* Skill search and autocomplete at registration (no free-text duplicates)
* Domain categories and tags for grouping

### Phase 3 🌐 Planned: Autonomous Trust Graph
* Proof of Performance protocol (agents evaluate agents, not just humans)
* Task delegation & outcome reporting API
* Trust Validators (weighted signals for experienced evaluators)
* Performance scoring (5th pillar in Composite Trust)
* Trust Path Explorer (visualize WHY someone is trusted, not just the score)
* Graph-based trust propagation via EigenTrust integration
* Cross-domain trust flows (reputation portability between domains)
* SDKs for agent frameworks (LangChain, CrewAI, ElizaOS)

### Phase 4 🔮 Future: Ecosystem Infrastructure
* DAO governance transition for protocol parameters (fee rates, tier thresholds)
* Cross-protocol reputation portability
* Partner integrations (agent frameworks, AI platforms)
* Enterprise trust scoring API (B2B trust-as-a-service)
* ERC-8004 compatibility — AgentScore as reputation provider for Trustless Agents standard
* SENSE integration (prediction market feeds into agent trust evolution timeline)

---

## Contributing

We welcome contributions!

```bash
git checkout -b feature/your-feature
git commit -m 'Add your feature'
git push origin feature/your-feature
# Open a Pull Request
```

---

## License

Proprietary — see [LICENSE](LICENSE) for details.

---

## Links

| Resource | URL |
|----------|-----|
| 🌐 Live App | [agentscore-gilt.vercel.app](https://agentscore-gilt.vercel.app) |
| 🐦 Twitter/X | [@AgentScoreApp](https://x.com/AgentScoreApp) |
| 📄 Documentation | [/docs](https://agentscore-gilt.vercel.app/docs) |
| 🔗 FeeProxy Contract | [Blockscout](https://testnet.explorer.intuition.systems/address/0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41) |
| 🏛️ Intuition Protocol | [intuition.systems](https://intuition.systems) |
| 📋 Fee Model | [docs/FEE_MODEL.md](docs/FEE_MODEL.md) |

---

## Acknowledgments

- **[Intuition Protocol](https://intuition.systems)** — The foundation of decentralized trust
- **[shadcn/ui](https://ui.shadcn.com)** — Component library
- **[Vercel](https://vercel.com)** — Deployment

---

<p align="center">
  <strong>Built with conviction — follow us on <a href="https://x.com/AgentScoreApp">@AgentScoreApp</a></strong>
</p>

<p align="center">

> *Today, humans stake on agents they believe in. Tomorrow, agents query trust scores to pick collaborators. Next — agents evaluate each other and the trust graph grows itself.*
>
> **This is programmable trust — built on Intuition.**

</p>

---

<p align="center">
  <sub>Powered by <a href="https://intuition.systems">Intuition Protocol</a> · Testnet Alpha · © 2026 AgentScore</sub>
</p>
