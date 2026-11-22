/**
 * The FeeProxy's fee setters, as calldata (Etap 9b, docs/FEE_CHANGE_RUNBOOK.md). Pure: builds the
 * `data` of a transaction the fee admin signs in their own wallet. Nothing here signs, sends, or
 * touches a key — scripts/fee-calldata.ts only prints it.
 *
 * Read on-chain on 2026-11-22 (block 9,379,103, chain 13579): no owner and no roles; admins are
 * `whitelistedAdmins(address)`, set at deployment for the admin wallet and the fee recipient. A
 * call from anyone else reverts with IntuitionFeeProxy_NotWhitelistedAdmin() (0x594ac09d).
 */

import { encodeFunctionData, toFunctionSelector } from 'viem'

export const FEE_PROXY = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41' as const
export const FEE_CHAIN_ID = 13579
/** The two whitelisted admins (AdminWhitelistUpdated events in the deployment transaction). */
export const FEE_ADMINS = {
  adminWallet: '0x139219107C1eBE569f543C581b3B807Cf6740006',
  feeRecipient: '0x57246adCD446809c4DB1b04046E731954985bea2',
} as const
/** The fixed fee before any Beta change: 0.02 tTRUST (set by the admin wallet at block 9,034,478). */
export const FIXED_FEE_BEFORE_BETA_WEI = 20_000_000_000_000_000n
export const PERCENTAGE_FEE_BPS = 250n
/** setDepositPercentageFee reverts above this (base 10,000). */
export const MAX_FEE_PERCENTAGE = 10_000n

export const FEE_SETTERS = {
  fixed: 'setDepositFixedFee(uint256)',
  percentage: 'setDepositPercentageFee(uint256)',
  recipient: 'setFeeRecipient(address)',
  admin: 'setWhitelistedAdmin(address,bool)',
} as const

const ABI = [
  { type: 'function', name: 'setDepositFixedFee', stateMutability: 'nonpayable', inputs: [{ name: 'newFee', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setDepositPercentageFee', stateMutability: 'nonpayable', inputs: [{ name: 'newFee', type: 'uint256' }], outputs: [] },
] as const

export interface FeeCall { to: typeof FEE_PROXY; value: 0n; data: `0x${string}`; signature: string; chainId: number }

/** The transaction that sets the fixed fee (wei of tTRUST per deposit). */
export function setFixedFeeCall(newFeeWei: bigint): FeeCall {
  if (newFeeWei < 0n) throw new Error('A fee cannot be negative.')
  return { to: FEE_PROXY, value: 0n, chainId: FEE_CHAIN_ID, signature: FEE_SETTERS.fixed, data: encodeFunctionData({ abi: ABI, functionName: 'setDepositFixedFee', args: [newFeeWei] }) }
}

/** The transaction that sets the percentage fee (base 10,000: 250 = 2.5%). */
export function setPercentageFeeCall(bps: bigint): FeeCall {
  if (bps < 0n || bps > MAX_FEE_PERCENTAGE) throw new Error(`The percentage fee must be 0–${MAX_FEE_PERCENTAGE} (base 10,000).`)
  return { to: FEE_PROXY, value: 0n, chainId: FEE_CHAIN_ID, signature: FEE_SETTERS.percentage, data: encodeFunctionData({ abi: ABI, functionName: 'setDepositPercentageFee', args: [bps] }) }
}

export const selectorOf = (signature: string) => toFunctionSelector(signature)
