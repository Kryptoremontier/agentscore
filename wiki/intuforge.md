# IntuForge

> First Project Discovery & Trust Launchpad on Intuition Protocol

**Status:** Phase 1 ✅ (UI shell) · Phase 1.5 🔧 (real data) | **Route:** /explore/intuforge

---

## What It Is

NOT a token launchpad. A project discovery platform where builders on Intuition register their projects, community stakes TRUST, and reputation grows organically.

Same scoring engine as AgentScore but for PROJECTS instead of AI agents.

## Why It Exists

Intuition has protocol + community but no structured way for projects to:
- Announce themselves to the ecosystem
- Get early community support (staking)
- Build reputation before grant rounds
- Find collaborators
- Compare with other projects

Every blockchain has launchpads. Intuition had none. Until now.

## Architecture

Lives INSIDE AgentScore app at `/explore/intuforge`. Reuses 90% of AgentScore:
- Same scoring engine (6 layers)
- Same evaluator system
- Same FeeProxy contract
- Same design system
- Same API patterns

## Phase 1 ✅ — UI Shell (Done)

**Components (10):** CategoryPill, ProjectCard, ForgeLeaderboard, ForgeStatsBar, ProjectGrid, ForgeBadge, ForgeTrustTimeline, ProjectRegistrationForm, ProjectShareButtons, ProjectTrustScore

**Pages:**
- `/explore/intuforge` — main (hero, top 3 leaderboard, grid, stats)
- `/explore/intuforge/register` — 3-step wizard (Basics → Details → Preview)
- `/explore/intuforge/[id]` — project profile (2-col layout)

**API (6 endpoints):**
- GET/POST /api/v1/forge/projects
- GET /api/v1/forge/projects/[id]
- GET /api/v1/forge/projects/[id]/trust
- GET /api/v1/forge/leaderboard
- GET /api/v1/forge/stats

**Mock data:** 5 projects (AgentScore, SENSE, Portal Cap, Talaria, Nexura)

**Tests:** 33 passing

## Phase 1.5 🔧 — Real Data (Next)

What needs connecting:
1. Registration → real createAtom() on-chain
2. Staking modal → FeeProxy deposit (Support/Oppose)
3. GraphQL fetch → real projects from chain
4. Scoring → real vault data through scoring engine
5. Timeline → real events from positions/signals
6. Leaderboard/Stats → real aggregates

All patterns exist in AgentScore — need to be WIRED to IntuForge components.

## Categories

| Category | Icon | Description |
|----------|------|-------------|
| AI Agents | 🤖 | Agent frameworks, tools |
| DeFi | 💱 | Financial protocols |
| Social | 🌐 | Social platforms |
| Identity | 🪪 | DID, verification |
| Data | 📊 | Data tools, analytics |
| Infrastructure | ⚙️ | Protocol infrastructure |
| Tooling | 🔧 | Developer tools |
| Gaming | 🎮 | Gaming projects |
| Other | ◆ | Everything else |

## Project Stages

| Stage | Color | Description |
|-------|-------|-------------|
| Idea | Gray | Concept phase |
| Building | Blue | In development |
| Testnet | Amber | Live on testnet |
| Mainnet | Green | Production |

## Revenue Model (Phase 1)

- Registration: FREE (direct MultiVault, protocol gas only)
- Staking: 2.5% fee through existing FeeProxy
- Revenue split: 100% to feeRecipient (Phase 1). Custom split in Phase 2.

## Related

- [[agentscore]] — scoring engine source
- [[intuforge-concept]] — why we built this
- [[roadmap]] — future phases
