/**
 * Intuition Protocol SDK Integration
 *
 * Real implementation using @0xintuition/sdk
 */

import {
  createAtomFromString,
  createAtomFromThing,
  createAtomFromEthereumAccount,
  createTripleStatement,
  deposit,
  redeem,
  getAtomDetails,
  getTripleDetails,
  globalSearch,
  getMultiVaultAddressFromChainId,
  type GlobalSearchOptions,
} from '@0xintuition/sdk'
import { type PublicClient, type WalletClient, parseEther } from 'viem'
import { intuitionTestnet } from '@0xintuition/protocol'

// ============================================================================
// Types
// ============================================================================

export interface AgentMetadata {
  name: string
  description: string
  category: string
  website?: string
  github?: string
  twitter?: string
  image?: string
  tags?: string[]
}

export interface WriteConfig {
  walletClient: WalletClient
  publicClient: PublicClient
  address: `0x${string}` // MultiVault address
}

export interface ReadConfig {
  publicClient: PublicClient
  address: `0x${string}` // MultiVault address
}

// ============================================================================
// Config Helpers
// ============================================================================

/**
 * Get MultiVault contract address for current chain
 */
export function getMultiVaultAddress(chainId: number = intuitionTestnet.id): `0x${string}` {
  return getMultiVaultAddressFromChainId(chainId)
}

/**
 * Create WriteConfig from clients
 */
export function createWriteConfig(
  walletClient: WalletClient,
  publicClient: PublicClient
): WriteConfig {
  const chainId = publicClient.chain?.id || intuitionTestnet.id
  return {
    walletClient,
    publicClient,
    address: getMultiVaultAddress(chainId),
  }
}

/**
 * Create ReadConfig from client
 */
export function createReadConfig(publicClient: PublicClient): ReadConfig {
  const chainId = publicClient.chain?.id || intuitionTestnet.id
  return {
    publicClient,
    address: getMultiVaultAddress(chainId),
  }
}

// ============================================================================
// Atom Creation
// ============================================================================

/**
 * Create simple text Atom
 */
export async function createSimpleAtom(
  config: WriteConfig,
  text: string,
  initialDeposit?: bigint
) {
  return await createAtomFromString(config, text, initialDeposit)
}

/**
 * Create Atom from Ethereum account
 */
export async function createAccountAtom(
  config: WriteConfig,
  address: `0x${string}`,
  initialDeposit?: bigint
) {
  return await createAtomFromEthereumAccount(config, address, initialDeposit)
}

/**
 * Create Agent Atom with full metadata
 */
export async function createAgentAtom(
  config: WriteConfig,
  metadata: AgentMetadata,
  initialDeposit?: bigint
) {
  // Prepare Thing object following schema.org SoftwareApplication
  const thing = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: metadata.name,
    description: metadata.description,
    applicationCategory: metadata.category,
    ...(metadata.website && { url: metadata.website }),
    ...(metadata.image && { image: metadata.image }),
    ...(metadata.tags && { keywords: metadata.tags.join(', ') }),
  }

  return await createAtomFromThing(config, thing, initialDeposit)
}

// ============================================================================
// Triple Creation (Attestations)
// ============================================================================

/**
 * Create Triple statement (subject-predicate-object)
 */
export async function createTriple(
  config: WriteConfig,
  subjectId: `0x${string}`,
  predicateId: `0x${string}`,
  objectId: `0x${string}`,
  depositAmount: bigint
) {
  return await createTripleStatement(config, {
    args: [
      [subjectId],
      [predicateId],
      [objectId],
      [depositAmount],
    ],
    value: depositAmount,
  })
}

// ============================================================================
// Staking (Vault Operations)
// ============================================================================

/**
 * Deposit (stake) into a vault
 *
 * @param config - Write config
 * @param vaultId - Vault ID (Atom ID or Triple ID)
 * @param amount - Amount to deposit (in wei)
 * @param recipient - Optional recipient address (defaults to sender)
 */
export async function depositToVault(
  config: WriteConfig,
  vaultId: `0x${string}`,
  amount: bigint,
  recipient?: `0x${string}`
) {
  const recipientAddress = recipient || config.walletClient.account?.address
  if (!recipientAddress) {
    throw new Error('No account address available')
  }

  // SDK deposit signature: (config, [receiver, termId, curveType, amount])
  return await deposit(config, [
    recipientAddress,
    vaultId,
    1n, // Curve type (1 = default bonding curve)
    amount,
  ])
}

/**
 * Redeem (unstake) from a vault
 *
 * @param config - Write config
 * @param vaultId - Vault ID (Atom ID or Triple ID)
 * @param shares - Number of shares to redeem
 * @param recipient - Optional recipient address (defaults to sender)
 */
export async function redeemFromVault(
  config: WriteConfig,
  vaultId: `0x${string}`,
  shares: bigint,
  recipient?: `0x${string}`
) {
  const recipientAddress = recipient || config.walletClient.account?.address
  if (!recipientAddress) {
    throw new Error('No account address available')
  }

  // SDK redeem signature: (config, [receiver, termId, curveType, shares, minAssets])
  return await redeem(config, [
    recipientAddress,
    vaultId,
    1n, // Curve type
    shares,
    0n, // Min assets (0 = accept any)
  ])
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get Atom details by ID
 */
export async function getAtom(
  config: ReadConfig,
  atomId: `0x${string}`
) {
  // SDK getAtomDetails only takes atomId string
  return await getAtomDetails(atomId)
}

/**
 * Get Triple details by ID
 */
export async function getTriple(
  config: ReadConfig,
  tripleId: `0x${string}`
) {
  // SDK getTripleDetails only takes tripleId string
  return await getTripleDetails(tripleId)
}

/**
 * Search the knowledge graph
 */
export async function searchGraph(
  config: ReadConfig,
  query: string,
  options?: GlobalSearchOptions
) {
  // SDK globalSearch signature: (query, options)
  return await globalSearch(query, options || {})
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse ETH amount to wei
 */
export function parseStakeAmount(ethAmount: string): bigint {
  try {
    return parseEther(ethAmount)
  } catch {
    return BigInt(0)
  }
}

/**
 * Format wei to ETH string
 */
export function formatStakeAmount(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4)
}

// ============================================================================
// Constants
// ============================================================================

export const INTUITION_TESTNET = {
  chainId: 13579,
  name: 'Intuition Testnet',
  rpcUrl: 'https://testnet.rpc.intuition.systems/http',
  explorer: 'https://testnet.explorer.intuition.systems',
  portal: 'https://testnet.portal.intuition.systems',
  hub: 'https://testnet.hub.intuition.systems',
}

/**
 * Default initial deposit for new Atoms (0.001 ETH)
 */
export const DEFAULT_ATOM_DEPOSIT = parseEther('0.001')

/**
 * Default stake amount (0.01 ETH)
 */
export const DEFAULT_STAKE_AMOUNT = parseEther('0.01')
