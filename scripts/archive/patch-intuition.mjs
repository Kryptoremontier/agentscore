import { readFileSync, writeFileSync } from 'fs'

let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/lib/intuition.ts', 'utf8')

// ── CHANGE 1: Remove old hybrid comment, add createAtomViaProxy ──────────────
const OLD_COMMENT = `// createAtomViaProxy and createTripleViaProxy removed — hybrid model:
// Atom/Triple creation goes directly through SDK/MultiVault (user = creator).
// Only staking (depositToVault) routes through FeeProxy.`

const NEW_PROXY_HELPER = `/**
 * Internal helper: create a single Atom via FeeProxy (full model).
 * All write operations route through FeeProxy.
 * Returns { termId, transactionHash, state: { termId } }
 */
async function createAtomViaProxy(
  config: WriteConfig,
  atomText: string,
  depositAmount: bigint
): Promise<{ termId: \`0x\${string}\`; transactionHash: \`0x\${string}\`; state: { termId: \`0x\${string}\` } }> {
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
  }) as \`0x\${string}\`

  // Get protocol atom cost, then total including platform fee
  const atomCost = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'getAtomCost',
  }) as bigint

  const totalValue = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'getTotalCreationCost',
    args: [1n, depositAmount, atomCost],
  }) as bigint

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
}`

c = c.replace(OLD_COMMENT, NEW_PROXY_HELPER)

// ── CHANGE 2: createSimpleAtom ───────────────────────────────────────────────
c = c.replace(
`/**
 * Create simple text Atom via SDK (direct MultiVault — user is creator).
 */
export async function createSimpleAtom(
  config: WriteConfig,
  text: string,
  initialDeposit?: bigint
) {
  return await createAtomFromString(config, text, initialDeposit)
}`,
`/**
 * Create simple text Atom via FeeProxy.
 */
export async function createSimpleAtom(
  config: WriteConfig,
  text: string,
  initialDeposit?: bigint
) {
  return await createAtomViaProxy(config, text, initialDeposit ?? DEFAULT_ATOM_DEPOSIT)
}`
)

// ── CHANGE 3: createAccountAtom ──────────────────────────────────────────────
c = c.replace(
`/**
 * Create Atom from Ethereum account via SDK (direct MultiVault — user is creator).
 */
export async function createAccountAtom(
  config: WriteConfig,
  address: \`0x\${string}\`,
  initialDeposit?: bigint
) {
  return await createAtomFromEthereumAccount(config, address, initialDeposit)
}`,
`/**
 * Create Atom from Ethereum account via FeeProxy.
 * Atom data = lowercased address as UTF-8 bytes (Intuition URI format).
 */
export async function createAccountAtom(
  config: WriteConfig,
  address: \`0x\${string}\`,
  initialDeposit?: bigint
) {
  return await createAtomViaProxy(config, address.toLowerCase(), initialDeposit ?? DEFAULT_ATOM_DEPOSIT)
}`
)

// ── CHANGE 4: createAgentAtom ────────────────────────────────────────────────
c = c.replace(
`/**
 * Create Agent Atom with full metadata via SDK (direct MultiVault — user is creator).
 * No platform fee on registration; fees are collected on staking (depositToVault).
 */
export async function createAgentAtom(
  config: WriteConfig,
  metadata: AgentMetadata,
) {
  const atomText = \`\${APP_CONFIG.AGENT_PREFIX} \${metadata.name} - \${metadata.description}\`
  return await createAtomFromString(config, atomText, DEFAULT_ATOM_DEPOSIT)
}`,
`/**
 * Create Agent Atom with full metadata via FeeProxy.
 * Platform fee applies (collected on registration).
 */
export async function createAgentAtom(
  config: WriteConfig,
  metadata: AgentMetadata,
) {
  const atomText = \`\${APP_CONFIG.AGENT_PREFIX} \${metadata.name} - \${metadata.description}\`
  return await createAtomViaProxy(config, atomText, DEFAULT_ATOM_DEPOSIT)
}`
)

// ── CHANGE 5: createSkillAtom ────────────────────────────────────────────────
c = c.replace(
`/**
 * Create Skill Atom via SDK (direct MultiVault — user is creator).
 * Label format: "Skill: Name - description" (matches ILIKE 'Skill:%' filter)
 */
export async function createSkillAtom(
  config: WriteConfig,
  metadata: { name: string; description: string; category: string; compatibilities: string[]; requiresApiKey?: boolean; pricing?: string; githubUrl?: string; installCommand?: string },
) {
  const atomText = \`\${APP_CONFIG.SKILL_PREFIX} \${metadata.name} - \${metadata.description}\`
  return await createAtomFromString(config, atomText, DEFAULT_ATOM_DEPOSIT)
}`,
`/**
 * Create Skill Atom via FeeProxy.
 * Label format: "Skill: Name - description" (matches ILIKE 'Skill:%' filter)
 */
export async function createSkillAtom(
  config: WriteConfig,
  metadata: { name: string; description: string; category: string; compatibilities: string[]; requiresApiKey?: boolean; pricing?: string; githubUrl?: string; installCommand?: string },
) {
  const atomText = \`\${APP_CONFIG.SKILL_PREFIX} \${metadata.name} - \${metadata.description}\`
  return await createAtomViaProxy(config, atomText, DEFAULT_ATOM_DEPOSIT)
}`
)

// ── CHANGE 6: createTriple → via FeeProxy ───────────────────────────────────
c = c.replace(
`/**
 * Create Triple statement (subject-predicate-object) via direct MultiVault.
 * User is msg.sender — creator_id = user in Intuition indexer.
 */
export async function createTriple(
  config: WriteConfig,
  subjectId: \`0x\${string}\`,
  predicateId: \`0x\${string}\`,
  objectId: \`0x\${string}\`,
  depositAmount: bigint
) {
  const tripleCost = await config.publicClient.readContract({
    address: config.address,
    abi: MultiVaultAbi,
    functionName: 'getTripleCost',
  }) as bigint

  const totalValue = tripleCost + depositAmount

  const hash = await config.walletClient.writeContract({
    address: config.address,
    abi: MultiVaultAbi,
    functionName: 'createTriples',
    args: [
      [subjectId],
      [predicateId],
      [objectId],
      [depositAmount],
    ],
    value: totalValue,
    account: config.walletClient.account!,
    chain: config.walletClient.chain ?? intuitionTestnet,
  })

  await config.publicClient.waitForTransactionReceipt({ hash })
}`,
`/**
 * Create Triple statement (subject-predicate-object) via FeeProxy.
 * Platform fee applies. Receiver = msg.sender = user (shares go to user).
 */
export async function createTriple(
  config: WriteConfig,
  subjectId: \`0x\${string}\`,
  predicateId: \`0x\${string}\`,
  objectId: \`0x\${string}\`,
  depositAmount: bigint
) {
  await ensureFeeProxyApproved(config)

  const recipientAddress = config.walletClient.account?.address
  if (!recipientAddress) throw new Error('No account address available')

  // Get triple protocol cost and total including platform fee
  const tripleCost = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'getTripleCost',
  }) as bigint

  const totalValue = await config.publicClient.readContract({
    address: FEE_PROXY_ADDRESS,
    abi: FeeProxyAbi,
    functionName: 'getTotalCreationCost',
    args: [1n, depositAmount, tripleCost],
  }) as bigint

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
}`
)

// ── CHANGE 7: findOrCreateAtom → use createAtomViaProxy ─────────────────────
c = c.replace(
`  const atomResult = await createAtomFromString(cfg, label, parseEther('0.001'))
  return atomResult.state.termId as \`0x\${string}\``,
`  const atomResult = await createAtomViaProxy(cfg, label, parseEther('0.001'))
  return atomResult.termId`
)

writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/lib/intuition.ts', c)
console.log('All intuition.ts patches applied. Length:', c.length)
