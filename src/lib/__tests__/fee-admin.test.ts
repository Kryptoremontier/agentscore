/**
 * Etap 9b — how the owner changes the fee (docs/FEE_CHANGE_RUNBOOK.md). The calldata the runbook
 * prints is exactly what was simulated on-chain from the admin wallet (eth_call, 2026-11-22), and
 * nothing in the helper or its script signs, sends or handles a key.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  setFixedFeeCall, setPercentageFeeCall, selectorOf, FEE_PROXY, FEE_ADMINS, FIXED_FEE_BEFORE_BETA_WEI, FEE_SETTERS,
} from '../fee-admin'
import { ADMIN_WALLET } from '../constants'
import { FEE_PROXY_ADDRESS } from '../intuition'

const ROOT = path.join(__dirname, '..', '..', '..')
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8')

describe('the calldata', () => {
  it('fixed fee to 0 — the Beta change, as simulated from the admin wallet', () => {
    expect(setFixedFeeCall(0n)).toEqual({
      to: '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41', value: 0n, chainId: 13579, signature: 'setDepositFixedFee(uint256)',
      data: '0xf48371c00000000000000000000000000000000000000000000000000000000000000000',
    })
  })
  it('undo: back to 0.02 tTRUST', () => {
    expect(FIXED_FEE_BEFORE_BETA_WEI).toBe(20_000_000_000_000_000n)
    expect(setFixedFeeCall(FIXED_FEE_BEFORE_BETA_WEI).data).toBe('0xf48371c000000000000000000000000000000000000000000000000000470de4df820000')
  })
  it('the percentage setter, and its bounds', () => {
    expect(setPercentageFeeCall(250n).data).toBe('0x5ce33d4f00000000000000000000000000000000000000000000000000000000000000fa')
    expect(() => setPercentageFeeCall(10_001n)).toThrow()
    expect(() => setFixedFeeCall(-1n)).toThrow()
    expect(selectorOf(FEE_SETTERS.fixed)).toBe('0xf48371c0')
    expect(selectorOf(FEE_SETTERS.percentage)).toBe('0x5ce33d4f')
  })
  it('the same contract the app writes through, and the app\'s known admin wallet', () => {
    expect(FEE_PROXY).toBe(FEE_PROXY_ADDRESS)
    expect(FEE_ADMINS.adminWallet).toBe(ADMIN_WALLET)
  })
})

describe('no key, no transaction', () => {
  it('the helper and its script only build and print; --check is eth_call only', () => {
    for (const f of ['src/lib/fee-admin.ts', 'scripts/fee-calldata.ts']) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(src, f).not.toMatch(/privateKey|PRIVATE_KEY|mnemonic|privateKeyToAccount|mnemonicToAccount|writeContract|sendTransaction|eth_sendRawTransaction|eth_sendTransaction|walletClient/i)
    }
    expect(read('scripts/fee-calldata.ts')).toMatch(/rpc\('eth_call'/)
  })
  it('the runbook carries the same facts', () => {
    const doc = read('docs/FEE_CHANGE_RUNBOOK.md')
    for (const fact of [FEE_PROXY, FEE_ADMINS.adminWallet, FEE_ADMINS.feeRecipient, setFixedFeeCall(0n).data, setFixedFeeCall(FIXED_FEE_BEFORE_BETA_WEI).data, '0xf48371c0', '0x5ce33d4f', 'IntuitionFeeProxy_NotWhitelistedAdmin()']) {
      expect(doc, fact).toContain(fact)
    }
  })
})
