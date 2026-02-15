# 🔗 Intuition Protocol Integration

<p align="center">
  <em>"We don't build the engine. We build the car that everyone can drive."</em>
</p>

---

## Our Relationship with Intuition

AgentScore is built **on top of** Intuition Protocol—not as a competitor, but as a **complementary layer**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LAYER                               │
│                                                                 │
│   "I want to find a trustworthy AI agent for my task"           │
│                                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│                                                                 │
│   ┌───────────────┐                                             │
│   │  AgentScore   │  ← Beautiful UI, UX, Onboarding             │
│   └───────┬───────┘                                             │
│           │                                                     │
│   ┌───────┴───────┐                                             │
│   │ Intuition SDK │  ← Standardized API access                  │
│   └───────┬───────┘                                             │
│                                                                 │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROTOCOL LAYER                             │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐    │
│   │              Intuition Protocol                        │    │
│   │                                                        │    │
│   │   • Atoms (identities)                                 │    │
│   │   • Triples (claims/attestations)                      │    │
│   │   • Signals (economic stakes)                          │    │
│   │   • AgentRank (trust computation)                      │    │
│   │                                                        │    │
│   └───────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BLOCKCHAIN LAYER                            │
│                                                                 │
│                    Base L3 / Intuition Network                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Intuition Provides

### 🧩 Atoms
Unique identifiers for entities (agents, users, organizations).

```typescript
// An agent registered on Intuition
Atom {
  id: "intuition://atom/12345",
  type: "AIAgent",
  name: "CodeHelper-v2",
  metadata: {
    category: "Development",
    platform: "OpenAI",
    capabilities: ["code-review", "debugging"]
  }
}
```

### 🔺 Triples
Claims about relationships between entities.

```typescript
// An attestation about an agent
Triple {
  subject: "user:0x1234...",      // Who is making the claim
  predicate: "trusts",             // What kind of claim
  object: "agent:CodeHelper-v2",   // About whom
  stake: 100,                      // Economic weight (in $TRUST)
  timestamp: 1714567890
}
```

### 📊 Signals
Economic stakes that give weight to claims.

```typescript
// Staking on an agent
Signal {
  triple_id: "triple:67890",
  direction: "positive",    // Trust (vs "negative" for Distrust)
  amount: 50,               // $TRUST tokens
  staker: "0xabcd..."
}
```

### 🧠 AgentRank
Algorithm that computes trust scores from the graph of attestations.

```typescript
// Computed trust score
AgentRank {
  agent_id: "agent:CodeHelper-v2",
  trust_score: 87.5,
  positive_stake: 15000,
  negative_stake: 500,
  attestation_count: 234,
  expert_weight: 1.4     // Weighted by attester credibility
}
```

---

## What AgentScore Provides

### 🎨 User Interface
Beautiful, intuitive design that makes complex data accessible.

- Agent discovery and browsing
- Visual trust score representation
- Staking flow with clear UX
- Mobile-responsive design

### 🚀 User Experience
Simplified workflows that hide blockchain complexity.

- One-click wallet connection
- Guided registration process
- Clear feedback on transactions
- Error handling and recovery

### 📈 Analytics Layer
Insights and visualizations built on Intuition data.

- Trust score trends over time
- Comparative agent analysis
- Category leaderboards
- Risk indicators

### 🌍 Accessibility
Making decentralized trust available to everyone.

- No crypto jargon
- Educational tooltips
- Multi-language support (planned)
- Progressive complexity

---

## Integration Points

### 1. Agent Registration
```
User clicks "Register Agent" on AgentScore
         │
         ▼
AgentScore collects metadata (name, category, platform)
         │
         ▼
AgentScore calls Intuition SDK: createAtom()
         │
         ▼
Intuition Protocol creates on-chain Atom
         │
         ▼
AgentScore displays confirmation + agent profile
```

### 2. Trust/Distrust Staking
```
User clicks "Stake Trust" on an agent
         │
         ▼
AgentScore shows staking modal (amount, direction)
         │
         ▼
AgentScore calls Intuition SDK: createSignal()
         │
         ▼
Intuition Protocol records stake on-chain
         │
         ▼
AgentRank recalculates trust score
         │
         ▼
AgentScore displays updated score + user position
```

### 3. Querying Agent Data
```
User visits /agents page
         │
         ▼
AgentScore calls Intuition SDK: queryAtoms({ type: "AIAgent" })
         │
         ▼
Intuition returns list of agents with metadata
         │
         ▼
AgentScore calls AgentRank API for trust scores
         │
         ▼
AgentScore renders agent cards with all data
```

---

## Technical Implementation

### SDK Usage (Planned)

```typescript
import { IntuitionClient } from '@intuition/sdk';

// Initialize client
const intuition = new IntuitionClient({
  network: 'base-sepolia', // or 'base-mainnet'
  rpcUrl: process.env.RPC_URL,
});

// Register an agent
async function registerAgent(metadata: AgentMetadata) {
  const atom = await intuition.atoms.create({
    type: 'AIAgent',
    name: metadata.name,
    data: {
      category: metadata.category,
      platform: metadata.platform,
      description: metadata.description,
    },
  });
  return atom;
}

// Stake on an agent
async function stakeOnAgent(
  agentId: string, 
  amount: bigint, 
  isPositive: boolean
) {
  const signal = await intuition.signals.create({
    atomId: agentId,
    amount: amount,
    direction: isPositive ? 'positive' : 'negative',
  });
  return signal;
}

// Get agent trust score
async function getAgentTrustScore(agentId: string) {
  const score = await intuition.agentrank.getScore(agentId);
  return {
    trustScore: score.value,
    positiveStake: score.positiveStake,
    negativeStake: score.negativeStake,
    attestations: score.attestationCount,
  };
}
```

### GraphQL Queries (Planned)

```graphql
# Query agents by category
query GetAgentsByCategory($category: String!) {
  atoms(
    where: { 
      type: "AIAgent", 
      data_contains: { category: $category } 
    }
    orderBy: trustScore
    orderDirection: desc
  ) {
    id
    name
    trustScore
    positiveStake
    negativeStake
    attestations {
      id
      staker
      amount
      direction
      timestamp
    }
  }
}

# Get attestations for an agent
query GetAgentAttestations($agentId: ID!) {
  atom(id: $agentId) {
    attestations(first: 100, orderBy: timestamp, orderDirection: desc) {
      id
      staker {
        id
        expertBadges
        totalStaked
      }
      amount
      direction
      timestamp
    }
  }
}
```

---

## Value We Add to Intuition Ecosystem

| Value | Description |
|-------|-------------|
| **User Acquisition** | We bring non-crypto users to Intuition |
| **Real-World Testing** | We stress-test the protocol with real usage |
| **Feedback Loop** | We report bugs, suggest improvements |
| **Vertical Focus** | We prove the "AI agent trust" use case |
| **Design Patterns** | We establish UX patterns for other builders |
| **Documentation** | We contribute integration guides |

---

## Principles of Integration

### 1. **Protocol Agnostic UI**
Our interface should work even if underlying protocol changes. We abstract protocol details behind clean interfaces.

### 2. **Graceful Degradation**
If Intuition API is slow or down, we show cached data with clear indicators. Users never see cryptic errors.

### 3. **Transparent Attribution**
We always make clear that trust data comes from Intuition. We credit the protocol, not claim the data as ours.

### 4. **Minimal Wrapping**
We avoid unnecessary abstraction layers. Direct SDK usage where possible. Simplicity over cleverness.

### 5. **Upstream Contributions**
If we find bugs or improvements, we contribute back. We're part of the ecosystem, not just consumers.

---

## Future Integration Possibilities

### A2A Protocol Integration
When Google's Agent-to-Agent protocol matures, we can serve as a trust oracle:

```
Agent A wants to collaborate with Agent B
         │
         ▼
Agent A queries AgentScore API for Agent B's trust score
         │
         ▼
AgentScore returns Intuition-verified trust data
         │
         ▼
Agent A makes informed decision about collaboration
```

### Cross-Platform Trust
An agent's AgentScore profile could be recognized across:
- AI marketplaces
- Developer platforms
- Enterprise procurement systems
- Consumer applications

---

## Summary

AgentScore and Intuition Protocol are **symbiotic**:

| Intuition | AgentScore |
|-----------|------------|
| The engine | The car |
| The database | The interface |
| The algorithm | The visualization |
| The protocol | The product |
| Infrastructure | Experience |

Together, we make decentralized AI trust **real and usable**.

---

<p align="center">
  <a href="https://intuition.systems">Intuition Protocol</a> •
  <a href="https://docs.intuition.systems">Intuition Docs</a> •
  <a href="https://agentscore-gilt.vercel.app">AgentScore Demo</a>
</p>
