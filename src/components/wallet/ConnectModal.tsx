'use client'

/**
 * The app's wallet-connect modal, owned by one provider so any control can open it — the navbar's
 * Connect Wallet button and every "do this needs a wallet" click (Attest, IntuForge stake). A
 * caller can pass `onConnected` to carry on where the person was once the wallet connects (Etap 5a:
 * Attest → connect → the same agent's attest flow — no lost context). Dismissing drops it.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, X } from 'lucide-react'
import { useConnect, type Connector } from 'wagmi'

interface ConnectRequest {
  /** Runs once the wallet connected (not on dismiss or a rejected connection). */
  onConnected?: () => void
  /** Why the wallet is needed, shown under the title ("to attest Luda"). */
  reason?: string
}

interface ConnectModalApi {
  openConnectModal: (request?: ConnectRequest) => void
}

const ConnectModalContext = createContext<ConnectModalApi | null>(null)

export function ConnectModalProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConnectRequest | null>(null)
  const { connect, connectors } = useConnect()

  const openConnectModal = useCallback((r: ConnectRequest = {}) => setRequest(r), [])
  const api = useMemo(() => ({ openConnectModal }), [openConnectModal])

  return (
    <ConnectModalContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {request && (
          <WalletModal
            connectors={connectors}
            reason={request.reason}
            onConnect={(connector) => {
              const onConnected = request.onConnected
              setRequest(null)
              connect({ connector }, { onSuccess: () => onConnected?.() })
            }}
            onClose={() => setRequest(null)}
          />
        )}
      </AnimatePresence>
    </ConnectModalContext.Provider>
  )
}

export function useConnectModal(): ConnectModalApi {
  const api = useContext(ConnectModalContext)
  if (!api) throw new Error('useConnectModal needs <ConnectModalProvider> (app/providers.tsx)')
  return api
}

interface WalletModalProps {
  connectors: readonly Connector[]
  reason?: string
  onConnect: (connector: Connector) => void
  onClose: () => void
}

function WalletModal({ connectors, reason, onConnect, onClose }: WalletModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Portal to document.body to escape any containing block (the navbar's backdrop-blur, a modal's transform).
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      data-testid="connect-wallet-modal"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-wallet-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="connect-wallet-title" className="text-xl font-semibold">Connect Wallet</h2>
            {reason && <p className="text-sm text-text-secondary mt-1">{reason}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
        <div className="space-y-3">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => onConnect(connector)}
              className="w-full glass glass-hover rounded-lg p-4 text-left transition-all flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C8963C] to-[#A87820] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium">{connector.name}</span>
                <span className="text-sm text-text-secondary">
                  {connector.type === 'injected' ? 'Browser Wallet' : 'Mobile Wallet'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
