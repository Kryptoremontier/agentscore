/**
 * Debug SchemaTest-003 revert + wallet state. One-off, do not commit.
 * Run: $env:NODE_TLS_REJECT_UNAUTHORIZED='0'; node scripts/debug-schematest-003.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  formatEther,
  http,
  parseEther,
  stringToHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { intuitionTestnet, MultiVaultAbi } from '@0xintuition/protocol'
import { calculateAtomId as sdkCalculateAtomId } from '@0xintuition/sdk'
import { getMultiVaultAddressFromChainId } from '@0xintuition/sdk'

const FEE_PROXY = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41'
const ATOMS_TX = '0x0dbebd971bc1f0b70940ab33ea2583f76bcc5a85cacf75e381ae2d44b0212c38'
const TRIPLES_TX = '0xc7518264053dc745c2a1b8ae2f917aa365dc47be72a3cc089ddc0096761a3b5f'
const WALLET = '0x37bA9912A1Dd7D39e25673Eb125911379F117358'

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
    name: 'depositFixedFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'depositPercentageFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  { name: 'getAtomCost', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getTripleCost', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]

const MultiVaultApprovalAbi = [
  {
    name: 'isApproved',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
      { name: 'approvalType', type: 'uint8' },
    ],
    outputs: [{ type: 'bool' }],
  },
]

function loadEnv() {
  for (const name of ['.env.local', '.env.test-wallet.local']) {
    const p = join(process.cwd(), name)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq < 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  }
}

function calcBatchCreationValue(protocolCostPerItem, count, deposits, fees) {
  const totalDeposit = deposits.reduce((a, b) => a + b, 0n)
  const depositCount = BigInt(deposits.filter(d => d > 0n).length)
  const multiVaultCost = protocolCostPerItem * count + totalDeposit
  const fee = fees.fixedFee * depositCount + (totalDeposit * fees.bps) / 10000n
  return multiVaultCost + fee
}

loadEnv()
const rpc = process.env.NEXT_PUBLIC_INTUITION_RPC_URL ?? 'https://testnet.rpc.intuition.systems/http'
const pc = createPublicClient({ chain: intuitionTestnet, transport: http(rpc) })
const mv = getMultiVaultAddressFromChainId(13579)

console.log('\n=== 1. Receipts ===')
for (const [label, hash] of [
  ['createAtoms', ATOMS_TX],
  ['createTriples', TRIPLES_TX],
]) {
  const r = await pc.getTransactionReceipt({ hash })
  console.log(`${label}: status=${r.status} block=${r.blockNumber} logs=${r.logs.length} gasUsed=${r.gasUsed}`)
}

console.log('\n=== 2. Decode reverted createAtoms tx ===')
const tx = await pc.getTransaction({ hash: ATOMS_TX })
console.log('from:', tx.from)
console.log('value (ETH):', formatEther(tx.value))
console.log('gas:', tx.gas?.toString())
let decoded
try {
  decoded = decodeFunctionData({ abi: FeeProxyAbi, data: tx.input })
  console.log('function:', decoded.functionName)
  console.log('receiver:', decoded.args[0])
  console.log('data count:', decoded.args[1].length)
  console.log('assets:', decoded.args[2].map(a => formatEther(a)))
  console.log('curveId:', decoded.args[3]?.toString())
  for (let i = 0; i < decoded.args[1].length; i++) {
    const hex = decoded.args[1][i]
    const text = Buffer.from(hex.slice(2), 'hex').toString('utf8').slice(0, 120)
    console.log(`  atom[${i}] preview:`, text)
  }
} catch (e) {
  console.log('decode failed:', e.message)
}

console.log('\n=== 3. Wallet state ===')
const balance = await pc.getBalance({ address: WALLET })
console.log('native balance:', formatEther(balance), 'tTRUST')

const approved = await pc.readContract({
  address: mv,
  abi: MultiVaultApprovalAbi,
  functionName: 'isApproved',
  args: [WALLET, FEE_PROXY, 1],
})
console.log('FeeProxy DEPOSIT approved:', approved)

const [atomCost, tripleCost, fixedFee, bps] = await Promise.all([
  pc.readContract({ address: FEE_PROXY, abi: FeeProxyAbi, functionName: 'getAtomCost' }),
  pc.readContract({ address: FEE_PROXY, abi: FeeProxyAbi, functionName: 'getTripleCost' }),
  pc.readContract({ address: FEE_PROXY, abi: FeeProxyAbi, functionName: 'depositFixedFee' }),
  pc.readContract({ address: FEE_PROXY, abi: FeeProxyAbi, functionName: 'depositPercentageFee' }),
])
const fees = { fixedFee, bps }
const deposit = parseEther('0.001')
console.log('atomCost:', formatEther(atomCost), 'tripleCost:', formatEther(tripleCost))
console.log('fixedFee:', formatEther(fixedFee), 'bps:', bps.toString())

if (decoded) {
  const sentValue = tx.value
  const recomputed = calcBatchCreationValue(
    atomCost,
    BigInt(decoded.args[1].length),
    decoded.args[2],
    fees,
  )
  console.log('\n=== 4. Value check (atoms batch) ===')
  console.log('tx.value sent:     ', formatEther(sentValue))
  console.log('calcBatch expected:', formatEther(recomputed))
  console.log('delta (sent - exp):', formatEther(sentValue - recomputed))
  console.log('balance >= sent?', balance >= sentValue)
}

console.log('\n=== 5. Simulate createAtoms at tx block (revert reason) ===')
if (decoded) {
  try {
    await pc.simulateContract({
      address: FEE_PROXY,
      abi: FeeProxyAbi,
      functionName: 'createAtoms',
      args: decoded.args,
      value: tx.value,
      account: tx.from,
      blockNumber: tx.blockNumber,
    })
    console.log('simulate: SUCCESS (unexpected)')
  } catch (e) {
    console.log('simulate REVERT:')
    console.log('  shortMessage:', e.shortMessage)
    console.log('  message:', e.message?.slice(0, 500))
    if (e.cause?.reason) console.log('  cause.reason:', e.cause.reason)
    if (e.cause?.data) console.log('  cause.data:', e.cause.data)
  }
}

console.log('\n=== 6. debug_traceTransaction (optional) ===')
try {
  const trace = await pc.request({
    method: 'debug_traceTransaction',
    params: [ATOMS_TX, { tracer: 'callTracer' }],
  })
  const failed = JSON.stringify(trace).includes('"error"')
  console.log('trace available, contains error:', failed)
  if (failed) {
    const m = JSON.stringify(trace).match(/"error":"([^"]+)"/)
    if (m) console.log('trace error snippet:', m[1])
  }
} catch (e) {
  console.log('debug_trace not supported:', e.message?.slice(0, 120))
}

console.log('\n=== 7. isTermCreated for SchemaTest-003 termId ===')
const payload = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Thing',
  name: 'SchemaTest-003',
  description:
    'Full metadata registration test. Verifies schema.org Thing format, triple creation for endpoints/social, and effectiveLabel() data path.',
})
const termId = sdkCalculateAtomId(stringToHex(payload))
const exists = await pc.readContract({
  address: mv,
  abi: MultiVaultAbi,
  functionName: 'isTermCreated',
  args: [termId],
})
console.log('termId:', termId)
console.log('isTermCreated:', exists)

console.log('\nDone.\n')
