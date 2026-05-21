'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { isAdminWallet } from '@/lib/constants'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!isConnected || !isAdminWallet(address)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] pt-24">
        <div className="text-center px-4">
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-white/40 text-sm">
            This page requires admin wallet connection.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
