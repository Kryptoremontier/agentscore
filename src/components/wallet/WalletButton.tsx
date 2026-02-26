'use client'

import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, User, Shield, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'

export function WalletButton() {
  const { address, isConnected, isConnecting, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [showConnectors, setShowConnectors] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isWrongChain = isConnected && chain?.id !== intuitionTestnet.id

  useEffect(() => { setMounted(true) }, [])

  // Auto-switch to Intuition Testnet right after connecting on wrong chain
  useEffect(() => {
    if (mounted && isConnected && chain && chain.id !== intuitionTestnet.id) {
      try {
        switchChain({ chainId: intuitionTestnet.id })
      } catch {
        // User rejected or wallet doesn't support — they'll see the warning button
      }
    }
  }, [mounted, isConnected, chain?.id])

  if (!mounted) {
    return (
      <Button disabled className="min-w-[160px]">
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    )
  }

  if (isConnecting) {
    return (
      <Button disabled className="min-w-[160px]">
        <Loader className="w-4 h-4 mr-2 animate-spin" />
        Connecting...
      </Button>
    )
  }

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowConnectors(true)}
          className="glow-blue"
        >
          <Wallet className="w-4 h-4 mr-2" />
          Connect Wallet
        </Button>

        {/* Wallet selection modal */}
        <AnimatePresence>
          {showConnectors && (
            <WalletModal
              connectors={connectors}
              onConnect={(connector) => {
                connect({ connector })
                setShowConnectors(false)
              }}
              onClose={() => setShowConnectors(false)}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  // Connected but wrong chain — show switch button
  if (isWrongChain) {
    return (
      <Button
        onClick={() => switchChain({ chainId: intuitionTestnet.id })}
        disabled={isSwitching}
        className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30"
      >
        {isSwitching ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" />
            Switching...
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Switch to Intuition Testnet
          </>
        )}
      </Button>
    )
  }

  // Connected on correct chain
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="glass flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
          {/* Identicon */}
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent-cyan" />

          {/* Address */}
          <span className="font-mono text-sm">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>

          {/* Balance */}
          {balance && (
            <span className="text-text-secondary text-sm">
              {parseFloat(balance.formatted).toFixed(3)} {balance.symbol}
            </span>
          )}

          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="glass w-56">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile?tab=agents" className="flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            My Agents
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(address!)}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://testnet.explorer.intuition.systems/address/${address}`} target="_blank">
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Explorer
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="text-red-400">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Wallet Modal Component
interface WalletModalProps {
  connectors: readonly any[]
  onConnect: (connector: any) => void
  onClose: () => void
}

function WalletModal({ connectors, onConnect, onClose }: WalletModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Portal to document.body to escape navbar's backdrop-blur containing block
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Connect Wallet</h2>
        <div className="space-y-3">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => onConnect(connector)}
              className="w-full glass glass-hover rounded-lg p-4 text-left transition-all flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center">
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
    document.body
  )
}
