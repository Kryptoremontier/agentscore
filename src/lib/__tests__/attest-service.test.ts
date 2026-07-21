import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEther, type PublicClient, type WalletClient } from 'viem'

// Mock ONLY the write rails — pure helpers (getFeeBreakdown, constants) stay real,
// so fee-math tests exercise the same formulas the write path uses.
vi.mock('../intuition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../intuition')>()
  return {
    ...actual,
    createSimpleAtom: vi.fn(),
    createTriple: vi.fn(),
    depositToVault: vi.fn(),
    getFeeConfig: vi.fn(async () => ({ fixedFee: parseEther('0.02'), bps: 250n })),
  }
})

import {
  attestAgentSkill,
  resolveAttestPlan,
  previewAttestCost,
  assertTestnet,
  mapWriteError,
  AttestError,
  ATTEST_CHAIN_ID,
} from '../attest-service'
import {
  createSimpleAtom,
  createTriple,
  depositToVault,
  getFeeBreakdown,
  DEFAULT_ATOM_DEPOSIT,
  type WriteConfig,
} from '../intuition'
import { CANONICAL_DOMAINS_REGISTRY, IS_SKILLED_IN } from '../canonical-domains'

const DOMAIN = CANONICAL_DOMAINS_REGISTRY[0] // Crypto / Onchain
const AGENT_ID = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const TRIPLE_ID = '0x1111111111111111111111111111111111111111111111111111111111111111' as const
const ATOM_COST = parseEther('0.1')
const TRIPLE_COST = parseEther('0.2')
const STAKE = parseEther('1')

/** publicClient stub: chain 13579 + readContract driven by an existence map. */
function makePublicClient(exists: Record<string, boolean>, chainId: number = ATTEST_CHAIN_ID): PublicClient {
  return {
    chain: { id: chainId },
    readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName === 'calculateTripleId') return TRIPLE_ID
      if (functionName === 'isTermCreated') return !!exists[args![0] as string]
      if (functionName === 'getAtomCost') return ATOM_COST
      if (functionName === 'getTripleCost') return TRIPLE_COST
      throw new Error(`unexpected read: ${functionName}`)
    }),
    // Every rails write is re-verified via this — default all hashes to a
    // successful receipt; tests override per-hash to simulate a revert.
    waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
  } as unknown as PublicClient
}

function makeConfig(exists: Record<string, boolean>, opts: { walletChainId?: number; noAccount?: boolean } = {}): WriteConfig {
  return {
    walletClient: {
      account: opts.noAccount ? undefined : { address: '0xUser' },
      chain: { id: opts.walletChainId ?? ATTEST_CHAIN_ID },
    } as unknown as WalletClient,
    publicClient: makePublicClient(exists),
    address: '0xMultiVault' as `0x${string}`,
  }
}

/** All atoms of the happy paths exist. */
const ALL_EXIST = {
  [AGENT_ID]: true,
  [DOMAIN.termId]: true,
  [IS_SKILLED_IN.termId]: true,
  [TRIPLE_ID]: true,
}

beforeEach(() => {
  vi.mocked(depositToVault).mockReset().mockResolvedValue({ transactionHash: '0xdep', receipt: {} } as never)
  vi.mocked(createTriple).mockReset().mockResolvedValue({ transactionHash: '0xtri' } as never)
  vi.mocked(createSimpleAtom).mockReset().mockResolvedValue({ termId: DOMAIN.termId, transactionHash: '0xatm', state: { termId: DOMAIN.termId } } as never)
})

// ─── Path selection + execution ──────────────────────────────────────────────

describe('attestAgentSkill — three paths', () => {
  it('path 1: triple exists → deposit only', async () => {
    const cfg = makeConfig(ALL_EXIST)
    const res = await attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE)
    expect(res.path).toBe('deposit')
    expect(res.tripleId).toBe(TRIPLE_ID)
    expect(res.transactionHash).toBe('0xdep')
    expect(depositToVault).toHaveBeenCalledExactlyOnceWith(cfg, TRIPLE_ID, STAKE)
    expect(createTriple).not.toHaveBeenCalled()
    expect(createSimpleAtom).not.toHaveBeenCalled()
  })

  it('path 2: triple missing, atoms exist → createTriple with stake as deposit', async () => {
    const cfg = makeConfig({ ...ALL_EXIST, [TRIPLE_ID]: false })
    const res = await attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE)
    expect(res.path).toBe('create_triple')
    expect(res.transactionHash).toBe('0xtri')
    expect(createTriple).toHaveBeenCalledExactlyOnceWith(cfg, AGENT_ID, IS_SKILLED_IN.termId, DOMAIN.termId, STAKE)
    expect(createSimpleAtom).not.toHaveBeenCalled()
    expect(depositToVault).not.toHaveBeenCalled()
  })

  it('path 3: domain atom missing → create atom from registry payload, then triple', async () => {
    const cfg = makeConfig({ ...ALL_EXIST, [TRIPLE_ID]: false, [DOMAIN.termId]: false })
    const res = await attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE)
    expect(res.path).toBe('create_atoms_and_triple')
    expect(createSimpleAtom).toHaveBeenCalledExactlyOnceWith(cfg, DOMAIN.payload)
    expect(createTriple).toHaveBeenCalledExactlyOnceWith(cfg, AGENT_ID, IS_SKILLED_IN.termId, DOMAIN.termId, STAKE)
    expect(depositToVault).not.toHaveBeenCalled()
  })

  it('refuses to mint when a registry payload does not hash to its term_id', async () => {
    const tampered = { ...DOMAIN, payload: 'tampered bytes' }
    const cfg = makeConfig({ ...ALL_EXIST, [TRIPLE_ID]: false, [DOMAIN.termId]: false })
    await expect(attestAgentSkill(cfg, AGENT_ID, tampered, STAKE))
      .rejects.toMatchObject({ code: 'PAYLOAD_MISMATCH' })
    expect(createSimpleAtom).not.toHaveBeenCalled()
    expect(createTriple).not.toHaveBeenCalled()
  })
})

// ─── Guards ──────────────────────────────────────────────────────────────────

describe('attestAgentSkill — guards (fail closed, before any tx)', () => {
  const noWrites = () => {
    expect(depositToVault).not.toHaveBeenCalled()
    expect(createTriple).not.toHaveBeenCalled()
    expect(createSimpleAtom).not.toHaveBeenCalled()
  }

  it('rejects a non-testnet wallet chain (mainnet 1)', async () => {
    const cfg = makeConfig(ALL_EXIST, { walletChainId: 1 })
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'WRONG_NETWORK' })
    noWrites()
  })

  it('rejects an unknown (undefined) chain — fail closed', () => {
    expect(() => assertTestnet(undefined, 'Wallet')).toThrowError(AttestError)
    expect(() => assertTestnet(ATTEST_CHAIN_ID, 'Wallet')).not.toThrow()
    expect(ATTEST_CHAIN_ID).toBe(13579)
  })

  it('rejects a non-testnet RPC client', async () => {
    const cfg = makeConfig(ALL_EXIST)
    ;(cfg as { publicClient: PublicClient }).publicClient = makePublicClient(ALL_EXIST, 1)
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'WRONG_NETWORK' })
    noWrites()
  })

  it('rejects when no wallet account is connected', async () => {
    const cfg = makeConfig(ALL_EXIST, { noAccount: true })
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'WALLET_NOT_CONNECTED' })
    noWrites()
  })

  it('rejects a zero/negative stake', async () => {
    const cfg = makeConfig(ALL_EXIST)
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, 0n))
      .rejects.toMatchObject({ code: 'INVALID_STAKE' })
    noWrites()
  })

  it('agent atom missing on-chain → AGENT_NOT_FOUND (agent-id resolution)', async () => {
    const cfg = makeConfig({ ...ALL_EXIST, [AGENT_ID]: false })
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
    noWrites()
  })

  it('rejects a malformed agent id (URL param) before any RPC call', async () => {
    const cfg = makeConfig(ALL_EXIST)
    await expect(attestAgentSkill(cfg, 'not-a-term-id' as `0x${string}`, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
    expect(cfg.publicClient.readContract).not.toHaveBeenCalled()
    noWrites()
  })

  it('a reverted deposit tx surfaces as TX_FAILED, not success', async () => {
    const cfg = makeConfig(ALL_EXIST)
    vi.mocked(cfg.publicClient.waitForTransactionReceipt).mockResolvedValue({ status: 'reverted' } as never)
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'TX_FAILED', step: 'deposit' })
  })

  it('a reverted create_triple receipt surfaces as TX_FAILED with the step name, no success state', async () => {
    const cfg = makeConfig({ ...ALL_EXIST, [TRIPLE_ID]: false })
    vi.mocked(cfg.publicClient.waitForTransactionReceipt).mockImplementation(
      async ({ hash }: { hash: string }) =>
        (hash === '0xtri' ? { status: 'reverted' } : { status: 'success' }) as never
    )
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'TX_FAILED', step: 'create_triple' })
  })

  it('a reverted create_atom receipt in path 3 aborts before create_triple is called', async () => {
    const cfg = makeConfig({ ...ALL_EXIST, [TRIPLE_ID]: false, [DOMAIN.termId]: false })
    vi.mocked(cfg.publicClient.waitForTransactionReceipt).mockImplementation(
      async ({ hash }: { hash: string }) =>
        (hash === '0xatm' ? { status: 'reverted' } : { status: 'success' }) as never
    )
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'TX_FAILED', step: 'create_atom' })
    expect(createTriple).not.toHaveBeenCalled()
  })
})

// ─── Error surface ───────────────────────────────────────────────────────────

describe('error mapping — clean user-facing errors', () => {
  it('maps wallet rejection to USER_REJECTED', async () => {
    vi.mocked(depositToVault).mockRejectedValue(new Error('User rejected the request.'))
    const cfg = makeConfig(ALL_EXIST)
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'USER_REJECTED' })
  })

  it('maps insufficient balance to INSUFFICIENT_FUNDS', async () => {
    vi.mocked(createTriple).mockRejectedValue(new Error('insufficient funds for gas * price + value'))
    const cfg = makeConfig({ ...ALL_EXIST, [TRIPLE_ID]: false })
    await expect(attestAgentSkill(cfg, AGENT_ID, DOMAIN, STAKE))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
  })

  it('maps unknown failures to TX_FAILED, preserving the message', () => {
    const e = mapWriteError(new Error('execution reverted: something'))
    expect(e.code).toBe('TX_FAILED')
    expect(e.message).toContain('execution reverted')
  })
})

// ─── Plan resolution (read-only) ─────────────────────────────────────────────

describe('resolveAttestPlan', () => {
  it('computes the triple id on-chain and flags missing registry atoms', async () => {
    const pc = makePublicClient({ [AGENT_ID]: true, [IS_SKILLED_IN.termId]: true })
    const plan = await resolveAttestPlan(pc, AGENT_ID, DOMAIN)
    expect(plan).toEqual({
      path: 'create_atoms_and_triple',
      tripleId: TRIPLE_ID,
      missingAtoms: [DOMAIN],
    })
  })
})

// ─── Fee honesty: displayed = charged ────────────────────────────────────────

describe('previewAttestCost — displayed total equals what the write path charges', () => {
  const fees = { fixedFee: parseEther('0.02'), bps: 250n }

  it('deposit path: total = stake + 2.5% + fixed (same formula as calcFeeProxyValue)', async () => {
    const pc = makePublicClient(ALL_EXIST)
    const c = await previewAttestCost(pc, { path: 'deposit', tripleId: TRIPLE_ID, missingAtoms: [] }, STAKE)
    // The write path sends calcFeeProxyValue(stake) = stake*(10000+bps)/10000 + fixed
    const charged = (STAKE * (10000n + fees.bps)) / 10000n + fees.fixedFee
    expect(c.totalWei).toBe(charged)
    expect(c.totalWei).toBe(getFeeBreakdown(STAKE, fees).totalCost)
    expect(c.txCount).toBe(1)
  })

  it('create_triple path: total = charged value of createTriple(tripleCost + stake)', async () => {
    const pc = makePublicClient(ALL_EXIST)
    const c = await previewAttestCost(pc, { path: 'create_triple', tripleId: TRIPLE_ID, missingAtoms: [] }, STAKE)
    const base = TRIPLE_COST + STAKE
    const charged = (base * (10000n + fees.bps)) / 10000n + fees.fixedFee
    expect(c.totalWei).toBe(charged)
    expect(c.txCount).toBe(2 - 1) // one tx: createTriples
  })

  it('create_atoms_and_triple path: total = atom tx + triple tx charged values', async () => {
    const pc = makePublicClient(ALL_EXIST)
    const c = await previewAttestCost(
      pc,
      { path: 'create_atoms_and_triple', tripleId: TRIPLE_ID, missingAtoms: [DOMAIN] },
      STAKE,
    )
    const atomBase = ATOM_COST + DEFAULT_ATOM_DEPOSIT
    const atomCharged = (atomBase * (10000n + fees.bps)) / 10000n + fees.fixedFee
    const tripleBase = TRIPLE_COST + STAKE
    const tripleCharged = (tripleBase * (10000n + fees.bps)) / 10000n + fees.fixedFee
    expect(c.totalWei).toBe(atomCharged + tripleCharged)
    expect(c.txCount).toBe(2)
    // components add up exactly — nothing hidden
    expect(c.stakeWei + c.creationCostWei + c.fixedFeeWei + c.percentageFeeWei).toBe(c.totalWei)
  })

  it('refuses to preview on a wrong network', async () => {
    const pc = makePublicClient(ALL_EXIST, 1)
    await expect(previewAttestCost(pc, { path: 'deposit', tripleId: TRIPLE_ID, missingAtoms: [] }, STAKE))
      .rejects.toMatchObject({ code: 'WRONG_NETWORK' })
  })

  it('flags approvalPending when a wallet address is given and has no cached approval', async () => {
    const pc = makePublicClient(ALL_EXIST)
    const c = await previewAttestCost(pc, { path: 'deposit', tripleId: TRIPLE_ID, missingAtoms: [] }, STAKE, '0xUser')
    expect(c.approvalPending).toBe(true)
  })

  it('does not flag approvalPending when no wallet address is given', async () => {
    const pc = makePublicClient(ALL_EXIST)
    const c = await previewAttestCost(pc, { path: 'deposit', tripleId: TRIPLE_ID, missingAtoms: [] }, STAKE)
    expect(c.approvalPending).toBe(false)
  })
})
