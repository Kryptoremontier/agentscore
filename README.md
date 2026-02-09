# 🛡️ AgentScore

Trust Layer for AI Agents built on Intuition Protocol

## 🚀 Overview

AgentScore is a decentralized reputation system for AI agents, enabling users to verify agent trustworthiness before interaction. Built natively on Intuition Protocol, it leverages economic attestations to create a robust trust network.

## ✨ Features

- **Agent Registration**: Create on-chain identities for AI agents
- **Trust Attestations**: Stake $TRUST tokens to signal agent reliability
- **Reputation Scores**: Dynamic trust scores based on community attestations
- **Report System**: Flag malicious agents with economic backing
- **Agent Explorer**: Discover and verify agents across platforms

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Web3**: wagmi v2 + viem
- **Blockchain**: Intuition Protocol
- **State**: @tanstack/react-query
- **Animations**: Framer Motion

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/agentscore.git
cd agentscore

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

## 🔧 Configuration

1. Get a WalletConnect Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Update `.env.local` with your configuration:

```env
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id
NEXT_PUBLIC_NETWORK=testnet
```

## 📁 Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── agents/      # Agent-related components
│   ├── trust/       # Trust score components
│   ├── ui/          # UI primitives
│   └── shared/      # Shared components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and configurations
└── types/           # TypeScript definitions
```

## 🔑 Key Components

- **TrustScoreBadge**: Circular visualization of agent trust scores
- **AgentCard**: Display card for agent information
- **StakingModal**: Interface for staking $TRUST tokens
- **RegisterAgentForm**: Multi-step form for agent registration

## 🌐 Intuition Integration

AgentScore uses Intuition Protocol for:
- **Atoms**: On-chain agent identities
- **Triples**: Trust attestations (Subject-Predicate-Object)
- **Signals**: Economic backing via $TRUST stakes

## 🚀 Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

Deploy to Vercel:
```bash
vercel
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📞 Support

- Documentation: [docs.agentscore.ai](https://docs.agentscore.ai)
- Discord: [Join our community](https://discord.gg/agentscore)
- Twitter: [@agentscore](https://twitter.com/agentscore)

---

Built with ❤️ on [Intuition Protocol](https://intuition.systems)