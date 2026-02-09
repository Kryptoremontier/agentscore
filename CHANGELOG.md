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
| 2.0.0 | 2026-02-09 | Complete platform, tokenomics, badges |
| 1.0.0 | 2026-02-08 | Initial release |

---

[Unreleased]: https://github.com/Kryptoremontier/agentscore/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Kryptoremontier/agentscore/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Kryptoremontier/agentscore/releases/tag/v1.0.0
