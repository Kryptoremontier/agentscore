import { type PublicClient, type AbiEvent, type Log } from 'viem'
import { getMultiVaultAddressFromChainId } from '@0xintuition/sdk'
import { MultiVaultAbi } from '@0xintuition/protocol'
import type { TrustFlowSnapshot } from '@/lib/trust-score-engine'

const ESTIMATED_BLOCK_TIME_SECONDS = 2

type DepositedLog = Log<bigint, number, false, AbiEvent, true, typeof MultiVaultAbi, 'Deposited'>
type RedeemedLog = Log<bigint, number, false, AbiEvent, true, typeof MultiVaultAbi, 'Redeemed'>

export async function fetchRecentTrustFlow(
  publicClient: PublicClient,
  supportTermId: `0x${string}`,
  opposeTermId: `0x${string}` | null | undefined,
  windowHours: number
): Promise<TrustFlowSnapshot> {
  const chainId = publicClient.chain?.id
  if (!chainId) {
    return {}
  }

  const multiVaultAddress = getMultiVaultAddressFromChainId(chainId)
  const latestBlock = await publicClient.getBlockNumber()
  const blocksBack = BigInt(Math.ceil((windowHours * 3600) / ESTIMATED_BLOCK_TIME_SECONDS))
  const fromBlock = latestBlock > blocksBack ? latestBlock - blocksBack : BigInt(0)

  const depositedEvent = MultiVaultAbi.find(
    item => item.type === 'event' && item.name === 'Deposited'
  ) as AbiEvent | undefined
  const redeemedEvent = MultiVaultAbi.find(
    item => item.type === 'event' && item.name === 'Redeemed'
  ) as AbiEvent | undefined

  if (!depositedEvent || !redeemedEvent) {
    return {}
  }

  const [deposits, redeems] = await Promise.all([
    publicClient.getLogs({
      address: multiVaultAddress,
      event: depositedEvent,
      fromBlock,
      toBlock: latestBlock,
    }) as Promise<DepositedLog[]>,
    publicClient.getLogs({
      address: multiVaultAddress,
      event: redeemedEvent,
      fromBlock,
      toBlock: latestBlock,
    }) as Promise<RedeemedLog[]>,
  ])

  let buySupportWei = BigInt(0)
  let sellSupportWei = BigInt(0)
  let buyOpposeWei = BigInt(0)
  let sellOpposeWei = BigInt(0)

  for (const log of deposits) {
    const termId = normalizeTermId(log.args.termId)
    const assetsAfterFees = toBigInt(log.args.assetsAfterFees)
    const assets = toBigInt(log.args.assets)
    const value = assetsAfterFees > BigInt(0) ? assetsAfterFees : assets

    if (termId === supportTermId) {
      buySupportWei += value
    } else if (opposeTermId && termId === opposeTermId) {
      buyOpposeWei += value
    }
  }

  for (const log of redeems) {
    const termId = normalizeTermId(log.args.termId)
    const assets = toBigInt(log.args.assets)

    if (termId === supportTermId) {
      sellSupportWei += assets
    } else if (opposeTermId && termId === opposeTermId) {
      sellOpposeWei += assets
    }
  }

  return { buySupportWei, sellSupportWei, buyOpposeWei, sellOpposeWei }
}

export function blendFlowSnapshots(
  primary: TrustFlowSnapshot,
  secondary: TrustFlowSnapshot,
  primaryWeight = 0.7,
  secondaryWeight = 0.3
): TrustFlowSnapshot {
  return {
    buySupportWei: weighted(primary.buySupportWei, secondary.buySupportWei, primaryWeight, secondaryWeight),
    sellSupportWei: weighted(primary.sellSupportWei, secondary.sellSupportWei, primaryWeight, secondaryWeight),
    buyOpposeWei: weighted(primary.buyOpposeWei, secondary.buyOpposeWei, primaryWeight, secondaryWeight),
    sellOpposeWei: weighted(primary.sellOpposeWei, secondary.sellOpposeWei, primaryWeight, secondaryWeight),
  }
}

function weighted(
  primaryValue: bigint | undefined,
  secondaryValue: bigint | undefined,
  primaryWeight: number,
  secondaryWeight: number
): bigint {
  const p = primaryValue ?? BigInt(0)
  const s = secondaryValue ?? BigInt(0)
  const pBps = BigInt(Math.round(primaryWeight * 10000))
  const sBps = BigInt(Math.round(secondaryWeight * 10000))
  return (p * pBps + s * sBps) / BigInt(10000)
}

function normalizeTermId(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return null
  return value as `0x${string}`
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  if (typeof value === 'string') {
    try {
      return BigInt(value)
    } catch {
      return BigInt(0)
    }
  }
  return BigInt(0)
}
