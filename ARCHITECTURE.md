# 🏗️ AgentScore Architecture

<p align="center">
  <em>"Simple things should be simple. Complex things should be possible."</em>
  <br/>— Alan Kay
</p>

---

## Design Philosophy

### 1. **User-Centric, Not Tech-Centric**
Every architectural decision starts with: "How does this improve the user's experience?"

### 2. **Composable, Not Monolithic**
Small, focused components that can be combined. Easy to test, easy to change.

### 3. **Progressive Complexity**
Simple by default. Power features available for those who need them.

### 4. **Resilient, Not Fragile**
Graceful degradation. Clear error states. Never leave users confused.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│                                                                          │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│   │   Browser   │     │   Mobile    │     │  Agent API  │               │
│   │   (React)   │     │   (PWA)     │     │  (Future)   │               │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
│          │                   │                   │                       │
└──────────┼───────────────────┼───────────────────┼───────────────────────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                     Next.js Application                         │    │
│   │                                                                 │    │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │    │
│   │   │   Pages/    │  │ Components/ │  │   Hooks/    │            │    │
│   │   │   Routes    │  │     UI      │  │   Logic     │            │    │
│   │   └─────────────┘  └─────────────┘  └─────────────┘            │    │
│   │                                                                 │    │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │    │
│   │   │   State     │  │   Wallet    │  │    API      │            │    │
│   │   │  (Zustand)  │  │  (wagmi)    │  │  (React Q)  │            │    │
│   │   └─────────────┘  └─────────────┘  └─────────────┘            │    │
│   │                                                                 │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Intuition SDK  │ │  RPC Provider   │ │  IPFS/Arweave   │
│   (Protocol)    │ │   (Alchemy)     │ │   (Metadata)    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        BLOCKCHAIN LAYER                                  │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                  Intuition Protocol Contracts                   │    │
│   │                                                                 │    │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │    │
│   │   │   Atoms     │  │  Triples    │  │  Signals    │            │    │
│   │   │  Registry   │  │  Registry   │  │   Vault     │            │    │
│   │   └─────────────┘  └─────────────┘  └─────────────┘            │    │
│   │                                                                 │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│                         Base L3 / Sepolia                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Framework** | Next.js 14 | SSR, App Router, great DX |
| **Language** | TypeScript | Type safety, better tooling |
| **Styling** | Tailwind CSS | Utility-first, fast iteration |
| **Components** | shadcn/ui | Accessible, customizable |
| **Animation** | Framer Motion | Smooth, performant |
| **State** | Zustand | Simple, minimal boilerplate |
| **Data Fetching** | React Query | Caching, background updates |
| **Wallet** | wagmi v2 | Modern, well-maintained |
| **Forms** | React Hook Form | Performant, good validation |

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── agents/
│   │   ├── page.tsx        # Agent explorer
│   │   └── [id]/
│   │       └── page.tsx    # Agent detail
│   ├── register/
│   │   └── page.tsx        # Register agent
│   └── profile/
│       └── page.tsx        # User profile
│
├── components/
│   ├── ui/                 # Base UI components (shadcn)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── layout/             # Layout components
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── PageBackground.tsx
│   │
│   ├── agents/             # Agent-specific components
│   │   ├── AgentCard.tsx
│   │   ├── AgentGrid.tsx
│   │   ├── TrustScore.tsx
│   │   └── StakingModal.tsx
│   │
│   ├── wallet/             # Wallet components
│   │   ├── WalletButton.tsx
│   │   └── WalletProvider.tsx
│   │
│   └── shared/             # Shared components
│       ├── PageBackground.tsx
│       └── LoadingState.tsx
│
├── hooks/                  # Custom React hooks
│   ├── useAgents.ts
│   ├── useStaking.ts
│   ├── useTrustScore.ts
│   └── useIntuition.ts
│
├── lib/                    # Utilities and configs
│   ├── utils.ts
│   ├── constants.ts
│   └── intuition.ts        # Intuition SDK wrapper
│
├── stores/                 # Zustand stores
│   ├── agentStore.ts
│   └── uiStore.ts
│
└── types/                  # TypeScript types
    ├── agent.ts
    ├── attestation.ts
    └── user.ts
```

---

## Component Design

### Atomic Design Principles

```
ATOMS (smallest units)
├── Button
├── Input
├── Badge
├── Avatar
└── Icon

MOLECULES (combinations of atoms)
├── SearchBar (Input + Icon + Button)
├── TrustBadge (Badge + Icon + Number)
├── WalletStatus (Avatar + Address + Balance)
└── FilterChip (Badge + Icon + Close)

ORGANISMS (complex components)
├── AgentCard (Avatar + TrustBadge + Stats + Actions)
├── StakingModal (Form + Inputs + Buttons + Feedback)
├── Navbar (Logo + Navigation + WalletStatus)
└── AgentGrid (FilterBar + AgentCards + Pagination)

TEMPLATES (page layouts)
├── ExplorerLayout (Navbar + Filters + Grid + Footer)
├── DetailLayout (Navbar + Hero + Content + Sidebar)
└── FormLayout (Navbar + Form + Help)

PAGES (final compositions)
├── HomePage
├── AgentsPage
├── AgentDetailPage
├── RegisterPage
└── ProfilePage
```

---

## State Management

### Global State (Zustand)

```typescript
// stores/agentStore.ts
interface AgentStore {
  // State
  agents: Agent[];
  selectedAgent: Agent | null;
  filters: FilterState;
  
  // Actions
  setAgents: (agents: Agent[]) => void;
  selectAgent: (id: string) => void;
  updateFilters: (filters: Partial<FilterState>) => void;
  
  // Computed
  filteredAgents: () => Agent[];
}
```

### Server State (React Query)

```typescript
// hooks/useAgents.ts
export function useAgents(filters: FilterState) {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: () => fetchAgents(filters),
    staleTime: 30_000,      // Consider fresh for 30s
    cacheTime: 5 * 60_000,  // Keep in cache for 5min
  });
}

export function useStakeMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: stakeOnAgent,
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries(['agents']);
      queryClient.invalidateQueries(['user-stakes']);
    },
  });
}
```

---

## Data Flow

### Reading Agent Data

```
User visits /agents
       │
       ▼
┌─────────────────┐
│ AgentsPage      │ ──→ useAgents() hook
└────────┬────────┘           │
         │                    ▼
         │            ┌───────────────┐
         │            │ React Query   │ ──→ Check cache
         │            └───────┬───────┘
         │                    │
         │                    ▼ (cache miss)
         │            ┌───────────────┐
         │            │ Intuition SDK │ ──→ Query protocol
         │            └───────┬───────┘
         │                    │
         │                    ▼
         │            ┌───────────────┐
         │            │ Transform     │ ──→ Normalize data
         │            └───────┬───────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────┐
│ Render AgentGrid with AgentCards    │
└─────────────────────────────────────┘
```

### Writing (Staking)

```
User clicks "Stake Trust"
       │
       ▼
┌─────────────────┐
│ StakingModal    │ ──→ User enters amount
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Form Validation │ ──→ Check balance, min stake
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Wallet Prompt   │ ──→ User confirms transaction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Intuition SDK   │ ──→ Send transaction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Wait for Tx     │ ──→ Show pending state
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tx Confirmed    │ ──→ Invalidate cache, update UI
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Success Toast   │ ──→ Show confirmation
└─────────────────┘
```

---

## Security Considerations

### Frontend Security

| Concern | Mitigation |
|---------|------------|
| **XSS** | React escaping, CSP headers |
| **Private Keys** | Never stored, wallet handles |
| **API Keys** | Environment variables, server-side |
| **User Input** | Validation, sanitization |

### Blockchain Security

| Concern | Mitigation |
|---------|------------|
| **Transaction Simulation** | Preview before signing |
| **Slippage** | User-defined limits |
| **Malicious Contracts** | Only interact with verified Intuition contracts |
| **Rug Pulls** | Trust data is on-chain, not in our DB |

---

## Performance Optimizations

### Current

- [x] Code splitting (Next.js automatic)
- [x] Image optimization (Next.js Image)
- [x] Font optimization (Next.js Fonts)
- [x] CSS purging (Tailwind)
- [x] React Query caching

### Planned

- [ ] Virtual scrolling for large lists
- [ ] Service worker for offline support
- [ ] Edge caching for static data
- [ ] WebSocket for real-time updates
- [ ] Optimistic UI updates

---

## Testing Strategy

### Unit Tests
```typescript
// components/__tests__/TrustScore.test.tsx
describe('TrustScore', () => {
  it('displays correct color for high score', () => {
    render(<TrustScore value={85} />);
    expect(screen.getByText('85')).toHaveClass('text-emerald-500');
  });
  
  it('displays correct color for low score', () => {
    render(<TrustScore value={35} />);
    expect(screen.getByText('35')).toHaveClass('text-red-500');
  });
});
```

### Integration Tests
```typescript
// __tests__/staking-flow.test.tsx
describe('Staking Flow', () => {
  it('completes stake successfully', async () => {
    // Setup mock wallet
    // Navigate to agent
    // Click stake
    // Enter amount
    // Confirm transaction
    // Verify success state
  });
});
```

### E2E Tests (Planned)
```typescript
// e2e/agent-registration.spec.ts
test('user can register a new agent', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="agentName"]', 'TestAgent');
  await page.selectOption('[name="category"]', 'Development');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/agents\/\w+/);
});
```

---

## Deployment

### Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                              │
│                                                             │
│   ┌─────────────────┐    ┌─────────────────┐               │
│   │   Edge Network  │    │   Serverless    │               │
│   │   (Static CDN)  │    │   Functions     │               │
│   └────────┬────────┘    └────────┬────────┘               │
│            │                      │                         │
│            └──────────┬───────────┘                         │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Intuition   │ │   Alchemy    │ │  Analytics   │
│    API       │ │   (RPC)      │ │  (Plausible) │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_WC_PROJECT_ID=xxx      # WalletConnect
NEXT_PUBLIC_NETWORK=base-sepolia   # Network
NEXT_PUBLIC_INTUITION_API=xxx      # Intuition API endpoint
ALCHEMY_API_KEY=xxx                # RPC provider (server-side)
```

---

## Future Considerations

### Scalability
- Indexed subgraph for complex queries
- Redis caching layer
- CDN for agent images/metadata

### Features
- Real-time updates via WebSocket
- Push notifications
- Mobile app (React Native)

### Decentralization
- IPFS for frontend hosting
- ENS domain integration
- Decentralized image storage

---

<p align="center">
  <em>Architecture serves users, not the other way around.</em>
</p>
