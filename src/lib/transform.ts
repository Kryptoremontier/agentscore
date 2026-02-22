import type { Agent } from '@/types/agent'
import type { Attestation, AttestationPredicate } from '@/types/attestation'
import type { GraphQLAtom, GraphQLTriple } from './graphql'
import { calculateAgentTrustScore, countReportedTriples } from './trust-score-engine'

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

  // Calculate trust score using shared scoring engine
  const trust = calculateAgentTrustScore(atom)

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
    trustScore: trust.score,
    positiveStake: trust.supportStake,
    negativeStake: trust.opposeStake,
    attestationCount: atom.subjectTriples?.length || 0,
    reportCount: countReportedTriples(atom.subjectTriples),
    stakerCount: parseInt(atom.vault.positionCount || '0'),
    owner: {
      address: (atom.createdBy?.address || '0x0') as `0x${string}`,
      expertLevel: 'contributor', // TODO: Calculate from user's history
    },
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