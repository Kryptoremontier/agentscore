/**
 * Prints the transaction that changes the FeeProxy fee, for the fee admin to sign in their own
 * wallet (docs/FEE_CHANGE_RUNBOOK.md). It never reads, asks for or uses a private key, and it never
 * sends anything: it prints `to`, `value` and `data`, and with --check reads the current fee and
 * simulates the call from the admin wallet (eth_call — read-only).
 *
 *   node --experimental-strip-types scripts/fee-calldata.ts fixed 0            # the Beta change
 *   node --experimental-strip-types scripts/fee-calldata.ts undo               # back to 0.02 tTRUST
 *   node --experimental-strip-types scripts/fee-calldata.ts percentage 250
 *   ... add --check to read the current values and simulate first
 */

// A computed path: node strips the types at run time; the type-check doesn't follow it.
const lib = (await import(new URL('../src/lib/fee-admin.ts', import.meta.url).href)) as typeof import('../src/lib/fee-admin')
const RPC = process.env.INTUITION_RPC ?? 'https://testnet.rpc.intuition.systems/http'

const [what, raw] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const check = process.argv.includes('--check')
const call = what === 'fixed' && raw !== undefined ? lib.setFixedFeeCall(BigInt(raw))
  : what === 'undo' ? lib.setFixedFeeCall(lib.FIXED_FEE_BEFORE_BETA_WEI)
  : what === 'percentage' && raw !== undefined ? lib.setPercentageFeeCall(BigInt(raw))
  : null
if (!call) {
  console.error('Usage: fee-calldata.ts fixed <wei> | undo | percentage <bps> [--check]')
  process.exit(1)
}

console.log(`Sign this in the fee admin's wallet (${lib.FEE_ADMINS.adminWallet}), on Intuition Testnet (chain ${call.chainId}):`)
console.log(`  to:    ${call.to}`)
console.log(`  value: 0`)
console.log(`  data:  ${call.data}`)
console.log(`  (${call.signature}, selector ${lib.selectorOf(call.signature)})`)

if (check) {
  const rpc = async (method: string, params: unknown[]) => {
    const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
    return (await res.json()) as { result?: string; error?: { message: string; data?: string } }
  }
  const read = async (sig: string) => BigInt((await rpc('eth_call', [{ to: lib.FEE_PROXY, data: lib.selectorOf(sig) }, 'latest'])).result ?? '0x0')
  console.log(`\nNow: depositFixedFee = ${await read('depositFixedFee()')} wei, depositPercentageFee = ${await read('depositPercentageFee()')} (base 10,000)`)
  const sim = await rpc('eth_call', [{ from: lib.FEE_ADMINS.adminWallet, to: call.to, data: call.data }, 'latest'])
  console.log(sim.error ? `Simulation from the admin wallet REVERTS: ${sim.error.message} ${sim.error.data ?? ''}` : 'Simulation from the admin wallet: ok (nothing was sent)')
}
