/**
 * Adapter for converting Intuition Protocol data to AgentScore types
 */

import type { Agent, AgentCategory, AgentPlatform, VerificationLevel } from '@/types/agent'
import type { ExpertLevel } from '@/types/user'

// ============================================================================
// Type Definitions (based on SDK - adjust after testing)
// ============================================================================

export interface IntuitionAtomDetails {
  id: bigint
  vaultId: bigint
  creator: `0x${string}`
  data?: {
    '@type'?: string
    name?: string
    description?: string
    applicationCategory?: string
    url?: string
    image?: string
    author?: {
      name?: string
    }
  }
  vault?: {
    totalShares: bigint
    currentSharePrice: bigint
    totalAssets: bigint
    positionCount: number
  }
  // Additional fields from SDK (to be verified)
  metadata?: any
  uri?: string
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert Intuition Atom to Agent type
 */
export function atomToAgent(atom: IntuitionAtomDetails): Agent {
  // Extract metadata from Thing object or fallback to defaults
  const name = atom.data?.name || `Agent #${atom.id.toString()}`
  const description = atom.data?.description || null
  const category = parseCategory(atom.data?.applicationCategory)
  const platform = parsePlatform(atom.data)

  // Calculate trust score from vault data
  const trustScore = calculateTrustScore(atom.vault)

  // Parse stakes
  const positiveStake = atom.vault?.totalAssets || BigInt(0)
  const negativeStake = BigInt(0) // TODO: Get from counter-triple

  return {
    id: atom.id.toString(),
    atomId: atom.id,
    name,
    description,
    platform,
    walletAddress: atom.creator,
    createdAt: new Date(), // TODO: Get from blockchain timestamp
    verificationLevel: 'wallet', // TODO: Determine from attestations
    category,
    avatar: atom.data?.image,
    owner: {
      address: atom.creator,
      name: atom.data?.author?.name,
      expertLevel: 'contributor' as ExpertLevel, // TODO: Calculate from user's history
    },
    trustScore,
    positiveStake,
    negativeStake,
    attestationCount: 0, // TODO: Count triples where this is subject
    reportCount: 0, // TODO: Count negative attestations
    stakerCount: atom.vault?.positionCount || 0,
  }
}

/**
 * Convert array of Atoms to Agents
 */
export function atomsToAgents(atoms: IntuitionAtomDetails[]): Agent[] {
  return atoms.map(atomToAgent)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse category from metadata
 */
function parseCategory(categoryStr?: string): AgentCategory {
  if (!categoryStr) return 'other'

  const normalized = categoryStr.toLowerCase()

  const categoryMap: Record<string, AgentCategory> = {
    'coding': 'coding',
    'code': 'coding',
    'programming': 'coding',
    'writing': 'writing',
    'content': 'writing',
    'data': 'data',
    'analytics': 'data',
    'trading': 'trading',
    'finance': 'trading',
    'social': 'social',
    'socialmedia': 'social',
    'gaming': 'gaming',
    'game': 'gaming',
    'defi': 'defi',
    'nft': 'nft',
    'research': 'research',
    'customerservice': 'customer_service',
    'support': 'customer_service',
  }

  return categoryMap[normalized] || 'other'
}

/**
 * Parse platform from metadata
 */
function parsePlatform(data?: IntuitionAtomDetails['data']): AgentPlatform {
  // Try to infer from URL or metadata
  const url = data?.url?.toLowerCase() || ''

  if (url.includes('moltbook')) return 'moltbook'
  if (url.includes('openclaw')) return 'openclaw'
  if (url.includes('farcaster') || url.includes('warpcast')) return 'farcaster'
  if (url.includes('twitter') || url.includes('x.com')) return 'twitter'

  return 'custom'
}

/**
 * Calculate trust score from vault data
 *
 * Simple formula: higher TVL and more stakers = higher score
 * TODO: Refine this based on actual trust calculation model
 */
function calculateTrustScore(vault?: IntuitionAtomDetails['vault']): number {
  if (!vault) return 0

  const { totalAssets, positionCount, currentSharePrice } = vault

  // Simple heuristic (to be refined):
  // - Base score from TVL (0-70 points)
  // - Bonus from number of stakers (0-20 points)
  // - Bonus from share price (0-10 points)

  const tvlScore = Math.min(70, Number(totalAssets) / 1e18 * 10)
  const stakersScore = Math.min(20, positionCount * 2)
  const priceScore = Math.min(10, Number(currentSharePrice) / 1e18 * 5)

  return Math.round(tvlScore + stakersScore + priceScore)
}

/**
 * Determine verification level from attestations
 * TODO: Implement based on actual attestation data
 */
export function calculateVerificationLevel(
  hasWallet: boolean,
  hasSocialAttestation: boolean,
  hasKYC: boolean
): VerificationLevel {
  if (hasKYC) return 'kyc'
  if (hasSocialAttestation) return 'social'
  if (hasWallet) return 'wallet'
  return 'none'
}

// ============================================================================
// Mock data adapter (for testing before Intuition integration)
// ============================================================================

/**
 * Create mock Intuition Atom for testing
 */
export function createMockAtom(index: number): IntuitionAtomDetails {
  const categories = ['coding', 'writing', 'data', 'trading', 'social', 'gaming', 'defi', 'nft', 'research', 'customer_service', 'other']

  return {
    id: BigInt(index),
    vaultId: BigInt(index * 1000),
    creator: `0x${index.toString(16).padStart(40, '0')}` as `0x${string}`,
    data: {
      '@type': 'SoftwareApplication',
      name: `Agent ${index}`,
      description: `AI agent specialized in ${categories[index % categories.length]}`,
      applicationCategory: categories[index % categories.length],
      url: 'https://example.com',
      image: undefined,
      author: {
        name: `User ${index}`,
      },
    },
    vault: {
      totalShares: BigInt(Math.floor(Math.random() * 1000000)),
      currentSharePrice: BigInt(1e18), // 1.0
      totalAssets: BigInt(Math.floor(Math.random() * 1000000)),
      positionCount: Math.floor(Math.random() * 200),
    },
  }
}
