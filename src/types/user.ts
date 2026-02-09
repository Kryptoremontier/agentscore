export interface UserProfile {
  // Podstawowe dane
  address: `0x${string}`

  // Opcjonalne dane profilu
  name?: string
  bio?: string
  avatar?: string                    // IPFS hash lub URL
  website?: string
  twitter?: string
  farcaster?: string

  // Statystyki
  stats: UserStats

  // Odznaki
  badges: UserBadge[]
  expertLevel: ExpertLevel

  // Relacje
  registeredAgents: string[]         // Agent IDs które zarejestrował
  supportedAgents: AgentSupport[]    // Agenty które wspiera

  // Timestamps
  joinedAt: Date
  lastActiveAt: Date
}

export interface UserStats {
  totalAgentsRegistered: number
  totalTrustStaked: bigint           // Suma wszystkich stake'ów
  totalAttestations: number          // Ile razy atestował
  trustReceived: bigint              // Ile $TRUST otrzymał (jako agent owner)
  reputation: number                 // 0-100, wyliczane z aktywności
}

export interface AgentSupport {
  agentId: string
  stakedAmount: bigint
  shares: bigint                     // Udziały w bonding curve
  stakedAt: Date
  currentValue: bigint               // Aktualna wartość udziałów
  profitLoss: bigint                 // Zysk/strata
}

export interface UserBadge {
  id: string
  type: BadgeType
  name: string
  description: string
  icon: string
  earnedAt: Date
  level?: number                     // Dla badges z poziomami (Bronze, Silver, Gold)
}

export type BadgeType =
  | 'early_adopter'                  // Pierwsi 1000 użytkowników
  | 'trusted_expert'                 // Trust score > 90
  | 'prolific_supporter'             // Wspiera > 50 agentów
  | 'agent_creator'                  // Stworzył agenta z score > 80
  | 'whale'                          // Stakuje > 10K $TRUST
  | 'community_pillar'               // > 100 attestations
  | 'verified_identity'              // Przeszedł KYC/social verification

export type ExpertLevel =
  | 'newcomer'                       // Brak odznak
  | 'contributor'                    // 1-2 odznaki
  | 'expert'                         // 3-4 odznaki
  | 'master'                         // 5+ odznak
  | 'legend'                         // Wszystkie odznaki + top 1%

// Waga głosu eksperta przy attestations
export const EXPERT_WEIGHT: Record<ExpertLevel, number> = {
  newcomer: 1.0,
  contributor: 1.25,
  expert: 1.5,
  master: 2.0,
  legend: 3.0,
}
