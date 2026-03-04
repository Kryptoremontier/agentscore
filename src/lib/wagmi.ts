'use client'

import { http, createConfig } from 'wagmi'
import { coinbaseWallet, injected } from 'wagmi/connectors'
import { intuitionTestnet } from '@0xintuition/protocol'

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID
const PLACEHOLDER_IDS = ['your_walletconnect_project_id', 'demo_project_id']
const hasValidWc = wcProjectId && !PLACEHOLDER_IDS.includes(wcProjectId)

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'AgentScore' }),
  ...(hasValidWc
    ? (() => {
        const { walletConnect } = require('wagmi/connectors')
        return [walletConnect({ projectId: wcProjectId })]
      })()
    : []),
]

export const config = createConfig({
  chains: [intuitionTestnet],
  connectors,
  transports: {
    [intuitionTestnet.id]: http(process.env.NEXT_PUBLIC_INTUITION_RPC_URL),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}