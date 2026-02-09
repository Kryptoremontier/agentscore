# 🚀 AGENTSCORE - OPUS MEGA PROMPT DLA CURSOR

## 📋 INSTRUKCJA UŻYCIA W CURSOR

### Krok 1: Umieść ten plik w głównym folderze projektu
```
D:\VIBE-CODING\AGENT_SCORE_INTUITION\OPUS_MEGA_PROMPT.md
```

### Krok 2: Otwórz Cursor Composer (Ctrl+I lub Cmd+I)

### Krok 3: Wklej prompt startowy:
```
@OPUS_MEGA_PROMPT.md @AGENTSCORE_INTUITION_BRIEFING.md

Przeczytaj oba pliki i zacznij generować projekt AgentScore od ETAPU 1.
```

### Krok 4: Po każdym etapie napisz "kontynuuj" lub "ETAP X"

---

# 🎯 PROJEKT: AGENTSCORE

## KONTEKST BIZNESOWY

**AgentScore** to zdecentralizowana platforma weryfikacji reputacji dla agentów AI, zbudowana natywnie na **Intuition Protocol**.

### Problem:
- 770K+ agentów AI w ekosystemie (Moltbook, OpenClaw, Farcaster)
- Brak sposobu weryfikacji czy agent jest godny zaufania
- Prompt injection attacks, kradzież API keys, scamy
- Brak standardu trust/reputation dla AI agents

### Rozwiązanie:
- Agenty rejestrowane jako **Atoms** (on-chain identities)
- Użytkownicy stakują **$TRUST** za/przeciw agentom
- Trust score wynika z collective economic signals
- Wszystko zapisane permanentnie na blockchain

### Jak działa Trust Score:
```
Trust Score = f(positive_stakes, negative_stakes, attestations, reports)

Przykład:
+100 $TRUST staked "Agent_X is trustworthy"
+50 $TRUST staked "Agent_X is trustworthy"
-200 $TRUST staked "Agent_X is scammer"
─────────────────────────────────────────
Net = -50 → LOW TRUST (czerwony)
```

---

# 🏗️ ARCHITEKTURA TECHNICZNA

## Tech Stack (WYMAGANY):

```yaml
Framework:      Next.js 14 (App Router, Server Components)
Language:       TypeScript 5.x (strict mode)
Styling:        Tailwind CSS 3.4 + shadcn/ui
Web3:           wagmi v2 + viem v2 + @0xintuition/sdk
State:          @tanstack/react-query v5
Animations:     Framer Motion 11
Icons:          Lucide React
Fonts:          Inter (UI) + JetBrains Mono (numbers/code)
```

## Struktura Projektu (DOCELOWA):

```
agentscore/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout + metadata
│   │   ├── page.tsx                # Landing page
│   │   ├── providers.tsx           # All providers wrapper
│   │   ├── globals.css             # Global styles + Tailwind
│   │   ├── agents/
│   │   │   ├── page.tsx            # Agent Explorer
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Agent Detail
│   │   ├── register/
│   │   │   └── page.tsx            # Register Agent
│   │   └── api/                    # API routes (if needed)
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── tooltip.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # Main navigation
│   │   │   ├── Footer.tsx          # Footer
│   │   │   └── MobileNav.tsx       # Mobile drawer
│   │   │
│   │   ├── landing/
│   │   │   ├── Hero.tsx            # Hero section
│   │   │   ├── HowItWorks.tsx      # 3-step explanation
│   │   │   ├── FeaturedAgents.tsx  # Top agents carousel
│   │   │   ├── Stats.tsx           # Live statistics
│   │   │   └── CTA.tsx             # Call to action
│   │   │
│   │   ├── agents/
│   │   │   ├── AgentCard.tsx       # Card in grid
│   │   │   ├── AgentGrid.tsx       # Grid with filters
│   │   │   ├── AgentHeader.tsx     # Detail page header
│   │   │   ├── AgentStats.tsx      # Stats cards
│   │   │   └── AgentTabs.tsx       # Tabbed content
│   │   │
│   │   ├── trust/
│   │   │   ├── TrustScoreBadge.tsx # Circular score display
│   │   │   ├── TrustBreakdown.tsx  # Score breakdown bars
│   │   │   ├── TrustButton.tsx     # Trust/Distrust action
│   │   │   ├── StakingModal.tsx    # Staking dialog
│   │   │   └── ReportModal.tsx     # Report dialog
│   │   │
│   │   ├── attestations/
│   │   │   ├── AttestationCard.tsx # Single attestation
│   │   │   ├── AttestationList.tsx # List with filters
│   │   │   └── ActivityFeed.tsx    # Timeline view
│   │   │
│   │   ├── wallet/
│   │   │   ├── WalletButton.tsx    # Connect/Connected states
│   │   │   ├── WalletModal.tsx     # Wallet selection
│   │   │   └── NetworkBadge.tsx    # Chain indicator
│   │   │
│   │   └── shared/
│   │       ├── GlassCard.tsx       # Reusable glass container
│   │       ├── GradientText.tsx    # Animated gradient text
│   │       ├── AnimatedCounter.tsx # Number animation
│   │       ├── EmptyState.tsx      # No results
│   │       └── LoadingSkeleton.tsx # Loading states
│   │
│   ├── hooks/
│   │   ├── useAgent.ts             # Fetch single agent
│   │   ├── useAgents.ts            # Fetch agent list
│   │   ├── useAttestation.ts       # Attestation operations
│   │   ├── useTrustScore.ts        # Calculate/fetch score
│   │   ├── useStaking.ts           # Staking operations
│   │   └── useIntuition.ts         # SDK wrapper
│   │
│   ├── lib/
│   │   ├── intuition.ts            # Intuition SDK config
│   │   ├── wagmi.ts                # wagmi config
│   │   ├── graphql.ts              # GraphQL queries
│   │   ├── constants.ts            # Atom IDs, addresses
│   │   ├── utils.ts                # Helper functions
│   │   └── cn.ts                   # className merger
│   │
│   └── types/
│       ├── agent.ts                # Agent interfaces
│       ├── attestation.ts          # Attestation types
│       └── index.ts                # Re-exports
│
├── public/
│   ├── fonts/
│   └── images/
│
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── .env.local
```

---

# 🎨 DESIGN SYSTEM

## Paleta Kolorów (Tailwind Config):

```typescript
// tailwind.config.ts
const colors = {
  // Backgrounds
  background: {
    DEFAULT: '#0A0A0F',      // Deep space black
    secondary: '#0D1117',     // Card backgrounds
    tertiary: '#161B22',      // Elevated surfaces
  },
  
  // Brand colors (Intuition-inspired)
  primary: {
    DEFAULT: '#0066FF',       // Electric blue
    hover: '#0052CC',
    light: '#3385FF',
  },
  
  accent: {
    cyan: '#00D4FF',          // Highlights
    purple: '#8B5CF6',        // Secondary accent
  },
  
  // Semantic colors
  trust: {
    excellent: '#06B6D4',     // 90-100 (cyan)
    good: '#22C55E',          // 70-89 (green)
    moderate: '#EAB308',      // 50-69 (yellow)
    low: '#F97316',           // 30-49 (orange)
    critical: '#EF4444',      // 0-29 (red)
  },
  
  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
  
  // Borders
  border: {
    DEFAULT: 'rgba(255,255,255,0.1)',
    hover: 'rgba(255,255,255,0.2)',
  },
}
```

## Efekty Wizualne (CSS Classes):

```css
/* globals.css */

/* Glassmorphism */
.glass {
  @apply bg-white/5 backdrop-blur-xl border border-white/10;
}

.glass-hover {
  @apply hover:bg-white/10 hover:border-white/20 transition-all duration-300;
}

/* Glow effects */
.glow-blue {
  box-shadow: 0 0 40px rgba(0, 102, 255, 0.3);
}

.glow-cyan {
  box-shadow: 0 0 40px rgba(0, 212, 255, 0.3);
}

.glow-green {
  box-shadow: 0 0 40px rgba(34, 197, 94, 0.3);
}

/* Gradient text */
.gradient-text {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400;
}

/* Gradient border */
.gradient-border {
  position: relative;
  background: linear-gradient(var(--background), var(--background)) padding-box,
              linear-gradient(135deg, #0066FF, #00D4FF, #8B5CF6) border-box;
  border: 1px solid transparent;
}

/* Animated background mesh */
.mesh-gradient {
  background: 
    radial-gradient(at 40% 20%, rgba(0, 102, 255, 0.15) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.1) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(0, 212, 255, 0.1) 0px, transparent 50%),
    radial-gradient(at 80% 100%, rgba(0, 102, 255, 0.1) 0px, transparent 50%);
}

/* Subtle grid pattern */
.grid-pattern {
  background-image: 
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}

/* Shimmer loading */
.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0.05) 50%,
    rgba(255,255,255,0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

# 📦 ETAPY GENEROWANIA

## ETAP 1: Konfiguracja Projektu

Wygeneruj następujące pliki:

### 1.1 package.json
```json
{
  "name": "agentscore",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.28.0",
    "wagmi": "^2.5.0",
    "viem": "^2.8.0",
    "@0xintuition/sdk": "latest",
    "@0xintuition/protocol": "latest",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.350.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-dropdown-menu": "^2.0.6"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "eslint": "^8.56.0",
    "eslint-config-next": "14.2.0"
  }
}
```

### 1.2 tailwind.config.ts
Pełna konfiguracja z kolorami, fontami, animacjami z Design System powyżej.

### 1.3 tsconfig.json
Strict TypeScript config z path aliases.

### 1.4 next.config.js
Z optimizations i image domains.

### 1.5 src/lib/cn.ts
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## ETAP 2: Types & Constants

### 2.1 src/types/agent.ts
```typescript
export interface Agent {
  id: string                    // Atom ID
  atomId: bigint               // On-chain ID
  name: string
  description: string | null
  platform: AgentPlatform
  walletAddress: `0x${string}` | null
  createdAt: Date
  verificationLevel: VerificationLevel
  
  // Computed from attestations
  trustScore: number           // 0-100
  positiveStake: bigint        // Total positive $TRUST
  negativeStake: bigint        // Total negative $TRUST
  attestationCount: number
  reportCount: number
  stakerCount: number
}

export type AgentPlatform = 
  | 'moltbook' 
  | 'openclaw' 
  | 'farcaster' 
  | 'twitter' 
  | 'custom'

export type VerificationLevel = 
  | 'none'           // 0 - unverified
  | 'wallet'         // 1 - wallet connected
  | 'social'         // 2 - social verified
  | 'kyc'            // 3 - fully verified

export type TrustLevel = 
  | 'excellent'      // 90-100
  | 'good'           // 70-89
  | 'moderate'       // 50-69
  | 'low'            // 30-49
  | 'critical'       // 0-29

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'moderate'
  if (score >= 30) return 'low'
  return 'critical'
}

export function getTrustColor(level: TrustLevel): string {
  const colors: Record<TrustLevel, string> = {
    excellent: '#06B6D4',
    good: '#22C55E',
    moderate: '#EAB308',
    low: '#F97316',
    critical: '#EF4444',
  }
  return colors[level]
}
```

### 2.2 src/types/attestation.ts
```typescript
export interface Attestation {
  id: string
  tripleId: bigint
  
  // Subject (who is being attested)
  subject: {
    id: string
    name: string
    type: 'agent' | 'user'
  }
  
  // Predicate (what kind of attestation)
  predicate: AttestationPredicate
  
  // Object (the claim)
  object: {
    id: string
    label: string
  }
  
  // Staker info
  staker: {
    address: `0x${string}`
    name?: string
  }
  
  stakeAmount: bigint
  createdAt: Date
  transactionHash: `0x${string}`
}

export type AttestationPredicate = 
  | 'trusts'
  | 'distrusts'
  | 'reported_for_scam'
  | 'reported_for_spam'
  | 'reported_for_injection'
  | 'verified_by'
  | 'vouches_for'

export type ReportType = 
  | 'scam'
  | 'spam'
  | 'prompt_injection'
  | 'impersonation'
  | 'other'
```

### 2.3 src/lib/constants.ts
```typescript
// Atom IDs for predicates (to be filled after creation on testnet)
export const PREDICATE_ATOMS = {
  trusts: 0n,              // [trusts] predicate
  distrusts: 0n,           // [distrusts] predicate
  reported_for_scam: 0n,
  reported_for_spam: 0n,
  reported_for_injection: 0n,
  verified_by: 0n,
  is: 0n,                  // Generic [is] predicate
  has_tag: 0n,             // [has_tag] predicate
} as const

// Object Atoms
export const OBJECT_ATOMS = {
  trustworthy: 0n,
  scammer: 0n,
  verified_developer: 0n,
  ai_agent: 0n,            // Category atom
} as const

// Contract addresses
export const CONTRACTS = {
  multiVault: '0x...' as `0x${string}`,
} as const

// API endpoints
export const API = {
  graphql: {
    testnet: 'https://api.testnet.intuition.systems/graphql',
    mainnet: 'https://api.intuition.systems/graphql',
  },
} as const

// Chain config
export const CHAIN = {
  testnet: {
    id: 0, // Fill with actual chain ID
    name: 'Intuition Testnet',
    rpcUrl: 'https://rpc.testnet.intuition.systems',
  },
} as const
```

---

## ETAP 3: Providers & Config

### 3.1 src/lib/wagmi.ts
```typescript
'use client'

import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

// Custom Intuition chain (if needed)
// import { intuitionTestnet } from '@0xintuition/protocol'

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'AgentScore' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

### 3.2 src/app/providers.tsx
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { useState, type ReactNode } from 'react'
import { config } from '@/lib/wagmi'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
    })
  )

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

### 3.3 src/app/layout.tsx
```typescript
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'AgentScore | Trust Layer for AI Agents',
  description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol.',
  keywords: ['AI agents', 'trust score', 'reputation', 'Intuition', 'Web3'],
  openGraph: {
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Verify AI agent reputation before interaction.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-background text-text-primary antialiased`}>
        <Providers>
          <div className="relative min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

### 3.4 src/app/globals.css
Pełny plik CSS z wszystkimi utilities z Design System.

---

## ETAP 4: Komponenty Core

### 4.1 TrustScoreBadge
```typescript
// src/components/trust/TrustScoreBadge.tsx
'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { getTrustLevel, getTrustColor, type TrustLevel } from '@/types/agent'

interface TrustScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  animated?: boolean
  className?: string
}

const sizeConfig = {
  sm: { container: 40, stroke: 3, fontSize: 'text-sm' },
  md: { container: 64, stroke: 4, fontSize: 'text-xl' },
  lg: { container: 100, stroke: 5, fontSize: 'text-3xl' },
  xl: { container: 160, stroke: 6, fontSize: 'text-5xl' },
}

export function TrustScoreBadge({
  score,
  size = 'md',
  showLabel = true,
  animated = true,
  className,
}: TrustScoreBadgeProps) {
  const level = getTrustLevel(score)
  const color = getTrustColor(level)
  const config = sizeConfig[size]
  
  const radius = (config.container - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div 
        className="relative"
        style={{ width: config.container, height: config.container }}
      >
        {/* Background ring */}
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${config.container} ${config.container}`}>
          <circle
            cx={config.container / 2}
            cy={config.container / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={config.stroke}
          />
          
          {/* Progress ring */}
          <motion.circle
            cx={config.container / 2}
            cy={config.container / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: animated ? 1 : 0, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 8px ${color})`,
            }}
          />
        </svg>
        
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={cn('font-mono font-bold', config.fontSize)}
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {animated ? (
              <AnimatedNumber value={score} />
            ) : (
              score
            )}
          </motion.span>
        </div>
        
        {/* Glow effect */}
        <div 
          className="absolute inset-0 rounded-full opacity-20 blur-xl"
          style={{ backgroundColor: color }}
        />
      </div>
      
      {showLabel && (
        <span className="text-sm text-text-secondary capitalize">
          {level} Trust
        </span>
      )}
    </div>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  // Implement counting animation
  return <span>{value}</span>
}
```

### 4.2 AgentCard
```typescript
// src/components/agents/AgentCard.tsx
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ExternalLink, Shield, AlertTriangle } from 'lucide-react'
import { TrustScoreBadge } from '@/components/trust/TrustScoreBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { Agent } from '@/types/agent'

interface AgentCardProps {
  agent: Agent
  className?: string
}

export function AgentCard({ agent, className }: AgentCardProps) {
  const isVerified = agent.verificationLevel !== 'none'
  
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/agents/${agent.id}`}>
        <div className={cn(
          'glass glass-hover rounded-xl p-5 cursor-pointer',
          'group relative overflow-hidden',
          className
        )}>
          {/* Gradient border on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl gradient-border pointer-events-none" />
          
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{agent.name}</h3>
                  {isVerified && (
                    <Badge variant="success" size="sm">✓</Badge>
                  )}
                </div>
                <Badge variant="secondary" size="sm">
                  {agent.platform}
                </Badge>
              </div>
            </div>
            
            {/* Trust Score */}
            <TrustScoreBadge score={agent.trustScore} size="sm" showLabel={false} />
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="text-text-muted">Stakes</span>
              <p className="font-mono font-medium">
                ${formatNumber(agent.positiveStake - agent.negativeStake)}
              </p>
            </div>
            <div>
              <span className="text-text-muted">Attestations</span>
              <p className="font-mono font-medium">{agent.attestationCount}</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1">
              <Shield className="w-4 h-4 mr-1" />
              Trust
            </Button>
            <Button size="sm" variant="ghost">
              View
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function formatNumber(value: bigint | number): string {
  const num = typeof value === 'bigint' ? Number(value) : value
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(2)
}
```

### 4.3 WalletButton
```typescript
// src/components/wallet/WalletButton.tsx
'use client'

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'

export function WalletButton() {
  const { address, isConnected, isConnecting } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })
  
  const [showConnectors, setShowConnectors] = useState(false)
  
  if (isConnecting) {
    return (
      <Button disabled className="min-w-[160px]">
        <Loader className="w-4 h-4 mr-2 animate-spin" />
        Connecting...
      </Button>
    )
  }
  
  if (!isConnected) {
    return (
      <>
        <Button 
          onClick={() => setShowConnectors(true)}
          className="glow-blue"
        >
          <Wallet className="w-4 h-4 mr-2" />
          Connect Wallet
        </Button>
        
        {/* Wallet selection modal */}
        <AnimatePresence>
          {showConnectors && (
            <WalletModal
              connectors={connectors}
              onConnect={(connector) => {
                connect({ connector })
                setShowConnectors(false)
              }}
              onClose={() => setShowConnectors(false)}
            />
          )}
        </AnimatePresence>
      </>
    )
  }
  
  // Connected state
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="glass">
          <div className="flex items-center gap-2">
            {/* Identicon */}
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent-cyan" />
            
            {/* Address */}
            <span className="font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            
            {/* Balance */}
            {balance && (
              <span className="text-text-secondary text-sm">
                {parseFloat(balance.formatted).toFixed(3)} {balance.symbol}
              </span>
            )}
            
            <ChevronDown className="w-4 h-4" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="glass w-56">
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(address!)}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://basescan.org/address/${address}`} target="_blank">
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Explorer
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="text-red-400">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 4.4 GlassCard (Reusable)
```typescript
// src/components/shared/GlassCard.tsx
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
}

export function GlassCard({ 
  children, 
  className,
  hover = false,
  gradient = false,
}: GlassCardProps) {
  return (
    <div className={cn(
      'glass rounded-xl p-6',
      hover && 'glass-hover',
      gradient && 'gradient-border',
      className
    )}>
      {children}
    </div>
  )
}
```

---

## ETAP 5: Landing Page

### 5.1 Hero Section
Wygeneruj pełny komponent Hero z:
- Animated gradient mesh background
- Headline z gradient text
- Subheadline
- CTA buttons
- Live stats ticker
- Floating trust score visualization

### 5.2 How It Works
3-step flow z ikonami i opisami

### 5.3 Featured Agents
Horizontal scroll z AgentCard

### 5.4 Stats Section
4 stat boxes z AnimatedCounter

### 5.5 CTA Section
Final call to action

### 5.6 Kompletna strona
```typescript
// src/app/page.tsx
import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { Stats } from '@/components/landing/Stats'
import { CTA } from '@/components/landing/CTA'

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <FeaturedAgents />
      <Stats />
      <CTA />
    </>
  )
}
```

---

## ETAP 6: Agent Explorer

### 6.1 Search & Filters
### 6.2 AgentGrid
### 6.3 Pagination
### 6.4 Empty State
### 6.5 Loading Skeletons

---

## ETAP 7: Agent Detail Page

### 7.1 Agent Header
### 7.2 Trust Score Hero
### 7.3 Action Buttons
### 7.4 Tabs (Overview, Attestations, Activity)
### 7.5 Attestation List
### 7.6 Activity Timeline

---

## ETAP 8: Modals & Forms

### 8.1 Staking Modal
### 8.2 Report Modal
### 8.3 Register Agent Form

---

## ETAP 9: Hooks & Data Fetching

### 9.1 useAgents hook
### 9.2 useAgent hook
### 9.3 useAttestation hook
### 9.4 useTrustScore hook
### 9.5 GraphQL queries

---

## ETAP 10: Final Polish

### 10.1 Loading states
### 10.2 Error boundaries
### 10.3 SEO metadata
### 10.4 Responsive fixes
### 10.5 Animations fine-tuning

---

# ✅ CHECKLIST GENEROWANIA

Po każdym etapie sprawdź:
- [ ] TypeScript kompiluje się bez błędów
- [ ] Komponenty są responsywne
- [ ] Dark mode wygląda dobrze
- [ ] Hover states działają
- [ ] Animacje są płynne

---

# 🚀 START

Aby rozpocząć, powiedz:

```
Zaczynam ETAP 1 - generuję konfigurację projektu:
1. package.json
2. tailwind.config.ts
3. tsconfig.json
4. next.config.js
5. src/lib/cn.ts
```

Po wygenerowaniu powiedz "ETAP 2" aby kontynuować.

---

**WAŻNE:** Ten prompt jest zoptymalizowany dla Claude Opus 4. Generuj plik po pliku, nie wszystko naraz. Każdy plik powinien być kompletny i gotowy do użycia.
