/**
 * Attest Service — find-or-create-then-stake for skill attestations.
 * ──────────────────────────────────────────────────────────────────────────
 * Core data unit (AGENTSCORE_CORE_THESIS v1.0):
 *   [agent] — is skilled in — [canonical domain]  + staked position
 * Each position's wallet IS an attestation by that person.
 *
 * Orchestrates existing battle-tested write rails from `intuition.ts`
 * (createSimpleAtom / createTriple / depositToVault — all via FeeProxy,
 * explicit gas, slippage-guarded deposits). This module adds NO new
 * writeContract calls; it only plans, guards, and sequences.
 *
 * Paths (resolveAttestPlan → attestAgentSkill):
 *   1. triple exists            → deposit (stake) into its vault      [1 tx]
 *   2. triple missing           → createTriple with stake as deposit  [1 tx]
 *   3. domain/predicate missing → create atom(s) from deterministic
 *      registry payload, then createTriple with stake            [2–3 txs]
 *
 * SAFETY INVARIANTS:
 *   - ALL writes are signed by the user's connected wallet. No server keys.
 *   - Hard network guard: every entry point asserts chainId === Intuition
 *     TESTNET (13579) on BOTH clients before building any tx.
 *   - Existence checks are ON-CHAIN reads (isTermCreated), never the GraphQL
 *     indexer — fresh terms read correctly, so there is no retry-mint risk.
 *     Indexer lag only affects read-back UI ("pending indexing" note).
 *   - Atom payloads are verified against the registry term_id (pure hash)
 *     BEFORE any create tx is sent — a corrupted registry can never mint a
 *     stray atom.
 */

import { intuitionTestnet, MultiVaultAbi } from '@0xintuition/protocol'
import { stringToHex, type Hex, type PublicClient } from 'viem'
import { calculateAtomId as sdkCalculateAtomId } from '@0xintuition/sdk'
import {
  createSimpleAtom,
  createTriple,
  depositToVault,
  getFeeConfig,
  getFeeBreakdown,
  getMultiVaultAddress,
  isFeeProxyApproved,
  FEE_PROXY_ADDRESS,
  DEFAULT_ATOM_DEPOSIT,
  type WriteConfig,
} from './intuition'
import { IS_SKILLED_IN, type CanonicalDomainDef } from './canonical-domains'

// ─── Errors ──────────────────────────────────────────────────────────────────

export type AttestErrorCode =
  | 'WRONG_NETWORK'        // chainId !== Intuition Testnet — refused before any tx
  | 'WALLET_NOT_CONNECTED'
  | 'AGENT_NOT_FOUND'      // agent atom not on-chain (bad link / not registered)
  | 'INVALID_STAKE'
  | 'PAYLOAD_MISMATCH'     // registry payload does not hash to registry termId
  | 'USER_REJECTED'
  | 'INSUFFICIENT_FUNDS'
  | 'TX_FAILED'

/** Which write in the plan a TX_FAILED error came from. */
export type AttestStep = 'create_atom' | 'create_triple' | 'deposit'

export class AttestError extends Error {
  constructor(
    public readonly code: AttestErrorCode,
    message: string,
    public readonly step?: AttestStep,
  ) {
    super(message)
    this.name = 'AttestError'
  }
}

/**
 * The write rails (createSimpleAtom / createTriple) return a tx hash without
 * asserting receipt status — a reverted tx would otherwise surface as
 * success. Re-verify here for every rails call, uniformly, without touching
 * the rails themselves.
 */
async function assertTxSucceeded(
  publicClient: PublicClient,
  hash: `0x${string}`,
  step: AttestStep,
): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if ((receipt as { status?: string }).status !== 'success') {
    throw new AttestError('TX_FAILED', `Transaction reverted on-chain during ${step}.`, step)
  }
}

/** Map raw wallet/RPC errors to a clean, user-facing AttestError. */
export function mapWriteError(err: unknown): AttestError {
  if (err instanceof AttestError) return err
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return new AttestError('USER_REJECTED', 'Transaction rejected in wallet.')
  }
  if (lower.includes('insufficient funds') || lower.includes('exceeds the balance')) {
    return new AttestError('INSUFFICIENT_FUNDS', 'Insufficient tTRUST balance for stake + fees.')
  }
  return new AttestError('TX_FAILED', msg || 'Transaction failed')
}

// ─── Network guard ───────────────────────────────────────────────────────────

export const ATTEST_CHAIN_ID = intuitionTestnet.id // 13579

/**
 * Hard guard: refuse to build any transaction unless the chainId is the
 * Intuition TESTNET. Called with BOTH walletClient and publicClient chain ids.
 * `undefined` (unknown chain) is refused too — fail closed, not open.
 */
export function assertTestnet(chainId: number | undefined, source: string): void {
  if (chainId !== ATTEST_CHAIN_ID) {
    throw new AttestError(
      'WRONG_NETWORK',
      `Attestations are testnet-only. ${source} is on chain ${chainId ?? 'unknown'}, expected Intuition Testnet (${ATTEST_CHAIN_ID}).`
    )
  }
}

// ─── Plan resolution (read-only, no wallet needed) ───────────────────────────

export type AttestPath = 'deposit' | 'create_triple' | 'create_atoms_and_triple'

export interface AttestPlan {
  path: AttestPath
  /** Deterministic triple term_id (from MultiVault.calculateTripleId). */
  tripleId: `0x${string}`
  /** Registry atoms that must be minted first (domain and/or predicate). */
  missingAtoms: CanonicalDomainDef[]
}

/**
 * Resolve which path an attestation will take — pure on-chain reads
 * (no indexer, no lag, no tx). Also used by the UI for the honest
 * pre-signing cost preview.
 */
/** term_id shape: 0x + 64 hex chars (bytes32). */
const TERM_ID_RE = /^0x[0-9a-fA-F]{64}$/

export async function resolveAttestPlan(
  publicClient: PublicClient,
  agentTermId: `0x${string}`,
  domain: CanonicalDomainDef,
): Promise<AttestPlan> {
  assertTestnet(publicClient.chain?.id, 'RPC client')
  // agentTermId typically comes from a URL param — validate before any RPC call
  if (!TERM_ID_RE.test(agentTermId)) {
    throw new AttestError('AGENT_NOT_FOUND', `Invalid agent id "${agentTermId}" — expected a bytes32 term_id.`)
  }
  const mvAddress = getMultiVaultAddress(publicClient.chain?.id)

  const tripleId = await publicClient.readContract({
    address: mvAddress,
    abi: MultiVaultAbi,
    functionName: 'calculateTripleId',
    args: [agentTermId, IS_SKILLED_IN.termId, domain.termId],
  }) as `0x${string}`

  const isCreated = (id: `0x${string}`) =>
    publicClient.readContract({
      address: mvAddress,
      abi: MultiVaultAbi,
      functionName: 'isTermCreated',
      args: [id],
    }) as Promise<boolean>

  const [agentExists, tripleExists, domainExists, predicateExists] = await Promise.all([
    isCreated(agentTermId),
    isCreated(tripleId),
    isCreated(domain.termId),
    isCreated(IS_SKILLED_IN.termId),
  ])

  if (!agentExists) {
    throw new AttestError('AGENT_NOT_FOUND', 'Agent atom not found on-chain — is this agent registered on the testnet?')
  }

  if (tripleExists) {
    return { path: 'deposit', tripleId, missingAtoms: [] }
  }

  const missingAtoms: CanonicalDomainDef[] = []
  if (!domainExists) missingAtoms.push(domain)
  if (!predicateExists) missingAtoms.push(IS_SKILLED_IN) // never on current testnet (verified); belt & braces

  return {
    path: missingAtoms.length > 0 ? 'create_atoms_and_triple' : 'create_triple',
    tripleId,
    missingAtoms,
  }
}

// ─── Honest cost preview (displayed BEFORE signing = what is charged) ────────

/** Minimal read-only FeeProxy ABI for protocol creation costs. */
const FeeProxyCostAbi = [
  { name: 'getAtomCost',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getTripleCost', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const

export interface AttestCostPreview {
  /** The user's stake — what lands in the triple vault. */
  stakeWei: bigint
  /** Protocol creation costs + registry default deposits on new atoms (0 on deposit path). */
  creationCostWei: bigint
  /** Sum of FeeProxy fixed fees across all txs of the plan. */
  fixedFeeWei: bigint
  /** Sum of FeeProxy percentage fees (2.5% bps) across all txs of the plan. */
  percentageFeeWei: bigint
  /** Exactly what leaves the wallet (excl. gas): stake + creation + fees. */
  totalWei: bigint
  /** Number of transactions the user will sign (excl. one-time approval). */
  txCount: number
  /** True when this wallet has no cached FeeProxy DEPOSIT approval yet — an
   *  extra one-time approval transaction will be prompted before the first
   *  signature below. */
  approvalPending: boolean
}

/**
 * Compute the exact total the wallet will be charged for a plan, using the
 * SAME formulas the write path uses (getFeeBreakdown mirrors
 * calcFeeProxyValue: total = base * (10000 + bps)/10000 + fixedFee per tx).
 *
 * @param userAddress — optional; when given, flags `approvalPending` off the
 *   same cache `ensureFeeProxyApproved` reads (read-only, no logic change).
 */
export async function previewAttestCost(
  publicClient: PublicClient,
  plan: AttestPlan,
  stakeWei: bigint,
  userAddress?: `0x${string}`,
): Promise<AttestCostPreview> {
  assertTestnet(publicClient.chain?.id, 'RPC client')
  const fees = await getFeeConfig(publicClient)

  let creationCostWei = 0n
  let fixedFeeWei = 0n
  let percentageFeeWei = 0n
  let txCount = 0

  if (plan.path === 'deposit') {
    const b = getFeeBreakdown(stakeWei, fees)
    fixedFeeWei += b.fixedFee
    percentageFeeWei += b.percentageFee
    txCount = 1
  } else {
    const [atomCost, tripleCost] = await Promise.all([
      plan.missingAtoms.length > 0
        ? publicClient.readContract({ address: FEE_PROXY_ADDRESS, abi: FeeProxyCostAbi, functionName: 'getAtomCost' }) as Promise<bigint>
        : Promise.resolve(0n),
      publicClient.readContract({ address: FEE_PROXY_ADDRESS, abi: FeeProxyCostAbi, functionName: 'getTripleCost' }) as Promise<bigint>,
    ])

    // One createAtoms tx per missing atom (createSimpleAtom), each with the
    // registry default deposit — same base the write path charges fees on.
    for (let i = 0; i < plan.missingAtoms.length; i++) {
      const base = atomCost + DEFAULT_ATOM_DEPOSIT
      const b = getFeeBreakdown(base, fees)
      creationCostWei += base
      fixedFeeWei += b.fixedFee
      percentageFeeWei += b.percentageFee
      txCount++
    }

    // createTriples tx — the user's stake rides along as the triple deposit.
    const tripleBase = tripleCost + stakeWei
    const b = getFeeBreakdown(tripleBase, fees)
    creationCostWei += tripleCost
    fixedFeeWei += b.fixedFee
    percentageFeeWei += b.percentageFee
    txCount++
  }

  return {
    stakeWei,
    creationCostWei,
    fixedFeeWei,
    percentageFeeWei,
    totalWei: stakeWei + creationCostWei + fixedFeeWei + percentageFeeWei,
    txCount,
    approvalPending: userAddress ? !isFeeProxyApproved(userAddress) : false,
  }
}

// ─── Attest (write path — user wallet signs everything) ─────────────────────

export interface AttestResult {
  tripleId: `0x${string}`
  transactionHash: `0x${string}`
  path: AttestPath
}

/**
 * Execute an attestation: [agent] — is skilled in — [domain] + stake.
 * Find-or-create-then-stake; see module header for paths + invariants.
 */
export async function attestAgentSkill(
  config: WriteConfig,
  agentTermId: `0x${string}`,
  domain: CanonicalDomainDef,
  stakeWei: bigint,
  onProgress?: (step: string) => void,
): Promise<AttestResult> {
  // Guards — all BEFORE any tx is built
  if (!config.walletClient.account?.address) {
    throw new AttestError('WALLET_NOT_CONNECTED', 'Connect your wallet first.')
  }
  assertTestnet(config.walletClient.chain?.id, 'Wallet')
  assertTestnet(config.publicClient.chain?.id, 'RPC client')
  if (stakeWei <= 0n) {
    throw new AttestError('INVALID_STAKE', 'Stake amount must be greater than zero.')
  }

  onProgress?.('Checking on-chain state…')
  const plan = await resolveAttestPlan(config.publicClient, agentTermId, domain)

  try {
    if (plan.path === 'deposit') {
      // Triple exists — stake into its vault (FeeProxy, slippage-guarded).
      onProgress?.(`Staking on ${domain.label}…`)
      const { transactionHash } = await depositToVault(config, plan.tripleId, stakeWei)
      await assertTxSucceeded(config.publicClient, transactionHash, 'deposit')
      return { tripleId: plan.tripleId, transactionHash, path: plan.path }
    }

    // Create missing registry atoms first (domain and/or predicate).
    for (const atom of plan.missingAtoms) {
      // Determinism check — pure hash, no tx. Refuse rather than mint a stray atom.
      const computed = sdkCalculateAtomId(stringToHex(atom.payload) as Hex) as `0x${string}`
      if (computed !== atom.termId) {
        throw new AttestError(
          'PAYLOAD_MISMATCH',
          `Registry payload for "${atom.label}" hashes to ${computed}, expected ${atom.termId}. Refusing to mint.`
        )
      }
      onProgress?.(`Creating "${atom.label}" atom on testnet (one-time)…`)
      const result = await createSimpleAtom(config, atom.payload)
      if (result.termId !== atom.termId) {
        // Should be unreachable given the pre-check; fail loudly if rails drift.
        throw new AttestError('PAYLOAD_MISMATCH', `Minted term_id ${result.termId} != registry ${atom.termId} for "${atom.label}".`)
      }
      await assertTxSucceeded(config.publicClient, result.transactionHash, 'create_atom')
    }

    // Create the triple — the user's stake IS the triple deposit (1 tx).
    onProgress?.(`Attesting ${domain.label}…`)
    const { transactionHash } = await createTriple(
      config,
      agentTermId,
      IS_SKILLED_IN.termId,
      domain.termId,
      stakeWei,
    )
    await assertTxSucceeded(config.publicClient, transactionHash, 'create_triple')
    return { tripleId: plan.tripleId, transactionHash, path: plan.path }
  } catch (err) {
    throw mapWriteError(err)
  }
}
