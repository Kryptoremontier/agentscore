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
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/built%20on-Intuition%20Protocol-8A63D2?style=flat-square" alt="Built on Intuition" />
  <img src="https://img.shields.io/badge/network-Intuition%20Testnet-blue?style=flat-square" alt="Network" />
  <img src="https://img.shields.io/badge/status-testnet%20alpha-orange?style=flat-square" alt="Status" />
</p>

---

## The Vision

> *"If Ethereum decentralized money, Intuition is decentralizing trust in information."*

We live in an era of **AI agents operating everywhere** — coding, trading, creating, interacting on our behalf. But:

**How do you know which agent to trust?**

AgentScore is the answer. An open, on-chain reputation system where **anyone can stake tTRUST tokens** to signal confidence in an AI agent or skill. Every signal is permanent, transparent, and economically meaningful — no fake reviews, no platform bias.

---

## What's on the Platform

AgentScore handles three types of on-chain entities, all powered by Intuition Protocol atoms and triples:

### 🤖 Agents
AI agent identities registered as Intuition **Atoms**. Each agent gets a unique on-chain ID, a live Trust Score (0–100), and two staking vaults (Support / Oppose). Anyone can stake tTRUST to signal confidence.

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

```
  User A stakes 100 tTRUST  ──────▶  Agent X  ◀──────  User B stakes 50 tTRUST
  "I trust this agent"                  │               "I trust this agent"
                                        │
                              ┌─────────▼──────────┐
                              │   Trust Score: 87   │
                              │   ████████████░░    │
                              │   Tier: Trusted ✓   │
                              └─────────────────────┘
```

| Signal | Effect |
|--------|--------|
| **Support** — stake in the support vault | Raises Trust Score |
| **Oppose** — stake in the counter vault | Lowers Trust Score |

- Score range **0–100**, anchored at 50 until sufficient stake accumulates
- **Bonding curves** — price per share rises as more stake enters a vault
- **Time decay** — older signals gradually lose weight (half-life ~90 days)
- Positions can be **redeemed (sold)** at any time at the current curve price

### Trust Tiers

| Tier | Threshold | Description |
|------|-----------|-------------|
| ○ **Unverified** | 0 stakers | No signals yet |
| ◐ **Sandbox** | 3+ stakers | Early community activity |
| ✓ **Trusted** | 10+ stakers | Solid conviction |
| ⭐ **Verified** | 25+ stakers | High community confidence |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│            Next.js 14 · TypeScript · Tailwind        │
│                                                      │
│  ┌──────────┬──────────┬──────────┬────────────────┐ │
│  │  Landing │  Agents  │  Skills  │  Claims        │ │
│  │  Page    │  Explorer│  Explorer│  Registry      │ │
│  └──────────┴──────────┴──────────┴────────────────┘ │
│  ┌──────────┬──────────┬──────────┐                  │
│  │ Register │ Profile  │   Docs   │                  │
│  └──────────┴──────────┴──────────┘                  │
│                                                      │
│           wagmi v2 + viem + React Query              │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                INTUITION PROTOCOL                    │
│                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   ATOMS    │  │   TRIPLES    │  │  MULTIVAULT │  │
│  │            │  │              │  │             │  │
│  │ • Agents   │  │ [Subject]    │  │ • Support   │  │
│  │ • Skills   │  │ [Predicate]  │  │   vault     │  │
│  │ • Users    │  │ [Object]     │  │ • Oppose    │  │
│  │            │  │              │  │   vault     │  │
│  └────────────┘  └──────────────┘  └─────────────┘  │
│                                                      │
│         GraphQL API · Intuition Testnet              │
└──────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Status |
|---------|--------|
| Agent Registry (on-chain Atoms) | ✅ Live |
| Skill Registry (on-chain Atoms) | ✅ Live |
| Claims Registry (on-chain Triples) | ✅ Live |
| Support / Oppose staking via MultiVault | ✅ Live |
| Bonding curve share pricing | ✅ Live |
| Your Holdings panel (buy / sell shares) | ✅ Live |
| Trust Score (0–100) with tier system | ✅ Live |
| Live GraphQL indexing from testnet | ✅ Live |
| Public profile pages (`/profile/[address]`) | ✅ Live |
| Grid / List view toggle on all registries | ✅ Live |
| App-scoped content filtering | ✅ Live |
| Platform Documentation page (`/docs`) | ✅ Live |

---

## Bonding Curve Economics

Every vault (Support or Oppose) runs an independent bonding curve:

```
Price per share = basePrice × totalSupply^1.5

Early supporter example:
┌──────────────────────────────────────────────────────┐
│  Staker A (early):  100 tTRUST → 100 shares @ 1.0   │
│  Staker B:          100 tTRUST →  63 shares @ 1.58  │
│  Staker C:          100 tTRUST →  45 shares @ 2.22  │
│  ────────────────────────────────────────────────    │
│  Total staked: 300 tTRUST                            │
│  Staker A value: 100 × 2.22 = 222 tTRUST (+122%)    │
└──────────────────────────────────────────────────────┘
```

Early believers are rewarded. Bad agents lose stake value as holders exit.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + Framer Motion |
| Web3 | wagmi v2 + viem |
| Protocol | Intuition Protocol SDK (`@0xintuition/sdk`) |
| Data | GraphQL (`testnet.intuition.sh/v1/graphql`) |
| Deployment | Vercel |

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

### Phase 1: Foundation ✅ Complete
- [x] Core UI/UX with gold/dark design system
- [x] Agent registration system
- [x] Skill registration system
- [x] Claims (triples) creation
- [x] User profiles (`/profile/[address]`)
- [x] Trust tier badge system

### Phase 2: On-chain Integration ✅ Complete
- [x] Intuition Protocol SDK integration
- [x] Real on-chain Atoms (agents & skills)
- [x] Real on-chain Triples (claims)
- [x] tTRUST staking via MultiVault
- [x] Support & Oppose vaults
- [x] Bonding curve share pricing
- [x] Buy / Sell shares (Your Holdings panel)
- [x] Live GraphQL data indexing
- [x] Testnet deployment on Vercel

### Phase 3: Growth 📈 In Progress
- [ ] Mainnet launch
- [ ] Public API for third-party integrations
- [ ] Agent SDK for auto-registration
- [ ] Governance module
- [ ] Mobile-optimised PWA
- [ ] Multi-chain support

### Phase 4: Ecosystem 🌐 Planned
- [ ] DAO transition
- [ ] Partner integrations (agent frameworks: LangChain, AutoGen, CrewAI)
- [ ] Reputation portability across protocols

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

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

<p align="center">
  <a href="https://agentscore-gilt.vercel.app">
    <img src="https://img.shields.io/badge/Website-Live%20App-C8963C?style=for-the-badge&logo=vercel" alt="Website" />
  </a>
  &nbsp;
  <a href="https://x.com/AgentScoreApp">
    <img src="https://img.shields.io/badge/X%20%2F%20Twitter-@AgentScoreApp-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="X / Twitter" />
  </a>
  &nbsp;
  <a href="https://intuition.systems">
    <img src="https://img.shields.io/badge/Built%20on-Intuition%20Protocol-8A63D2?style=for-the-badge" alt="Intuition" />
  </a>
</p>

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
  <em>Because in the age of AI, trust shouldn't be a luxury — it should be a standard.</em>
</p>

<p align="center">
  <sub>Powered by Intuition Protocol · Testnet Alpha · All rights reserved © 2026 AgentScore</sub>
</p>
