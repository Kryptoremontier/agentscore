import type { Agent } from '@/types/agent'
import type { Attestation, AttestationPredicate } from '@/types/attestation'
import type { GraphQLAtom, GraphQLTriple } from './graphql'

// Transform GraphQL atom to Agent type
export function transformAtomToAgent(atom: GraphQLAtom): Agent {
  // Parse atomData if it's JSON
  let parsedData: any = {}
  try {
    parsedData = JSON.parse(atom.atomData)
  } catch {
    // If not JSON, use as is
    parsedData = { description: atom.atomData }
  }

  // Calculate trust score from attestations
  const trustScore = calculateTrustScore(atom)

  // Extract platform from atomData or default
  const platform = parsedData.platform || 'custom'

  return {
    id: atom.id,
    atomId: BigInt(atom.atomId),
    name: atom.label || parsedData.name || 'Unnamed Agent',
    description: parsedData.description || null,
    platform,
    walletAddress: parsedData.walletAddress || atom.createdBy?.address || null,
    createdAt: new Date(atom.createdAt),
    verificationLevel: determineVerificationLevel(atom, parsedData),
    trustScore,
    positiveStake: calculatePositiveStake(atom),
    negativeStake: calculateNegativeStake(atom),
    attestationCount: atom.subjectTriples?.length || 0,
    reportCount: countReports(atom),
    stakerCount: parseInt(atom.vault.positionCount || '0'),
  }
}

// Transform GraphQL triple to Attestation type
export function transformTripleToAttestation(triple: GraphQLTriple): Attestation {
  const latestPosition = triple.vault.positions?.[0]

  return {
    id: triple.id,
    tripleId: BigInt(triple.tripleId || triple.id),
    subject: {
      id: triple.subject.id,
      name: triple.subject.label,
      type: 'agent', // Could be determined from atomData
    },
    predicate: mapPredicateLabel(triple.predicate.label),
    object: {
      id: triple.object.id,
      label: triple.object.label,
    },
    staker: {
      address: (latestPosition?.user.address || triple.createdBy?.address || '0x0') as `0x${string}`,
      name: undefined, // Could be resolved separately
    },
    stakeAmount: BigInt(latestPosition?.shares || triple.vault.totalShares || '0'),
    createdAt: new Date(triple.createdAt),
    transactionHash: `0x${triple.id}` as `0x${string}`, // Mock - real tx hash would come from chain
  }
}

// Helper functions

function calculateTrustScore(atom: GraphQLAtom): number {
  if (!atom.subjectTriples || atom.subjectTriples.length === 0) {
    return 50 // Default score for new agents
  }

  let positiveWeight = 0
  let negativeWeight = 0

  atom.subjectTriples.forEach(triple => {
    const stake = BigInt(triple.vault.totalShares || '0')
    const weight = Number(stake) / 1e18

    if (isPositivePredicate(triple.predicate.label)) {
      positiveWeight += weight
    } else if (isNegativePredicate(triple.predicate.label)) {
      negativeWeight += weight
    }
  })

  const total = positiveWeight + negativeWeight
  if (total === 0) return 50

  const score = (positiveWeight / total) * 100
  return Math.round(Math.max(0, Math.min(100, score)))
}

function calculatePositiveStake(atom: GraphQLAtom): bigint {
  if (!atom.subjectTriples) return BigInt(0)

  return atom.subjectTriples
    .filter(triple => isPositivePredicate(triple.predicate.label))
    .reduce((sum, triple) => sum + BigInt(triple.vault.totalShares || '0'), BigInt(0))
}

function calculateNegativeStake(atom: GraphQLAtom): bigint {
  if (!atom.subjectTriples) return BigInt(0)

  return atom.subjectTriples
    .filter(triple => isNegativePredicate(triple.predicate.label))
    .reduce((sum, triple) => sum + BigInt(triple.vault.totalShares || '0'), BigInt(0))
}

function countReports(atom: GraphQLAtom): number {
  if (!atom.subjectTriples) return 0

  return atom.subjectTriples.filter(triple =>
    triple.predicate.label.includes('reported')
  ).length
}

function determineVerificationLevel(atom: GraphQLAtom, parsedData: any): 'none' | 'wallet' | 'social' | 'kyc' {
  // Check for verification attestations
  const hasWallet = !!parsedData.walletAddress || !!atom.createdBy?.address
  const hasVerification = atom.subjectTriples?.some(triple =>
    triple.predicate.label === 'verified_by'
  )

  if (hasVerification) return 'kyc' // Simplified - would check actual verifier
  if (hasWallet) return 'wallet'
  return 'none'
}

function isPositivePredicate(label: string): boolean {
  return ['trusts', 'verified_by', 'vouches_for'].includes(label)
}

function isNegativePredicate(label: string): boolean {
  return ['distrusts', 'reported_for_scam', 'reported_for_spam', 'reported_for_injection'].includes(label)
}

function mapPredicateLabel(label: string): AttestationPredicate {
  const mapping: Record<string, AttestationPredicate> = {
    'trusts': 'trusts',
    'distrusts': 'distrusts',
    'reported_for_scam': 'reported_for_scam',
    'reported_for_spam': 'reported_for_spam',
    'reported_for_injection': 'reported_for_injection',
    'verified_by': 'verified_by',
    'vouches_for': 'vouches_for',
  }

  return mapping[label] || 'trusts' // Default fallback
}