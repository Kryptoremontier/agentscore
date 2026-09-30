'use client'

import { useAccount, useDisconnect, useBalance, useSwitchChain } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { useState, useEffect } from 'react'
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
import { useConnectModal } from './ConnectModal'

export function WalletButton() {
  const { address, isConnected, isConnecting, chain } = useAccount()
  // The app's one wallet-connect modal (components/wallet/ConnectModal.tsx).
  const { openConnectModal } = useConnectModal()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })
  const { switchChain, isPending: isSwitching } = useSwitchChain()

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
      <Button
        onClick={() => openConnectModal()}
        className="bg-gradient-to-r from-[#C8963C] to-[#A87820] text-[#0F1113] font-bold hover:shadow-lg hover:shadow-[#C8963C]/25 border-0"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
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
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
            {/* The long label pushed a 390 px header off the screen (Etap 5b). */}
            <span className="sm:hidden">Switch network</span>
            <span className="hidden sm:inline">Switch to Intuition Testnet</span>
          </>
        )}
      </Button>
    )
  }

  const balanceText = balance ? `${parseFloat(balance.formatted).toFixed(3)} ${balance.symbol}` : null

  // Connected on correct chain. On a phone the trigger is the identicon and a short address only —
  // address + balance overflowed a 390 px header (Etap 5b); the balance is the menu's first row.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="glass flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-xl border border-[#C8963C]/20 hover:bg-[#C8963C]/8 hover:border-[#C8963C]/40 transition-all duration-200 min-w-0 max-w-[10.5rem] sm:max-w-none"
          data-testid="wallet-button"
        >
          {/* Identicon */}
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#C8963C] to-[#A87820] flex-shrink-0" />

          {/* Address */}
          <span className="font-mono text-sm truncate min-w-0">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>

          {/* Balance — from sm up; in the menu on a phone */}
          {balanceText && (
            <span className="hidden sm:inline text-text-secondary text-sm whitespace-nowrap">{balanceText}</span>
          )}

          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="glass w-56">
        {balanceText && (
          <>
            <div className="px-2 py-1.5 text-sm text-text-secondary" data-testid="wallet-balance">{balanceText}</div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            My Profile
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
