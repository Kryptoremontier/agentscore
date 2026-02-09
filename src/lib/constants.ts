// Atom IDs for predicates (to be filled after creation on testnet)
export const PREDICATE_ATOMS = {
  trusts: BigInt(0),              // [trusts] predicate
  distrusts: BigInt(0),           // [distrusts] predicate
  reported_for_scam: BigInt(0),
  reported_for_spam: BigInt(0),
  reported_for_injection: BigInt(0),
  verified_by: BigInt(0),
  is: BigInt(0),                  // Generic [is] predicate
  has_tag: BigInt(0),             // [has_tag] predicate
} as const

// Object Atoms
export const OBJECT_ATOMS = {
  trustworthy: BigInt(0),
  scammer: BigInt(0),
  verified_developer: BigInt(0),
  ai_agent: BigInt(0),            // Category atom
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