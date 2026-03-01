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
  multiVaultDeposit,
  multiVaultRedeem,
} from '@0xintuition/sdk'
import { type PublicClient, type WalletClient, parseEther } from 'viem'
import { intuitionTestnet, MultiVaultAbi } from '@0xintuition/protocol'

// ============================================================================
// GraphQL API
// ============================================================================

const INTUITION_GRAPHQL_URL = 'https://testnet.intuition.sh/v1/graphql'

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
 *
 * TEMPORARY: Using createAtomFromString to avoid IPFS requirement
 * TODO: Switch to createAtomFromThing once Pinata JWT is configured
 */
export async function createAgentAtom(
  config: WriteConfig,
  metadata: AgentMetadata,
  initialDeposit?: bigint
) {
  // For now, create a simple string atom with agent name
  // This avoids IPFS pinning requirement
  const atomText = `Agent: ${metadata.name} - ${metadata.description}`

  return await createAtomFromString(config, atomText, initialDeposit)

  /* TODO: Re-enable when Pinata JWT is configured in .env.local
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
  */
}

/**
 * Create Skill Atom
 *
 * Creates an on-chain Atom representing a reusable AI skill/capability.
 * Label format: "Skill: Name - description" (matches ILIKE 'Skill:%' filter)
 */
export async function createSkillAtom(
  config: WriteConfig,
  metadata: { name: string; description: string; category: string; compatibilities: string[] },
  initialDeposit?: bigint
) {
  const atomText = `Skill: ${metadata.name} - ${metadata.description}`
  return await createAtomFromString(config, atomText, initialDeposit)
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

  // Call MultiVault contract directly with value (msg.value)
  // SDK deposit() doesn't support sending value - we bypass it
  const hash = await config.walletClient.writeContract({
    address: config.address,
    abi: MultiVaultAbi,
    functionName: 'deposit',
    args: [
      recipientAddress,
      vaultId,
      1n,    // curveId = 1 (default bonding curve)
      0n,    // minShares = 0 (accept any amount)
    ],
    value: amount,  // THIS IS THE KEY - send tTRUST as transaction value
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

  // Wait for transaction receipt
  const receipt = await config.publicClient.waitForTransactionReceipt({ hash })

  return {
    transactionHash: hash,
    receipt,
  }
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

  // Call MultiVault contract directly
  const hash = await config.walletClient.writeContract({
    address: config.address,
    abi: MultiVaultAbi,
    functionName: 'redeem',
    args: [
      recipientAddress,
      vaultId,
      1n, // curveId = 1 (default curve)
      shares,
      0n, // minAssets = 0 (accept any amount)
    ],
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

  const receipt = await config.publicClient.waitForTransactionReceipt({ hash })

  return { transactionHash: hash, receipt }
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
 * Search the knowledge graph using direct GraphQL API
 */
export async function searchGraph(
  config: ReadConfig,
  query: string,
) {
  const response = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query SearchAtoms($label: String!) {
          atoms(
            where: { label: { _ilike: $label } }
            limit: 10
            order_by: { created_at: desc }
          ) {
            term_id
            label
            emoji
            type
            image
            created_at
            block_number
            creator_id
            creator {
              id
              label
            }
            positions_aggregate {
              aggregate {
                count
              }
            }
          }
        }
      `,
      variables: { label: `%${query}%` }
    })
  })

  if (!response.ok) throw new Error(`GraphQL error: ${response.statusText}`)
  const data = await response.json()
  if (data.errors) throw new Error(data.errors[0].message)
  return data.data.atoms
}

/**
 * Get atoms by creator address
 */
export async function getAtomsByCreator(address: string) {
  const response = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query GetAtomsByCreator($creator: String!) {
          atoms(
            where: { creator_id: { _ilike: $creator } }
            order_by: { created_at: desc }
          ) {
            term_id
            label
            emoji
            type
            created_at
            creator_id
            positions_aggregate {
              aggregate {
                count
                sum {
                  shares
                }
              }
            }
          }
        }
      `,
      variables: { creator: address.toLowerCase() }
    })
  })

  if (!response.ok) throw new Error(`GraphQL error: ${response.statusText}`)
  const data = await response.json()
  if (data.errors) throw new Error(data.errors[0].message)
  return data.data.atoms
}

/**
 * Get user's staking positions
 */
export async function getUserPositions(address: string) {
  const response = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query GetPositions($account: String!) {
          positions(
            where: { account_id: { _ilike: $account } }
            order_by: { updated_at: desc }
          ) {
            id
            shares
            updated_at
            account_id
            term_id
            vault {
              term_id
              total_shares
              position_count
            }
            term {
              atom {
                term_id
                label
                emoji
                type
              }
            }
          }
        }
      `,
      variables: { account: address.toLowerCase() }
    })
  })

  if (!response.ok) throw new Error(`GraphQL error: ${response.statusText}`)
  const data = await response.json()
  if (data.errors) throw new Error(data.errors[0].message)
  return data.data.positions
}

// ============================================================================
// Vault State (on-chain reads — bypasses indexer lag)
// ============================================================================

/**
 * Read total shares from MultiVault contract directly.
 *
 * getVault(termId, curveId) returns (totalAssets_wei, totalShares_wei).
 * totalShares is always the larger value (shares >> assets in wei for this
 * bonding curve which starts at 0.001 ETH/share).
 *
 * Returns shares in human-readable float (not wei).
 */
export async function getVaultSupply(
  publicClient: PublicClient,
  termId: string,
): Promise<number> {
  const address = getMultiVaultAddress(publicClient.chain?.id)
  const result = await publicClient.readContract({
    address,
    abi: MultiVaultAbi,
    functionName: 'getVault',
    args: [termId as `0x${string}`, 1n],
  }) as readonly [bigint, bigint]
  // Pick the larger value — that's totalShares (in wei)
  const totalSharesWei = result[0] > result[1] ? result[0] : result[1]
  return Number(totalSharesWei) / 1e18
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse tTRUST amount to wei
 */
export function parseStakeAmount(ethAmount: string): bigint {
  try {
    return parseEther(ethAmount)
  } catch {
    return BigInt(0)
  }
}

/**
 * Format wei to tTRUST string
 */
export function formatStakeAmount(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4)
}

// ============================================================================
// Trust/Distrust Actions
// ============================================================================

/**
 * TRUST an agent = deposit tTRUST into their vault = positive signal
 */
export async function trustAgent(
  config: WriteConfig,
  agentAtomId: `0x${string}`,
  amount: bigint
) {
  return await depositToVault(config, agentAtomId, amount)
}

/**
 * DISTRUST an agent = redeem shares from their vault = withdraw trust signal
 */
export async function distrustAgent(
  config: WriteConfig,
  agentAtomId: `0x${string}`,
  shares: bigint
) {
  return await redeemFromVault(config, agentAtomId, shares)
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
 * Default initial deposit for new Atoms (0.001 tTRUST)
 */
export const DEFAULT_ATOM_DEPOSIT = parseEther('0.001')

/**
 * Default stake amount (0.01 tTRUST)
 */
export const DEFAULT_STAKE_AMOUNT = parseEther('0.01')

// ============================================================================
// Trust Triple — FOR/AGAINST Vault Setup
// ============================================================================

/**
 * Canonical predicate/object atoms for AgentScore trust triples.
 * These already exist on Intuition testnet — no need to create them.
 *
 * Triple structure: [Agent] [is trustworthy] [AI Agent]
 *   - FOR vault  (term_id)         → Support/Trust signals
 *   - AGAINST vault (counter_term_id) → Oppose/Distrust signals
 */
export const TRUST_PREDICATE_TERM_ID =
  '0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba' as const
export const TRUST_OBJECT_TERM_ID =
  '0x4990eef19ea1d9b893c1802af9e2ec37fbc1ae138868959ebc23c98b1fc9565e' as const

/**
 * Look up an existing trust triple for a given agent atom.
 * Returns { termId, counterTermId } if found, null otherwise.
 * Read-only — no wallet required.
 */
export async function findTrustTriple(agentTermId: string): Promise<{
  termId: `0x${string}`
  counterTermId: `0x${string}`
} | null> {
  const res = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query FindTrustTriple($subjectId: String!, $predicateId: String!) {
          triples(
            where: {
              subject_id: { _eq: $subjectId }
              predicate_id: { _eq: $predicateId }
            }
            limit: 1
          ) {
            term_id
            counter_term_id
          }
        }
      `,
      variables: {
        subjectId: agentTermId,
        predicateId: TRUST_PREDICATE_TERM_ID,
      },
    }),
  })
  const data = await res.json()
  if (data.errors) {
    console.error('findTrustTriple error:', data.errors[0].message)
    return null
  }
  const triple = data.data?.triples?.[0]
  if (!triple) return null
  return {
    termId: triple.term_id as `0x${string}`,
    counterTermId: triple.counter_term_id as `0x${string}`,
  }
}

/**
 * Create the trust triple for an agent: [Agent] [is trustworthy] [AI Agent]
 * Requires wallet — one MetaMask confirmation.
 * Predicate and object atoms already exist on testnet (hardcoded term_ids).
 */
export async function createTrustTriple(
  agentTermId: `0x${string}`,
  cfg: WriteConfig
): Promise<{ termId: `0x${string}`; counterTermId: `0x${string}` }> {
  // Create the triple — predicate and object atoms already exist
  // Use 0.01 tTRUST: MultiVault requires minimum deposit above protocol fee threshold
  const TRIPLE_DEPOSIT = parseEther('0.01')
  await createTriple(
    cfg,
    agentTermId,
    TRUST_PREDICATE_TERM_ID as `0x${string}`,
    TRUST_OBJECT_TERM_ID as `0x${string}`,
    TRIPLE_DEPOSIT
  )

  // Poll GraphQL until triple is indexed (typically 2–5s)
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 2500))
    const triple = await findTrustTriple(agentTermId)
    if (triple) return triple
  }
  throw new Error('Triple created on-chain but not yet indexed — please refresh in a few seconds')
}

// ============================================================================
// Reports
// ============================================================================

export type ReportCategory = 'scam' | 'spam' | 'prompt_injection' | 'impersonation'

const REPORT_PREDICATE_LABELS: Record<ReportCategory, string> = {
  scam: 'reported_for_scam',
  spam: 'reported_for_spam',
  prompt_injection: 'reported_for_injection',
  impersonation: 'reported_for_impersonation',
}

/**
 * Find or create an atom for a given text label.
 * Returns the term_id.
 */
async function findOrCreateAtom(
  cfg: WriteConfig,
  label: string
): Promise<`0x${string}`> {
  const res = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{ atoms(where: { label: { _eq: "${label}" } }, limit: 1) { term_id } }`,
    }),
  })
  const data = await res.json()
  const existing = data?.data?.atoms?.[0]?.term_id
  if (existing) return existing as `0x${string}`

  const atomResult = await createAtomFromString(cfg, label, parseEther('0.001'))
  const termId = atomResult?.state?.termId
  if (!termId) {
    throw new Error(`Failed to create atom "${label}"`)
  }
  return termId as `0x${string}`
}

/**
 * Submit a report: [Agent] [reported_for_X] [reason text]
 * Creates predicate & object atoms if they don't exist, then the triple.
 */
export async function submitReport(
  agentTermId: `0x${string}`,
  category: ReportCategory,
  reason: string,
  cfg: WriteConfig
): Promise<void> {
  const predicateLabel = REPORT_PREDICATE_LABELS[category]
  const objectLabel = reason.trim() || `${category} report`

  const predicateTermId = await findOrCreateAtom(cfg, predicateLabel)

  // Short delay so indexer catches up
  await new Promise(r => setTimeout(r, 2000))

  const objectTermId = await findOrCreateAtom(cfg, objectLabel)

  await new Promise(r => setTimeout(r, 2000))

  const REPORT_DEPOSIT = parseEther('0.01')
  await createTriple(cfg, agentTermId, predicateTermId, objectTermId, REPORT_DEPOSIT)
}
