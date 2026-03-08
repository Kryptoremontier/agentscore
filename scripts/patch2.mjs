import { readFileSync, writeFileSync } from 'fs'

let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/lib/intuition.ts', 'utf8')

c = c.replace(
`import {
  createAtomFromString,
  createAtomFromEthereumAccount,
  getAtomDetails,
  getTripleDetails,
  getMultiVaultAddressFromChainId,
} from '@0xintuition/sdk'
import { calculateBuy } from './bonding-curve'
import { type PublicClient, type WalletClient, parseEther } from 'viem'`,
`import {
  getAtomDetails,
  getTripleDetails,
  getMultiVaultAddressFromChainId,
} from '@0xintuition/sdk'
import { calculateBuy } from './bonding-curve'
import { type PublicClient, type WalletClient, parseEther, stringToHex } from 'viem'`
)

writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/lib/intuition.ts', c)
console.log('SDK imports cleaned:', c.includes('createAtomFromString') ? 'FAIL - still there' : 'OK - removed')
console.log('stringToHex:', c.includes('stringToHex') ? 'OK' : 'FAIL - missing')
