# AgentScore — Architecture & Data Flow

## Overview

AgentScore is a fully decentralized reputation platform built on the **Intuition Protocol** (testnet).
There is **no traditional backend or database**. All user activity is stored on-chain and indexed
via Intuition's GraphQL API.

---

## Data Sources

```
┌─────────────────────────────────────────────────────────┐
│              Intuition Protocol (on-chain)               │
│                                                          │
│  Atoms       ─── Agents (label: "Agent:*")               │
│              ─── Skills (label: "Skill:*")               │
│                                                          │
│  Triples     ─── Claims  (Subject → Predicate → Object)  │
│                                                          │
│  Positions   ─── Who staked what & how much (tTRUST)     │
│                                                          │
│  Signals     ─── All stake/unstake events                │
└──────────────────────┬──────────────────────────────────┘
                       │  indexed by
                       ▼
           GraphQL API (testnet.intuition.sh/v1/graphql)
                       │  queried by
                       ▼
              Next.js Frontend (client-side fetch)
```

---

## User Stats — Collection

Every user's statistics are computed **on-demand** by `src/hooks/useUserProfile.ts`
by querying GraphQL. Nothing is cached server-side.

| Metric | GraphQL Source |
|--------|---------------|
| `totalAgentsRegistered` | `atoms WHERE label ILIKE 'Agent:%' AND creator_id = $user` |
| `totalSkillsRegistered` | `atoms WHERE label ILIKE 'Skill:%' AND creator_id = $user` |
| `totalClaimsCreated` | `triples WHERE creator_id = $user AND subject is Agent/Skill` |
| `totalSignals` | `signals_aggregate WHERE account_id = $user` |
| `totalPositions` | `positions WHERE account_id = $user AND shares > 0` |
| `tTrustStakedNum` | sum of all active position shares / 1e18 |
| `daysActive` | calculated from earliest created_at across atoms + positions |
| `reportsSubmitted` | `triples WHERE creator_id = $user AND predicate ILIKE 'reported_for_%'` |

---

## Badge System — How It Works

```
fetchProfileData(address)
        │
        ▼
  UserStats (computed from GraphQL)
        │
        ▼
  autoBuildBadges(stats)   ← src/lib/badges.ts
        │  checks every BadgeDefinition.requirements[]
        ▼
  UserBadge[]  (only badges where ALL requirements are met)
        │
        ▼
  calculateExpertLevel(badges)
        │  returns: newcomer | contributor | expert | master | legend
        ▼
  UserProfile { stats, badges, expertLevel, ... }
```

### Badge Tiers

| Tier | Name | Color | Typical timeframe |
|------|------|-------|-------------------|
| 1 | Entry | Slate | First week |
| 2 | Bronze | Amber | 2–3 weeks |
| 3 | Silver | Indigo/Pink | 1–2 months |
| 4 | Gold | Cyan/Orange | 2–3 months |
| 5 | Platinum | Blue/Purple | 4–6 months |
| 6 | Diamond | Amber | 6–12 months |

### Badge Definitions (`src/lib/badges.ts`)

| ID | Tier | Key Requirements |
|----|------|-----------------|
| `newcomer` | 1 | 1 entity, 5 signals, 2 positions, 3 days active |
| `pioneer` | 2 | 3 entities, 25 signals, 5 positions, 0.05 tTRUST, 7 days |
| `first_stake` | 2 | 0.1 tTRUST, 3 support positions, 15 signals, 7 days |
| `builder` | 3 | 8 entities, 3 claims, 75 signals, 0.5 tTRUST, 21 days |
| `supporter` | 3 | 8 support positions, 15 total positions, 60 signals, 1 tTRUST |
| `networker` | 4 | 15 entities, 8 claims, 200 signals, 2.5 tTRUST, 45 days |
| `guardian` | 4 | 5 reports, 10 entities, 150 signals, 20 positions, 30 days |
| `whale` | 5 | 10 tTRUST, 500 signals, 40 positions, 20 entities, 5 skills |
| `veteran` | 5 | 120 days, 400 signals, 15 entities, 12 claims, 5 tTRUST |
| `legend` | 6 | 30 entities, 20 claims, 1000 signals, 75 positions, 25 tTRUST, 180 days |

### Expert Level (for Trust Score weight)

```
badges earned → calculateExpertLevel()

  0 badges                  → newcomer   (weight ×1.0)
  any badge tier ≥2         → contributor (weight ×1.25)
  any badge tier ≥4         → expert     (weight ×1.5)
  any badge tier ≥5         → master     (weight ×2.0)
  badge tier 6 OR ≥9 badges → legend     (weight ×3.0)
```

---

## Leaderboard — How It Works (`src/app/leaderboard/page.tsx`)

The leaderboard fetches **all platform activity** in a single GraphQL query,
then aggregates client-side by wallet address.

```
GraphQL (one query, 5 sub-queries)
  ├─ agents[]      { creator_id }         → up to 500
  ├─ skills[]      { creator_id }         → up to 500
  ├─ claims[]      { creator_id }         → up to 500
  ├─ positions[]   { account_id, shares } → up to 2000
  └─ signals[]     { account_id }         → up to 5000
          │
          ▼
  Group by address (Map<address, LeaderboardEntry>)
          │
          ▼
  Calculate composite score per user:
    score = agentsRegistered × 15
          + skillsRegistered × 15
          + claimsCreated    × 10
          + totalPositions   ×  5
          + tTrustStaked     × 20
          + totalSignals     ×  1
          │
          ▼
  Sort descending → top 50 displayed
```

### Leaderboard Tabs

| Tab | Sorted By |
|-----|-----------|
| Overall | Composite score |
| Builders | totalEntities (agents + skills + claims) |
| Stakers | tTrustStaked (active positions sum) |
| Explorers | totalSignals |

---

## Profile Metadata Storage

On-chain data covers everything **objective** (activity, stakes, registrations).
**Subjective** profile data (display name, avatar, bio, social links) is stored
in `localStorage` under the key `agent_score_profiles`:

```json
{
  "0xABCD...1234": {
    "name": "Alice",
    "bio": "AI researcher",
    "avatar": "https://...",
    "website": "https://...",
    "twitter": "@alice"
  }
}
```

> Note: localStorage is device-local. In a future version this could be stored
> as an Intuition atom linked to the wallet address for full decentralization.

---

## Public Profile (`/profile/[address]`)

Any wallet address can be viewed publicly via `/profile/[address]`.
The page runs the same `fetchProfileData()` flow as the user's own profile,
but read-only — no edit controls shown.

---

---

## App-Scoping & Network Configuration

All GraphQL filters and atom-label prefixes are driven by environment variables.
This allows zero-code migrations to new networks and clean data namespacing.

### Configuration files

| File | Purpose |
|------|---------|
| `src/lib/app-config.ts` | Reads all `NEXT_PUBLIC_` env vars into a typed `APP_CONFIG` object |
| `src/lib/gql-filters.ts` | Exports pre-built filter strings/objects used in every GraphQL query |
| `.env.local.example` | Full reference with descriptions of every env variable |
| `.env.local` | Your local overrides (gitignored — never commit) |

### How it works

```
.env.local
  └─ NEXT_PUBLIC_AGENT_PREFIX=Agent:alpha:
       │
       ▼
  app-config.ts  →  APP_CONFIG.AGENT_PREFIX = "Agent:alpha:"
       │
       ▼
  gql-filters.ts →  AGENT_WHERE_STR = '{ label: { _ilike: "Agent:alpha:%" } }'
       │                               AGENT_PREFIX = "Agent:alpha:"
       │
       ├─► intuition.ts   createAtomFromString("Agent:alpha: My Bot - ...")
       ├─► agents/page    atoms(where: ${AGENT_WHERE_STR})
       ├─► leaderboard    atoms(where: { label: { _ilike: "${AGENT_PREFIX}%" } })
       └─► all other GQL  same pattern
```

### Scenarios

**Current testnet (default)**
```env
NEXT_PUBLIC_AGENT_PREFIX=Agent:
NEXT_PUBLIC_SKILL_PREFIX=Skill:
NEXT_PUBLIC_APP_SCOPE=true
```

**Fresh alpha testnet — clean slate with new tag**
```env
NEXT_PUBLIC_AGENT_PREFIX=Agent:alpha:
NEXT_PUBLIC_SKILL_PREFIX=Skill:alpha:
NEXT_PUBLIC_APP_SCOPE=true
NEXT_PUBLIC_ALPHA_DATE=2025-06-01T00:00:00Z
```
→ All new registrations will be labeled `Agent:alpha: Name`.
→ Queries will only return atoms with that prefix AND created after the date.
→ Old testnet data is invisible.

**Mainnet — show all Intuition community content**
```env
NEXT_PUBLIC_GRAPHQL_URL=https://prod.intuition.sh/v1/graphql
NEXT_PUBLIC_APP_SCOPE=false
# Leave ALPHA_DATE empty
```
→ Label filter is removed. All atoms/triples on the network are visible.
→ AgentScore still creates atoms with its own prefixes, but reads everything.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/types/user.ts` | TypeScript interfaces: UserProfile, UserStats, UserBadge |
| `src/lib/badges.ts` | Badge definitions, requirements, calculation functions |
| `src/hooks/useUserProfile.ts` | GraphQL fetch + stats/badge computation |
| `src/app/profile/page.tsx` | My Profile page (requires wallet connection) |
| `src/app/profile/[address]/page.tsx` | Public profile view (any address) |
| `src/app/leaderboard/page.tsx` | Leaderboard — top contributors on-chain |
| `src/components/profile/MyBadges.tsx` | Badge display component |
| `src/components/profile/ProfileStats.tsx` | Stats summary component |

---

## Rewarding Users

Since all data is on-chain and public, rewarding top contributors is straightforward:

1. **Visit `/leaderboard`** — see ranked list of all active addresses
2. **Click any address** — opens full public profile with stats, badges, activity
3. **Copy address** — send rewards directly on-chain (tTRUST, NFTs, etc.)
4. **Use GraphQL** — query `leaderboard` data programmatically for automated airdrops

No centralized database needed — the chain is the source of truth.
