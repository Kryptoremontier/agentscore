'use client'

import { http, createConfig } from 'wagmi'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { intuitionTestnet } from '@0xintuition/protocol'

export const config = createConfig({
  chains: [intuitionTestnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'AgentScore' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [intuitionTestnet.id]: http(process.env.NEXT_PUBLIC_INTUITION_RPC_URL),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}