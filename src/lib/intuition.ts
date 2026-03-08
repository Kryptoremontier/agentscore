/**
 * Intuition Protocol SDK Integration
 *
 * Real implementation using @0xintuition/sdk
 */

import {
  getAtomDetails,
  getTripleDetails,
  getMultiVaultAddressFromChainId,
} from '@0xintuition/sdk'
import { calculateBuy } from './bonding-curve'
import { type PublicClient, type WalletClient, parseEther, stringToHex } from 'viem'
import { intuitionTestnet, MultiVaultAbi } from '@0xintuition/protocol'
import { APP_CONFIG } from './app-config'
import { saveRegistration } from './registrant-store'
import {
  TRIPLE_SUBJECT_OR_STR,
  TRIPLE_OBJECT_OR_STR,
} from './gql-filters'

// ============================================================================
// Fee Proxy
// ============================================================================

/**
 * IntuitionFeeProxy deployed on Intuition Testnet.
 * Routes deposits through the proxy which collects platform fees atomically.
 */
export const FEE_PROXY_ADDRESS = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41' as const

// ============================================================================
// MultiVault Approval for FeeProxy
// ============================================================================

/**
 * MultiVault requires users to approve FeeProxy for DEPOSIT operations before
 * any FeeProxy-routed deposit/createAtoms/createTriples call.
 *
 * ApprovalTypes enum: NONE=0, DEPOSIT=1, REDEMPTION=2, BOTH=3
 *
 * We cache the approval in localStorage per wallet address so the user only
 * needs to sign once per browser/device.
 */
const LS_KEY_FEE_PROXY_APPROVED = 'agentscore_feeproxy_approved'

function isFeeProxyApproved(userAddress: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(`${LS_KEY_FEE_PROXY_APPROVED}_${userAddress.toLowerCase()}`) === '1'
}

function cacheFeeProxyApproved(userAddress: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${LS_KEY_FEE_PROXY_APPROVED}_${userAddress.toLowerCase()}`, '1')
  }
}

/**
 * Ensure user has approved FeeProxy for DEPOSIT on MultiVault.
 * Idempotent: no-op if already approved (cached in localStorage).
 * Must be called before any FeeProxy operation that involves deposits.
 */
export async function ensureFeeProxyApproved(config: WriteConfig): Promise<void> {
  const address = config.walletClient.account!.address
  if (isFeeProxyApproved(address)) return

  const hash = await config.walletClient.writeContract({
    address: config.address, // MultiVault
    abi: MultiVaultAbi,
    functionName: 'approve',
    args: [FEE_PROXY_ADDRESS, 1], // 1 = DEPOSIT approval
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

  await config.publicClient.waitForTransactionReceipt({ hash })
  cacheFeeProxyApproved(address)
}

// Fee config is read from the FeeProxy contract on-chain and cached per session.
// Fallback values are used only if the contract read fails.
const FALLBACK_FIXED_FEE = parseEther('0.1')
const FALLBACK_PERCENTAGE_BPS = 250n

let _feeConfigCache: { fixedFee: bigint; bps: bigint } | null = null

/**
 * Read fee configuration from the FeeProxy contract (cached per session).
 * Returns { fixedFee, bps } where bps is base-10000 (250 = 2.5%).
 */
export async function getFeeConfig(publicClient: PublicClient): Promise<{ fixedFee: bigint; bps: bigint }> {
  if (_feeConfigCache) return _feeConfigCache
  try {
    const [fixedFee, bps] = await Promise.all([
      publicClient.readContract({ address: FEE_PROXY_ADDRESS, abi: FeeProxyAbi, functionName: 'depositFixedFee' }) as Promise<bigint>,
      publicClient.readContract({ address: FEE_PROXY_ADDRESS, abi: FeeProxyAbi, functionName: 'depositPercentageFee' }) as Promise<bigint>,
    ])
    _feeConfigCache = { fixedFee, bps }
    return _feeConfigCache
  } catch (err) {
    console.warn('[getFeeConfig] Failed to read from contract, using fallback:', err)
    return { fixedFee: FALLBACK_FIXED_FEE, bps: FALLBACK_PERCENTAGE_BPS }
  }
}

/**
 * Calculate fee breakdown for a deposit amount.
 * Use this in UI to show the user what they'll pay.
 */
export function getFeeBreakdown(
  depositAmount: bigint,
  fees: { fixedFee: bigint; bps: bigint }
): { depositAmount: bigint; fixedFee: bigint; percentageFee: bigint; totalCost: bigint } {
  const percentageFee = (depositAmount * fees.bps) / 10000n
  return {
    depositAmount,
    fixedFee: fees.fixedFee,
    percentageFee,
    totalCost: depositAmount + percentageFee + fees.fixedFee,
  }
}

/** FeeProxy ABI — all write and fee-reading functions */
const FeeProxyAbi = [
  {
    name: 'createAtoms',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'data', type: 'bytes[]' },
      { name: 'assets', type: 'uint256[]' },
      { name: 'curveId', type: 'uint256' },
    ],
    outputs: [{ name: 'atomIds', type: 'bytes32[]' }],
  },
  {
    name: 'createTriples',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'subjectIds', type: 'bytes32[]' },
      { name: 'predicateIds', type: 'bytes32[]' },
      { name: 'objectIds', type: 'bytes32[]' },
      { name: 'assets', type: 'uint256[]' },
      { name: 'curveId', type: 'uint256' },
    ],
    outputs: [{ name: 'tripleIds', type: 'bytes32[]' }],
  },
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'termId', type: 'bytes32' },
      { name: 'curveId', type: 'uint256' },
      { name: 'minShares', type: 'uint256' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'depositFixedFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'depositPercentageFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getAtomCost',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTripleCost',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTotalCreationCost',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'depositCount', type: 'uint256' },
      { name: 'totalDeposit', type: 'uint256' },
      { name: 'multiVaultCost', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'calculateAtomId',
    type: 'function',
    stateMutability: 'pure',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

/**
 * Calculate total value to send to FeeProxy.deposit() so that exactly
 * `depositAmount` reaches MultiVault after fees are deducted.
 *
 * Formula (inverse of proxy's fee extraction):
 *   totalValue = depositAmount * (10000 + percentage) / 10000 + fixedFee
 */
function calcFeeProxyValue(depositAmount: bigint, fees: { fixedFee: bigint; bps: bigint }): bigint {
  return (depositAmount * (10000n + fees.bps)) / 10000n + fees.fixedFee
}

/**
 * Internal helper: create a single Atom via FeeProxy (full model).
 * All write operations route through FeeProxy.
 * Returns { termId, transactionHash, state: { termId } }
 */
async function createAtomViaProxy(
  config: WriteConfig,
  atomText: string,
  depositAmount: bigint
): Promise<{ termId: `0x${string}`; transactionHash: `0x${string}`; state: { termId: `0x${string}` } }> {
  await ensureFeeProxyApproved(config)

  const recipientAddress = config.walletClient.account?.address
  if (!recipientAddress) throw new Error('No account address available')

  // Encode atom text as UTF-8 bytes for FeeProxy
  const atomData = stringToHex(atomText)

  // Pre-compute termId deterministically (pure view — no gas, no tx needed)
  const termId = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'calculateAtomId',
    args: [atomData],
  }) as `0x${string}`

  // Get protocol atom cost — fee must be calculated on (atomCost + depositAmount),
  // because FeeProxy forwards (msg.value - fee) to MultiVault which needs both.
  const atomCost = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'getAtomCost',
  }) as bigint

  const baseCost = atomCost + depositAmount
  const fees = await getFeeConfig(config.publicClient)
  const totalValue = calcFeeProxyValue(baseCost, fees)

  console.log('createAtom fee debug:', {
    atomCost: atomCost.toString(),
    depositAmount: depositAmount.toString(),
    baseCost: baseCost.toString(),
    fixedFee: fees.fixedFee.toString(),
    bps: fees.bps.toString(),
    totalValue: totalValue.toString(),
  })

  const hash = await config.walletClient.writeContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'createAtoms',
    args: [recipientAddress, [atomData], [depositAmount], 1n],
    value: totalValue,
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

  await config.publicClient.waitForTransactionReceipt({ hash })
  return { termId, transactionHash: hash, state: { termId } }
}

// ============================================================================
// GraphQL API
// ============================================================================

const INTUITION_GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

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
 * Create simple text Atom via FeeProxy.
 */
export async function createSimpleAtom(
  config: WriteConfig,
  text: string,
  initialDeposit?: bigint
) {
  return await createAtomViaProxy(config, text, initialDeposit ?? DEFAULT_ATOM_DEPOSIT)
}

/**
 * Create Atom from Ethereum account via FeeProxy.
 * Atom data = lowercased address as UTF-8 bytes (Intuition URI format).
 */
export async function createAccountAtom(
  config: WriteConfig,
  address: `0x${string}`,
  initialDeposit?: bigint
) {
  return await createAtomViaProxy(config, address.toLowerCase(), initialDeposit ?? DEFAULT_ATOM_DEPOSIT)
}

/**
 * Create Agent Atom with full metadata via FeeProxy.
 * Platform fee applies (collected on registration).
 */
export async function createAgentAtom(
  config: WriteConfig,
  metadata: AgentMetadata,
) {
  const atomText = `${APP_CONFIG.AGENT_PREFIX} ${metadata.name} - ${metadata.description}`
  const result = await createAtomViaProxy(config, atomText, DEFAULT_ATOM_DEPOSIT)
  const userAddress = config.walletClient.account?.address
  if (userAddress) saveRegistration(result.termId, userAddress, 'agent')
  return result
}

/**
 * Create Skill Atom via FeeProxy.
 * Label format: "Skill: Name - description" (matches ILIKE 'Skill:%' filter)
 */
export async function createSkillAtom(
  config: WriteConfig,
  metadata: { name: string; description: string; category: string; compatibilities: string[]; requiresApiKey?: boolean; pricing?: string; githubUrl?: string; installCommand?: string },
) {
  const atomText = `${APP_CONFIG.SKILL_PREFIX} ${metadata.name} - ${metadata.description}`
  const result = await createAtomViaProxy(config, atomText, DEFAULT_ATOM_DEPOSIT)
  const userAddress = config.walletClient.account?.address
  if (userAddress) saveRegistration(result.termId, userAddress, 'skill')
  return result
}

// ============================================================================
// Triple Creation (Attestations)
// ============================================================================

/**
 * Create Triple statement (subject-predicate-object) via FeeProxy.
 * Platform fee applies. Receiver = msg.sender = user (shares go to user).
 */
export async function createTriple(
  config: WriteConfig,
  subjectId: `0x${string}`,
  predicateId: `0x${string}`,
  objectId: `0x${string}`,
  depositAmount: bigint
) {
  await ensureFeeProxyApproved(config)

  const recipientAddress = config.walletClient.account?.address
  if (!recipientAddress) throw new Error('No account address available')

  // Get triple protocol cost — fee on (tripleCost + depositAmount), same fix as createAtom
  const tripleCost = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'getTripleCost',
  }) as bigint

  const baseCost = tripleCost + depositAmount
  const fees = await getFeeConfig(config.publicClient)
  const totalValue = calcFeeProxyValue(baseCost, fees)

  console.log('createTriple fee debug:', {
    tripleCost: tripleCost.toString(),
    depositAmount: depositAmount.toString(),
    baseCost: baseCost.toString(),
    fixedFee: fees.fixedFee.toString(),
    bps: fees.bps.toString(),
    totalValue: totalValue.toString(),
  })

  const hash = await config.walletClient.writeContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'createTriples',
    args: [recipientAddress, [subjectId], [predicateId], [objectId], [depositAmount], 1n],
    value: totalValue,
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

  await config.publicClient.waitForTransactionReceipt({ hash })
  return { transactionHash: hash }
}

// ============================================================================
// Staking (Vault Operations)
// ============================================================================

/**
 * Deposit (stake) into a vault via FeeProxy.
 *
 * Routes through FeeProxy which collects platform fee atomically and forwards
 * the remaining amount to MultiVault with receiver = user (shares go to user).
 *
 * @param config - Write config
 * @param vaultId - Vault ID (Atom ID or Triple ID)
 * @param amount - Amount to deposit to MultiVault (in wei) — fee is added on top
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

  // Ensure user has approved FeeProxy for DEPOSIT on MultiVault (one-time)
  await ensureFeeProxyApproved(config)

  // Read fee config and calculate total value (deposit + fee)
  const fees = await getFeeConfig(config.publicClient)
  const totalValue = calcFeeProxyValue(amount, fees)

  // TODO: Slippage protection disabled — local bonding curve approximation diverges
  // from on-chain curve. Re-enable with on-chain quote when available.
  const minShares = 0n

  const hash = await config.walletClient.writeContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'deposit',
    args: [
      recipientAddress,
      vaultId,
      1n,  // curveId = 1 (default bonding curve)
      minShares,
    ],
    value: totalValue,
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

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
// App-Scoping — createdVia AgentScore
// ============================================================================

/**
 * Platform identity atoms for app-scoping.
 *
 * Priority order for loading the IDs (fastest to slowest):
 *  1. env vars NEXT_PUBLIC_AGENTSCORE_ATOM_ID / NEXT_PUBLIC_CREATED_VIA_ATOM_ID  (set once after first deploy)
 *  2. localStorage cache (persisted from previous session)
 *  3. GraphQL lookup (query — no tx cost if atoms exist)
 *  4. on-chain creation (only on very first ever bootstrap)
 *
 * After the first registration on a new testnet, open the browser console and
 * copy the logged IDs into .env.local to avoid bootstrap txs completely:
 *   NEXT_PUBLIC_AGENTSCORE_ATOM_ID=0x…
 *   NEXT_PUBLIC_CREATED_VIA_ATOM_ID=0x…
 */
const LS_KEY_AGENTSCORE = 'agentscore_platform_atom_id'
const LS_KEY_CREATED_VIA = 'agentscore_created_via_atom_id'

function loadFromCache(envKey: string, lsKey: string): string | null {
  // env var takes precedence (set by admin for production/stable testnet)
  const fromEnv = process.env[envKey]
  if (fromEnv) return fromEnv
  // fallback to localStorage (auto-populated after first bootstrap)
  if (typeof window !== 'undefined') {
    return localStorage.getItem(lsKey)
  }
  return null
}

export let AGENTSCORE_ATOM_TERM_ID: string | null = loadFromCache('NEXT_PUBLIC_AGENTSCORE_ATOM_ID', LS_KEY_AGENTSCORE)
export let CREATED_VIA_TERM_ID: string | null = loadFromCache('NEXT_PUBLIC_CREATED_VIA_ATOM_ID', LS_KEY_CREATED_VIA)

const AGENTSCORE_PLATFORM_LABEL = 'AgentScore'
const CREATED_VIA_PREDICATE_LABEL = 'createdVia'

/**
 * Bootstrap the platform identity atoms on Intuition.
 * Finds or creates "AgentScore" and "createdVia" atoms.
 * After resolving, caches IDs in localStorage and logs them to console.
 * Safe to call multiple times — idempotent.
 */
export async function bootstrapPlatformAtoms(cfg: WriteConfig): Promise<void> {
  if (!AGENTSCORE_ATOM_TERM_ID) {
    AGENTSCORE_ATOM_TERM_ID = await findOrCreateAtom(cfg, AGENTSCORE_PLATFORM_LABEL)
    if (AGENTSCORE_ATOM_TERM_ID && typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY_AGENTSCORE, AGENTSCORE_ATOM_TERM_ID)
      console.info('[AgentScore] AGENTSCORE_ATOM_TERM_ID resolved:', AGENTSCORE_ATOM_TERM_ID)
      console.info('  → Add to .env.local: NEXT_PUBLIC_AGENTSCORE_ATOM_ID=' + AGENTSCORE_ATOM_TERM_ID)
    }
  }
  if (!CREATED_VIA_TERM_ID) {
    CREATED_VIA_TERM_ID = await findOrCreateAtom(cfg, CREATED_VIA_PREDICATE_LABEL)
    if (CREATED_VIA_TERM_ID && typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY_CREATED_VIA, CREATED_VIA_TERM_ID)
      console.info('[AgentScore] CREATED_VIA_TERM_ID resolved:', CREATED_VIA_TERM_ID)
      console.info('  → Add to .env.local: NEXT_PUBLIC_CREATED_VIA_ATOM_ID=' + CREATED_VIA_TERM_ID)
    }
  }
}

/**
 * Tag a newly created atom or triple with [newTermId] — [createdVia] — [AgentScore].
 * Fire-and-forget — never throws or blocks the main creation flow.
 */
async function tagCreatedVia(cfg: WriteConfig, newTermId: string): Promise<void> {
  try {
    if (!AGENTSCORE_ATOM_TERM_ID || !CREATED_VIA_TERM_ID) {
      await bootstrapPlatformAtoms(cfg)
    }
    if (!AGENTSCORE_ATOM_TERM_ID || !CREATED_VIA_TERM_ID) return

    // Check if tag already exists
    const res = await fetch(INTUITION_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ triples(where: { subject_id: { _eq: "${newTermId}" }, predicate_id: { _eq: "${CREATED_VIA_TERM_ID}" }, object_id: { _eq: "${AGENTSCORE_ATOM_TERM_ID}" } }, limit: 1) { term_id } }`,
      }),
    })
    const data = await res.json()
    if (data.data?.triples?.length > 0) return // already tagged

    await createTriple(
      cfg,
      newTermId as `0x${string}`,
      CREATED_VIA_TERM_ID as `0x${string}`,
      AGENTSCORE_ATOM_TERM_ID as `0x${string}`,
      DEFAULT_ATOM_DEPOSIT
    )
  } catch (err) {
    console.warn('[tagCreatedVia] Failed to tag atom — continuing:', err)
  }
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
    if (triple) {
      const userAddress = cfg.walletClient.account?.address
      if (userAddress) saveRegistration(triple.termId, userAddress, 'claim')
      return triple
    }
  }
  throw new Error('Triple created on-chain but not yet indexed — please refresh in a few seconds')
}

// ============================================================================
// Claim Triples — [Agent/Skill] [predicate] [Agent/Skill]
// ============================================================================

/**
 * Create a Claim Triple: [Subject] [predicate atom] [Object]
 * Subject and Object must be existing atoms (agents or skills).
 * Predicate atom is found or created automatically.
 * The triple gets its own vault (Support + Oppose) identical to agents.
 */
export async function createTripleClaim(
  cfg: WriteConfig,
  subjectTermId: `0x${string}`,
  predicateLabel: string,
  objectTermId: `0x${string}`,
): Promise<{ termId: `0x${string}`; counterTermId: `0x${string}` }> {
  // 1. Find or create the predicate atom
  const predicateTermId = await findOrCreateAtom(cfg, predicateLabel)

  // Short delay for indexer
  await new Promise(r => setTimeout(r, 1500))

  // 2. Create the Triple
  const CLAIM_DEPOSIT = parseEther('0.01')
  await createTriple(cfg, subjectTermId, predicateTermId, objectTermId, CLAIM_DEPOSIT)

  // 3. Poll until indexed (typically 2–5s)
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 2500))
    const res = await fetch(INTUITION_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query FindClaimTriple($subjectId: String!, $predicateId: String!, $objectId: String!) {
            triples(
              where: {
                subject_id: { _eq: $subjectId }
                predicate_id: { _eq: $predicateId }
                object_id: { _eq: $objectId }
              }
              limit: 1
            ) { term_id counter_term_id }
          }
        `,
        variables: {
          subjectId: subjectTermId,
          predicateId: predicateTermId,
          objectId: objectTermId,
        },
      }),
    })
    const data = await res.json()
    const triple = data.data?.triples?.[0]
    if (triple?.term_id) {
      const userAddress = cfg.walletClient.account?.address
      if (userAddress) saveRegistration(triple.term_id, userAddress, 'claim')
      return {
        termId: triple.term_id as `0x${string}`,
        counterTermId: triple.counter_term_id as `0x${string}`,
      }
    }
  }
  throw new Error('Claim created on-chain but not yet indexed — please refresh in a few seconds')
}

/**
 * Fetch Claim Triples from Intuition GraphQL.
 * Returns triples where subject or object is an Agent/Skill atom,
 * excluding internal trust and report triples.
 */
export async function fetchTripleClaims(search = ''): Promise<any[]> {
  // Build optional search filter on subject/object label
  const searchFilter = search.trim()
    ? `, subject: { label: { _ilike: "%${search.trim()}%" } }`
    : ''

  const res = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query FetchClaims {
          triples(
            where: {
              _and: [
                {
                  ${TRIPLE_SUBJECT_OR_STR}
                }
                {
                  ${TRIPLE_OBJECT_OR_STR}
                }
              ]
              ${searchFilter}
            }
            order_by: { block_number: desc }
            limit: 50
          ) {
            term_id
            counter_term_id
            created_at
            subject { term_id label }
            predicate { term_id label }
            object { term_id label }
            creator { label id }
            positions_aggregate {
              aggregate { count sum { shares } }
            }
          }
        }
      `,
    }),
  })
  const data = await res.json()
  if (data.errors) {
    console.error('[fetchTripleClaims] GraphQL error:', data.errors[0]?.message)
    return []
  }
  return data.data?.triples ?? []
}

/**
 * Find an existing claim triple (by subject+predicate+object).
 */
export async function findClaimTriple(
  subjectTermId: string,
  predicateTermId: string,
  objectTermId: string,
): Promise<{ termId: `0x${string}`; counterTermId: `0x${string}` } | null> {
  const res = await fetch(INTUITION_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query FindClaimTriple($s: String!, $p: String!, $o: String!) {
          triples(
            where: {
              subject_id: { _eq: $s }
              predicate_id: { _eq: $p }
              object_id: { _eq: $o }
            }
            limit: 1
          ) { term_id counter_term_id }
        }
      `,
      variables: { s: subjectTermId, p: predicateTermId, o: objectTermId },
    }),
  })
  const data = await res.json()
  const triple = data.data?.triples?.[0]
  if (!triple) return null
  return {
    termId: triple.term_id as `0x${string}`,
    counterTermId: triple.counter_term_id as `0x${string}`,
  }
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

  const atomResult = await createAtomViaProxy(cfg, label, parseEther('0.001'))
  return atomResult.termId
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
