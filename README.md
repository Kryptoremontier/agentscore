<p align="center">
  <img src="https://agentscore-gilt.vercel.app/images/brand/og-image.png" alt="AgentScore - Trust Layer for AI Agents" width="600" />
</p>

<h1 align="center">AgentScore</h1>

<p align="center">
  <strong>🛡️ The Trust Layer for AI Agents</strong>
</p>

<p align="center">
  Decentralized reputation verification built on <a href="https://intuition.systems">Intuition Protocol</a>.<br/>
  Verify before you interact. Stake your conviction. Build the semantic web of trust.
</p>

<p align="center">
  <a href="https://agentscore-gilt.vercel.app">
    <img src="https://img.shields.io/badge/🚀%20Live%20Demo-Visit%20Site-blue?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#why-agentscore">Why AgentScore</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tokenomics">Tokenomics</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.1.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/built%20on-Intuition%20Protocol-purple?style=flat-square" alt="Built on Intuition" />
  <img src="https://img.shields.io/badge/network-Base%20L3-blue?style=flat-square" alt="Network" />
  <img src="https://img.shields.io/badge/status-testnet-orange?style=flat-square" alt="Status" />
</p>

---

## 🌟 The Vision

> *"If Ethereum decentralized money, Intuition is decentralizing trust in information."*

We live in an era of **770,000+ AI agents** operating across platforms — trading, coding, creating, interacting. But here's the problem:

**How do you know which agent to trust?**

- Is that trading bot legitimate or a rug pull waiting to happen?
- Will this coding assistant protect your API keys or leak them?
- Can you trust this content agent with your brand?

**AgentScore** is the answer. We're building the **trust infrastructure** for the AI agent economy — where reputation is transparent, verifiable, and owned by the community, not corporations.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 **Verify Agents**
Browse and verify AI agents before interaction. See real trust scores backed by economic stakes, not just star ratings.

### 🏆 **Expert Badge System**
Earn reputation through quality attestations. Experts carry more weight — their trust means more.

### 📊 **Advanced Filtering**
Search by category, trust level, platform. Find exactly the agents you need with confidence.

</td>
<td width="50%">

### 💰 **Stake Your Conviction**
Put your $TRUST where your mouth is. Support agents you believe in, warn others about bad actors.

### 📈 **Bonding Curve Economics**
Early supporters earn more. As an agent gains trust, your position grows in value.

### 👤 **User Profiles**
Build your reputation. Track your stakes, badges, and the agents you've registered.

</td>
</tr>
</table>

---

## 🤔 Why AgentScore?

### The Problem

| Issue | Impact |
|-------|--------|
| **No verification standard** | Anyone can claim their agent is "trusted" |
| **Centralized ratings** | Platforms control what you see |
| **Fake reviews** | Bot armies inflate ratings |
| **No skin in the game** | Rating costs nothing, means nothing |
| **Siloed reputation** | Trust doesn't travel between platforms |

### Our Solution

| AgentScore | Benefit |
|------------|---------|
| **On-chain attestations** | Permanent, transparent, verifiable |
| **Economic staking** | Your $TRUST backs your claims |
| **Expert weighting** | Proven community members carry more influence |
| **Portable reputation** | Trust travels with agents across the ecosystem |
| **Community owned** | No central authority decides who's trusted |

---

## 🔄 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                            │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │    1     │         │    2     │         │    3     │
    │ REGISTER │───────▶ │  ATTEST  │───────▶ │  VERIFY  │
    │          │         │          │         │          │
    └──────────┘         └──────────┘         └──────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    Create Atom          Stake $TRUST         Check Score
    for your AI          to vouch for         before you
    agent on-chain       or against           interact

┌─────────────────────────────────────────────────────────────────┐
│                      TRUST SCORE FLOW                           │
└─────────────────────────────────────────────────────────────────┘

  👤 User A                  🤖 Agent X                 👤 User B
     │                           │                          │
     │  Stakes 100 $TRUST        │                          │
     │  "I trust this agent"     │                          │
     │─────────────────────────▶ │                          │
     │                           │                          │
     │                           │    Stakes 50 $TRUST      │
     │                           │    "I trust this agent"  │
     │                           │ ◀────────────────────────│
     │                           │                          │
     │                    ┌──────┴──────┐                   │
     │                    │ Trust Score │                   │
     │                    │     87      │                   │
     │                    │   ████████░ │                   │
     │                    └─────────────┘                   │
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTSCORE ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                  Next.js 14 + TypeScript                        │
│         ┌─────────┬─────────┬─────────┬─────────┐              │
│         │ Landing │ Explorer│ Profile │ Register│              │
│         └─────────┴─────────┴─────────┴─────────┘              │
│                           │                                     │
│              wagmi v2 + viem + React Query                      │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTUITION PROTOCOL                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │    ATOMS    │  │   TRIPLES   │  │   SIGNALS   │            │
│  │ (Identities)│  │(Attestations│  │  ($TRUST)   │            │
│  │             │  │             │  │   Staking)  │            │
│  │ • Agents    │  │ [A] trusts  │  │             │            │
│  │ • Users     │  │    [B]      │  │ Economic    │            │
│  │ • Concepts  │  │             │  │ Weight      │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INTUITION NETWORK (L3)                        │
│                  Base + Arbitrum Orbit + AnyTrust               │
│                    ~10,000x cheaper than L1                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

<table>
<tr>
<td align="center" width="96">
  <img src="https://skillicons.dev/icons?i=nextjs" width="48" height="48" alt="Next.js" />
  <br>Next.js 14
</td>
<td align="center" width="96">
  <img src="https://skillicons.dev/icons?i=ts" width="48" height="48" alt="TypeScript" />
  <br>TypeScript
</td>
<td align="center" width="96">
  <img src="https://skillicons.dev/icons?i=tailwind" width="48" height="48" alt="Tailwind" />
  <br>Tailwind
</td>
<td align="center" width="96">
  <img src="https://skillicons.dev/icons?i=react" width="48" height="48" alt="React" />
  <br>React 18
</td>
<td align="center" width="96">
  <img src="https://raw.githubusercontent.com/wagmi-dev/wagmi/main/.github/logo-light.svg" width="48" height="48" alt="wagmi" />
  <br>wagmi v2
</td>
<td align="center" width="96">
  <img src="https://skillicons.dev/icons?i=vercel" width="48" height="48" alt="Vercel" />
  <br>Vercel
</td>
</tr>
</table>

**Core Stack:**
- ⚛️ **Next.js 14** - App Router, Server Components
- 📘 **TypeScript** - Type-safe development
- 🎨 **Tailwind CSS** - Utility-first styling
- 🧩 **shadcn/ui** - Beautiful components
- 🎭 **Framer Motion** - Smooth animations
- 🔗 **wagmi v2 + viem** - Web3 integration
- 📊 **React Query** - Data fetching

**Blockchain:**
- 🧠 **Intuition Protocol** - Trust infrastructure
- ⛓️ **Base L3** - Fast, cheap transactions
- 💰 **$TRUST Token** - Economic staking

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/Kryptoremontier/agentscore.git

# Navigate to project
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

### Build for Production

```bash
npm run build
npm start
```

---

## 💰 Tokenomics

### Bonding Curve Model

AgentScore uses **bonding curves** to create fair, market-driven trust scores:

```
Price Formula: price = basePrice × (totalShares)^1.5

Early Supporter Advantage:
┌────────────────────────────────────────────────────┐
│  Staker A (early):  100 $TRUST → 100 shares @ 1.0 │
│  Staker B:          100 $TRUST →  63 shares @ 1.58│
│  Staker C:          100 $TRUST →  45 shares @ 2.22│
│  ─────────────────────────────────────────────────│
│  Total staked: 300 $TRUST                         │
│  Staker A value: 100 × 2.22 = 222 $TRUST (+122%)  │
└────────────────────────────────────────────────────┘
```

### Platform Fees

| Action | Fee | Purpose |
|--------|-----|---------|
| Agent Registration | 0.01 ETH | Spam prevention |
| Staking | 1% | Protocol treasury |
| Unstaking | 1.5% | Discourage speculation |

### Why This Works

✅ **Early believers rewarded** - First supporters get more shares per $TRUST  
✅ **Skin in the game** - Staking costs real tokens  
✅ **Self-correcting** - Bad agents lose stake value  
✅ **Sustainable** - Fees fund ongoing development  

---

## 🗺️ Roadmap

### Phase 1: Foundation ✅
- [x] Core UI/UX with glassmorphism design
- [x] Agent registration system
- [x] Trust/Distrust staking
- [x] User profiles with avatars
- [x] Expert badge system
- [x] Advanced filtering

### Phase 2: Integration 🔄
- [ ] Intuition Protocol SDK integration
- [ ] Real on-chain attestations
- [ ] $TRUST token staking
- [ ] Testnet deployment

### Phase 3: Growth 📈
- [ ] Mainnet launch
- [ ] API for third-party integrations
- [ ] Mobile app
- [ ] Multi-chain support

### Phase 4: Ecosystem 🌐
- [ ] Agent SDK for auto-registration
- [ ] Governance token
- [ ] DAO transition
- [ ] Partner integrations

---

## 📚 Documentation

Explore our vision, roadmap, and technical documentation:

| Document | Description |
|----------|-------------|
| [Vision & Mission](VISION.md) | Our long-term vision for AI agent trust infrastructure |
| [Roadmap](ROADMAP.md) | Development phases and milestones |
| [Architecture](ARCHITECTURE.md) | Technical architecture and design decisions |
| [Why Trust Matters](docs/WHY_TRUST_MATTERS.md) | Philosophical foundation of the project |
| [Intuition Integration](docs/INTUITION_INTEGRATION.md) | How we integrate with Intuition Protocol |
| [Economic Model](docs/TOKENOMICS.md) | Incentive design and tokenomics |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

<p align="center">
  <a href="https://agentscore-gilt.vercel.app">
    <img src="https://img.shields.io/badge/Website-Visit%20Demo-blue?style=for-the-badge&logo=vercel" alt="Website" />
  </a>
  &nbsp;
  <a href="https://twitter.com/Kryptoremontier">
    <img src="https://img.shields.io/badge/Twitter-@Kryptoremontier-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white" alt="Twitter" />
  </a>
  &nbsp;
  <a href="https://warpcast.com/kryptoremontier">
    <img src="https://img.shields.io/badge/Farcaster-kryptoremontier-8A63D2?style=for-the-badge" alt="Farcaster" />
  </a>
</p>

---

## 🙏 Acknowledgments

- **[Intuition Protocol](https://intuition.systems)** - The foundation of decentralized trust
- **[Base](https://base.org)** - Scalable L2 infrastructure
- **[shadcn/ui](https://ui.shadcn.com)** - Beautiful component library
- **[Vercel](https://vercel.com)** - Seamless deployment

---

<p align="center">
  <strong>Built with conviction by <a href="https://twitter.com/Kryptoremontier">@Kryptoremontier</a></strong>
</p>

<p align="center">
  <em>Because in the age of AI, trust shouldn't be a luxury — it should be a standard.</em>
</p>

<p align="center">
  <sub>🧠 Powered by Intuition Protocol | 💙 Built on Base</sub>
</p>
