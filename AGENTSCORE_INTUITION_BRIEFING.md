# 🛡️ AGENTSCORE ON INTUITION - KOMPLETNY BRIEFING

## 📋 PRZECZYTAJ TO NAJPIERW

Cześć Claude! Jesteś lead developerem projektu **AgentScore** - systemu Trust Score dla AI Agentów, budowanego **natywnie na Intuition Protocol**.

Ten dokument zawiera WSZYSTKO co musisz wiedzieć. Przeczytaj dokładnie przed rozpoczęciem.

---

## 🎯 MISJA PROJEKTU

**AgentScore** to pierwsza aplikacja do weryfikacji reputacji AI Agentów zbudowana na Intuition Protocol.

### Problem:
- 770K+ agentów AI w ekosystemie (Moltbook, OpenClaw, etc.)
- Agenty nie mają sposobu weryfikacji czy inny agent jest godny zaufania
- Prompt injection attacks, kradzież API keys, scamy
- Brak standardu dla trust/reputation w ekosystemie AI agents

### Rozwiązanie:
System gdzie agenty i użytkownicy mogą:
1. **Rejestrować** agentów jako Atoms w Intuition
2. **Attestować** zaufanie/nieufność stakując $TRUST
3. **Weryfikować** trust score przed interakcją
4. **Raportować** malicious agents

---

## 🏗️ INTUITION PROTOCOL - PODSTAWY

### Co to jest Intuition?

**Intuition decentralizuje informację** - tak jak Ethereum zdecentralizował pieniądze.

Kluczowe komponenty:

### 1. Atoms (DIDs)
Unikalne identyfikatory dla WSZYSTKIEGO - osób, konceptów, agentów AI:
```
Atom = {
  id: "unique-hash",
  atomData: "ipfs://... lub URL definiujący co to jest",
  vault: "bonding curve token dla tego Atomu"
}
```

### 2. Triples (Attestations)
Strukturalne twierdzenia w formacie Subject-Predicate-Object:
```
[Agent_A] [trusts] [Agent_B]
[User_X] [reports_scam] [Agent_C]
[Agent_D] [is] [verified_developer]
```

### 3. Signals ($TRUST staking)
Ekonomiczne poparcie dla attestations:
```
User stakes 100 $TRUST on: [Agent_A] [is] [trustworthy]
- Więcej stake = silniejszy sygnał
- Early stakers zarabiają gdy inni dołączają (bonding curve)
- Błędne attestations = strata stake
```

### 4. Intuition Network
- **Layer 3** na Base (Arbitrum Orbit + AnyTrust)
- ~10,000x tańszy i ~100x szybszy niż L1
- Native token: $TRUST

---

## 📐 ARCHITEKTURA AGENTSCORE

```
┌─────────────────────────────────────────────────────────────┐
│                 AgentScore dApp (Frontend)                  │
│                   Next.js + Tailwind + wagmi                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Register   │  │    Trust     │  │   Report     │      │
│  │    Agent     │  │   Explorer   │  │  Incidents   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   @0xintuition/sdk                          │
│         TypeScript SDK for Atoms, Triples, Signals          │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌───────────────────┐
│ Intuition       │ │  GraphQL  │ │  MultiVault       │
│ Network (L3)    │ │   API     │ │  Smart Contracts  │
│ Chain ID: TBD   │ │           │ │                   │
└─────────────────┘ └───────────┘ └───────────────────┘
```

---

## 🔧 TECH STACK

### Frontend:
- **Next.js 14** (App Router)
- **Tailwind CSS** + custom dark theme
- **wagmi** + **viem** (wallet connection)
- **@0xintuition/sdk** (Intuition integration)
- **@tanstack/react-query** (data fetching)

### Intuition Integration:
```bash
npm install @0xintuition/sdk @0xintuition/protocol viem wagmi
```

### Key SDK Functions:
```typescript
import { 
  createAtomFromString,     // Tworzenie Atomu
  createTripleStatement,    // Tworzenie Triple (attestation)
  getAtomDetails,           // Pobieranie danych Atomu
  getTripleDetails,         // Pobieranie danych Triple
  calculateAtomId,          // Obliczanie ID atomu
  getMultiVaultAddressFromChainId,
  intuitionTestnet          // Testnet chain config
} from '@0xintuition/sdk'

import { createPublicClient, createWalletClient, http } from 'viem'
```

---

## 📊 SCHEMA: ATOMS I PREDICATES DLA AI AGENTS

### Atoms do utworzenia:

#### 1. Agent Type Atom
```
atomData: "AI Agent"
description: "Category for all AI agents in the ecosystem"
```

#### 2. Individual Agent Atoms
```
atomData: {
  "@type": "AIAgent",
  "name": "OpenClawBot",
  "platform": "Moltbook",
  "walletAddress": "0x...",
  "createdAt": "2026-01-15"
}
```

#### 3. Predicate Atoms (Standards)
```
[trusts]              - "I trust this agent"
[distrusts]           - "I don't trust this agent"
[reported_for_scam]   - "This agent is a scammer"
[reported_for_spam]   - "This agent spams"
[reported_for_injection] - "This agent does prompt injection"
[verified_by]         - "Verified by X"
[is]                  - Generic "is" predicate
[has_tag]             - Tagging predicate
```

#### 4. Quality Atoms
```
[trustworthy]         - "Is trustworthy"
[scammer]             - "Is a scammer"
[verified_developer]  - "Is a verified developer"
[high_quality]        - "High quality agent"
```

---

## 🔢 TRUST SCORE CALCULATION

W Intuition, Trust Score NIE jest obliczany przez nas - wynika z **staked $TRUST**:

```
Trust Score = 
  SUM(positive_attestations * stake) - SUM(negative_attestations * stake)

Przykład:
[User_A] stakes 100 $TRUST: [Agent_X] [is] [trustworthy]
[User_B] stakes 50 $TRUST:  [Agent_X] [is] [trustworthy]  
[User_C] stakes 200 $TRUST: [Agent_X] [is] [scammer]

Net Score = (100 + 50) - 200 = -50 (NEGATIVE = don't trust!)
```

### Normalizacja do 0-100:
```typescript
function calculateDisplayScore(positiveStake: bigint, negativeStake: bigint): number {
  const total = positiveStake + negativeStake;
  if (total === 0n) return 50; // Neutral for new agents
  
  const ratio = Number(positiveStake) / Number(total);
  return Math.round(ratio * 100);
}
```

---

## 🌐 INTUITION ENDPOINTS

### Testnet:
```
Portal:     https://testnet.portal.intuition.systems/
Hub:        https://testnet.hub.intuition.systems/
Explorer:   https://testnet.explorer.intuition.systems/
GraphQL:    [sprawdź docs]
```

### Mainnet:
```
Portal:     https://portal.intuition.systems/
Hub:        https://hub.intuition.systems/
Explorer:   https://explorer.intuition.systems/
Bridge:     https://portal.intuition.systems/bridge
```

### SDK Chain Config:
```typescript
import { intuitionTestnet } from '@0xintuition/protocol'

const publicClient = createPublicClient({
  chain: intuitionTestnet,
  transport: http(),
})
```

---

## 🗺️ ROADMAP

### FAZA 1: Research & Setup (Tydzień 1)
- [ ] Przeczytaj pełną dokumentację Intuition
- [ ] Utwórz wallet i połącz z testnet
- [ ] Zdobądź testowe tokeny z faucet
- [ ] Przetestuj SDK - utwórz pierwszy Atom
- [ ] Przetestuj tworzenie Triple

### FAZA 2: Schema Design (Tydzień 2)
- [ ] Zdefiniuj wszystkie potrzebne Atoms (predicates, categories)
- [ ] Utwórz Atoms na testnet
- [ ] Zapisz Atom IDs
- [ ] Przetestuj attestations

### FAZA 3: MVP Frontend (Tygodnie 3-4)
- [ ] Setup Next.js + wagmi
- [ ] Wallet connection (MetaMask, WalletConnect)
- [ ] Register Agent form (tworzy Atom)
- [ ] Trust/Distrust buttons (tworzy Triple + stake)
- [ ] Agent Explorer (lista agentów z GraphQL)
- [ ] Agent Detail page (score, attestations)

### FAZA 4: Polish (Tydzień 5)
- [ ] UI/UX improvements
- [ ] Error handling
- [ ] Loading states
- [ ] Mobile responsive

### FAZA 5: Launch (Tydzień 6)
- [ ] Deploy na Vercel
- [ ] Dokumentacja
- [ ] Post na Farcaster/Twitter
- [ ] Aplikacja o Grant

---

## 📁 STRUKTURA PROJEKTU

```
agentscore-intuition/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── layout.tsx               # Root layout
│   │   ├── agents/
│   │   │   ├── page.tsx             # Agent explorer
│   │   │   └── [id]/page.tsx        # Agent detail
│   │   ├── register/
│   │   │   └── page.tsx             # Register new agent
│   │   └── providers.tsx            # wagmi + query providers
│   ├── components/
│   │   ├── WalletConnect.tsx
│   │   ├── AgentCard.tsx
│   │   ├── TrustButton.tsx
│   │   ├── ReportButton.tsx
│   │   └── ScoreDisplay.tsx
│   ├── lib/
│   │   ├── intuition.ts             # SDK wrapper
│   │   ├── atoms.ts                 # Atom IDs & helpers
│   │   ├── graphql.ts               # GraphQL queries
│   │   └── utils.ts                 # Helpers
│   └── hooks/
│       ├── useAtom.ts
│       ├── useTriple.ts
│       └── useAgentScore.ts
├── package.json
├── tailwind.config.ts
├── wagmi.config.ts
└── .env.local
```

---

## 🔑 KLUCZOWE FUNKCJE DO ZAIMPLEMENTOWANIA

### 1. Rejestracja Agenta (Create Atom)
```typescript
import { createAtomFromString } from '@0xintuition/sdk'

async function registerAgent(name: string, metadata: object) {
  const atomData = JSON.stringify({
    "@type": "AIAgent",
    name,
    ...metadata
  })
  
  const result = await createAtomFromString(
    { walletClient, publicClient, address: multivaultAddress },
    atomData
  )
  
  return result.state.vaultId // This is the Agent's Atom ID
}
```

### 2. Trust/Distrust Agent (Create Triple + Stake)
```typescript
import { createTripleStatement } from '@0xintuition/sdk'

async function trustAgent(agentAtomId: bigint) {
  // Predicate "trusts" Atom ID (pre-created)
  const TRUSTS_PREDICATE = 123n // Get from your schema
  // Object "trustworthy" Atom ID (pre-created)  
  const TRUSTWORTHY_ATOM = 456n
  
  const triple = await createTripleStatement(
    { walletClient, publicClient, address: multivaultAddress },
    {
      args: [agentAtomId, TRUSTS_PREDICATE, TRUSTWORTHY_ATOM],
      value: parseEther('0.01') // Stake amount in $TRUST
    }
  )
  
  return triple
}
```

### 3. Get Agent Trust Score (GraphQL)
```graphql
query GetAgentScore($atomId: String!) {
  atom(id: $atomId) {
    id
    label
    vault {
      totalShares
      positionCount
    }
  }
  
  triples(where: { subject: $atomId }) {
    id
    predicate { label }
    object { label }
    vault {
      totalShares
    }
  }
}
```

---

## 📚 ZASOBY

### Oficjalna Dokumentacja:
- Docs: https://www.docs.intuition.systems/docs
- SDK: https://github.com/0xIntuition/intuition-ts/tree/main/packages/sdk
- Whitepaper: https://github.com/0xIntuition/intuition-whitepaper
- $TRUST Whitepaper: https://github.com/0xIntuition/trust-whitepaper

### Testnet:
- Portal: https://testnet.portal.intuition.systems/
- Hub (Faucet): https://testnet.hub.intuition.systems/
- Explorer: https://testnet.explorer.intuition.systems/

### Community:
- Discord: (zapytaj o link)
- Twitter: https://twitter.com/0xIntuition
- Forum: https://atlas.discourse.group/

### Kontakty w Intuition:
- @Fvngbill - team member
- @Zet - team member (pomoc z projektem)

---

## ✅ CHECKLIST PRZED STARTEM

- [ ] Przeczytałem cały briefing
- [ ] Rozumiem różnicę między starym (centralized) a nowym (Intuition) podejściem
- [ ] Rozumiem Atoms, Triples, Signals
- [ ] Mam dostęp do testnet
- [ ] Wiem gdzie szukać pomocy (docs, Discord)

---

## 🚨 WAŻNE RÓŻNICE VS POPRZEDNI KOD

| Stary kod (Supabase) | Nowy kod (Intuition) |
|---------------------|----------------------|
| Centralna baza danych | On-chain Atoms |
| Nasz algorytm score | Staked $TRUST |
| API keys | Wallet signatures |
| Rate limiting Redis | N/A (blockchain) |
| REST API | GraphQL + SDK |

**STARY KOD W FOLDERZE `agentscore/` JEST NIEAKTUALNY.**
Budujemy od zera na Intuition.

---

## 🎯 PIERWSZY KROK

1. Otwórz https://testnet.portal.intuition.systems/
2. Połącz wallet
3. Zdobądź testowe tokeny z Hub
4. Utwórz testowy Atom przez Portal
5. Sprawdź go w Explorer

Gdy to zrobisz, możemy zacząć kodować.

---

**Powodzenia! Budujemy coś ważnego dla ekosystemu AI. 🚀**

---
*Ostatnia aktualizacja: 8 lutego 2026*
*Projekt: AgentScore na Intuition*
