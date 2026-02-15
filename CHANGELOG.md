# Changelog

All notable changes to AgentScore will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Coming Soon
- Intuition Protocol SDK integration
- Real on-chain attestations
- $TRUST token staking
- Mainnet deployment

---

## [2.1.0] - 2026-02-15

### 📚 Major Documentation Release

This release adds comprehensive project documentation establishing AgentScore as a thoughtful, vision-driven project.

### Added

#### Documentation
- **VISION.md** - Long-term vision for AI agent trust infrastructure
- **ROADMAP.md** - 6-phase development plan with clear milestones
- **ARCHITECTURE.md** - Technical architecture and design decisions
- **docs/WHY_TRUST_MATTERS.md** - Philosophical foundation of trust in AI age
- **docs/INTUITION_INTEGRATION.md** - Detailed Intuition Protocol integration guide
- **docs/TOKENOMICS.md** - Economic model, incentive design, and bonding curves
- **Documentation section in README.md** - Centralized navigation to all docs

### Changed
- Reorganized documentation structure with dedicated `docs/` folder
- Updated README.md with documentation links table
- Improved internal documentation cross-references

### Philosophy
This documentation establishes AgentScore's commitment to:
- Building trust infrastructure as a public good
- Transparency in vision, roadmap, and technical decisions
- Long-term thinking over short-term metrics
- Community-driven development

---

## [2.0.0] - 2026-02-09

### 🎉 Major Release - Complete Platform

This release marks the completion of AgentScore Phase 2 with full frontend functionality.

### Added

#### User System
- **User Profiles** - Complete profile management with editable name, bio, and avatar
- **Avatar Upload** - Support for profile and agent avatars
- **Expert Badges** - 7 badge types with automatic earning based on activity
- **Expert Levels** - Newcomer → Contributor → Expert → Master → Legend
- **Expert Weighting** - Higher reputation = more influence on trust scores

#### Agent Management  
- **Agent Registration** - Register AI agents with metadata
- **Agent Avatars** - Custom images for agents
- **Agent Categories** - 11 categories (Coding, Trading, DeFi, etc.)
- **Advanced Filtering** - Filter by category, trust range, verification status
- **Sorting Options** - Sort by trust score, stakes, newest, attestations

#### Tokenomics
- **Bonding Curves** - Dynamic pricing model for agent stakes
- **Staking System** - Trust/Distrust with $TRUST tokens
- **Real-time Quotes** - Preview shares and fees before staking
- **Platform Fees** - 1% staking, 1.5% unstaking, 0.01 ETH registration

#### UI/UX
- **Premium Glassmorphism** - Modern dark theme with glass effects
- **Animated Hero** - Wave text animation, floating orbs
- **Navbar Scroll Effect** - Transparent → solid on scroll
- **Search Modal** - ⌘K keyboard shortcut
- **Responsive Design** - Mobile, tablet, desktop optimized
- **Framer Motion** - Smooth page transitions and interactions

### Technical
- Next.js 14 with App Router
- TypeScript strict mode
- wagmi v2 + viem for Web3
- React Query for data fetching
- Tailwind CSS + shadcn/ui

---

## [1.0.0] - 2026-02-08

### 🚀 Initial Release

First version of AgentScore with basic functionality.

### Added
- Basic agent explorer
- Simple trust/distrust buttons
- Wallet connection
- Landing page

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 2.1.0 | 2026-02-15 | Comprehensive documentation release |
| 2.0.0 | 2026-02-09 | Complete platform, tokenomics, badges |
| 1.0.0 | 2026-02-08 | Initial release |

---

[Unreleased]: https://github.com/Kryptoremontier/agentscore/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Kryptoremontier/agentscore/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Kryptoremontier/agentscore/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Kryptoremontier/agentscore/releases/tag/v1.0.0
