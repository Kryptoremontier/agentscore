/**
 * A wallet for the harness (Etap 9b: the trust dialog's states). Test-side only.
 *
 * An EIP-1193 provider injected into the page: it answers its account and Intuition Testnet's chain
 * id, and refuses every signature or transaction (user rejected, code 4001). No key exists anywhere.
 * The app's own reads go to the real testnet RPC (the fee is read live from the FeeProxy). The
 * harness changes only two answers, inside the app's Multicall3 batches too: this account's balance
 * (1 tTRUST), and, when asked, the fee read (it fails).
 */
import type { Page, Route } from '@playwright/test'
import { parseAbi, decodeFunctionData, decodeFunctionResult, encodeFunctionResult, encodeAbiParameters } from 'viem'

/** Not a real account: no key exists for it. */
export const MOCK_ACCOUNT = '0x00000000000000000000000000000000000a9e57'
const CHAIN_HEX = '0x350b' // 13579
const RPC = 'https://testnet.rpc.intuition.systems/http'
/** depositFixedFee() / depositPercentageFee() on the FeeProxy. */
const FEE_SELECTORS = ['0x02ef36c7', '0x63173be7']
const FEE_PROXY = '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41'

export async function installMockWallet(page: Page, opts: { feeReadFails?: boolean } = {}) {
  await page.addInitScript(({ account, chainHex }) => {
    const listeners: Record<string, Array<(v: unknown) => void>> = {}
    const provider = {
      isMetaMask: false,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts': return [account]
          case 'eth_chainId': return chainHex
          case 'net_version': return '13579'
          case 'wallet_switchEthereumChain':
          case 'wallet_addEthereumChain': return null
          case 'wallet_getPermissions':
          case 'wallet_requestPermissions': return [{ parentCapability: 'eth_accounts' }]
          default: throw Object.assign(new Error('The harness wallet signs nothing.'), { code: 4001 })
        }
      },
      on: (e: string, f: (v: unknown) => void) => { (listeners[e] ??= []).push(f) },
      removeListener: (e: string, f: (v: unknown) => void) => { listeners[e] = (listeners[e] ?? []).filter((g) => g !== f) },
    }
    Object.defineProperty(window, 'ethereum', { value: provider, configurable: true })
  }, { account: MOCK_ACCOUNT, chainHex: CHAIN_HEX })

  await page.route(RPC, async (route: Route) => {
    const body = route.request().postDataJSON() as RpcCall | RpcCall[]
    if (!needsPatch(body, opts)) return route.continue()
    // The real answer first (the batch's other reads stay real), then only our entries changed.
    const real = await route.fetch()
    const answer = (await real.json()) as RpcAnswer | RpcAnswer[]
    const patched = Array.isArray(body)
      ? body.map((c) => patch(c, (answer as RpcAnswer[]).find((x) => x.id === c.id), opts))
      : patch(body, answer as RpcAnswer, opts)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(patched) })
  })
}

interface RpcCall { id: number; method: string; params?: unknown[] }
interface RpcAnswer { id: number; result?: string; error?: unknown; jsonrpc?: string }

const AGGREGATE3 = parseAbi(['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)'])
const GET_ETH_BALANCE = '0x4d2301cc' // Multicall3 getEthBalance(address)
const ONE_TTRUST = 10n ** 18n

/** Does this request read our account's balance, or (when it should fail) the fee? */
function needsPatch(body: RpcCall | RpcCall[], opts: { feeReadFails?: boolean }): boolean {
  const text = JSON.stringify(body).toLowerCase()
  return text.includes(MOCK_ACCOUNT.slice(2)) || (!!opts.feeReadFails && FEE_SELECTORS.some((s) => text.includes(s.slice(2))))
}

function patch(call: RpcCall, answer: RpcAnswer | undefined, opts: { feeReadFails?: boolean }): RpcAnswer {
  if (!answer) return { jsonrpc: '2.0', id: call.id, error: { code: -32603, message: 'harness: no answer' } }
  const p0 = (call.params?.[0] ?? {}) as { to?: string; data?: `0x${string}` }
  if (call.method === 'eth_getBalance' && String(call.params?.[0]).toLowerCase() === MOCK_ACCOUNT) {
    return { ...answer, result: '0x' + ONE_TTRUST.toString(16) }
  }
  if (call.method !== 'eth_call' || !p0.data || answer.result === undefined) return answer
  const isFee = (data: string) => FEE_SELECTORS.some((s) => data.toLowerCase().startsWith(s))
  if (opts.feeReadFails && isFee(p0.data)) return { jsonrpc: '2.0', id: call.id, error: { code: -32603, message: 'harness: the fee read fails' } }
  if (!p0.data.startsWith('0x82ad56cb')) return answer
  // A Multicall3 batch: change only our entries.
  const { args } = decodeFunctionData({ abi: AGGREGATE3, data: p0.data })
  const results = [...decodeFunctionResult({ abi: AGGREGATE3, functionName: 'aggregate3', data: answer.result as `0x${string}` })]
  args[0].forEach((c, i) => {
    const data = c.callData.toLowerCase()
    if (data.startsWith(GET_ETH_BALANCE) && data.endsWith(MOCK_ACCOUNT.slice(2))) {
      results[i] = { success: true, returnData: encodeAbiParameters([{ type: 'uint256' }], [ONE_TTRUST]) }
    } else if (opts.feeReadFails && c.target.toLowerCase() === FEE_PROXY && isFee(data)) {
      results[i] = { success: false, returnData: '0x' }
    }
  })
  return { ...answer, result: encodeFunctionResult({ abi: AGGREGATE3, functionName: 'aggregate3', result: results }) }
}
