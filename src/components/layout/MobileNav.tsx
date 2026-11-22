'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { isAdminWallet } from '@/lib/constants'
import { PRIMARY_NAV, MORE_NAV, ADMIN_NAV, MORE_LABEL, ADMIN_LABEL, ACCENT, isNavActive, isUnderMore, type NavItem } from './nav-items'

/**
 * The phone's bottom nav (Etap 9c): the three jobs — Check an agent · Trust an agent · For
 * developers — as tabs, plus "More", a sheet with the same list as the sidebar's More (and Admin
 * for the admin wallet). The wallet and My Profile are in the top bar (components/wallet/WalletButton).
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isAdmin = mounted && isAdminWallet(address)
  const moreActive = sheetOpen || isUnderMore(pathname)
  const groups: ReadonlyArray<{ label: string; items: readonly NavItem[] }> = [
    { label: MORE_LABEL, items: MORE_NAV },
    ...(isAdmin ? [{ label: ADMIN_LABEL, items: ADMIN_NAV }] : []),
  ]

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 md:hidden z-40"
        style={{
          background: 'rgba(8,8,14,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        data-testid="bottom-nav"
      >
        <div className="grid grid-cols-4 h-16">
          {PRIMARY_NAV.map(tab => {
            const active = isNavActive(tab.href, pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <tab.icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: active ? ACCENT : 'rgba(255,255,255,0.3)' }}
                />
                <span
                  className="text-[10px] font-medium transition-colors text-center leading-tight"
                  style={{ color: active ? ACCENT : 'rgba(255,255,255,0.3)' }}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            data-testid="bottom-nav-more"
            className="flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Menu className="w-5 h-5" style={{ color: moreActive ? ACCENT : 'rgba(255,255,255,0.3)' }} />
            <span className="text-[10px] font-medium" style={{ color: moreActive ? ACCENT : 'rgba(255,255,255,0.3)' }}>
              {MORE_LABEL}
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label={MORE_LABEL}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl overflow-hidden"
              style={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh' }}
              data-testid="more-sheet"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/10 absolute left-1/2 -translate-x-1/2 top-3" />
                <span className="text-sm font-semibold text-white/60">{MORE_LABEL}</span>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(85vh - 60px)' }}>
                {groups.map((group, gi) => (
                  <nav key={group.label} aria-label={group.label} className={gi > 0 ? 'mt-4' : 'mt-1'} data-testid={`more-sheet-${group.label.toLowerCase()}`}>
                    {gi > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 px-2 mb-1">{group.label}</p>}
                    <div className="space-y-0.5">
                      {group.items.map(item => {
                        const active = isNavActive(item.href, pathname)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSheetOpen(false)}
                            className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors', active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
                          >
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}
                            >
                              <item.icon className="w-4 h-4" style={{ color: item.color }} />
                            </span>
                            <span className={cn('text-sm font-medium', active ? 'text-white' : 'text-white/60')}>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </nav>
                ))}
                <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
