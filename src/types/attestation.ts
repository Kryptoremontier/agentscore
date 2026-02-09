import type { ExpertLevel } from './user'

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
    expertLevel?: ExpertLevel
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