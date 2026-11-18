'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_NAV, ACCENT, isNavActive } from './nav-items'

/**
 * The phone's bottom nav (Etap 9, one job): the three places — Check an agent · Trust an agent ·
 * For developers — the same three as the desktop sidebar (components/layout/nav-items.ts). The
 * "More" sheet is gone: everything it held is in the footer, under "More from AgentScore", on
 * every page. The wallet and My Profile are in the top bar (components/wallet/WalletButton).
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  return (
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
      <div className="grid grid-cols-3 h-16">
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
                className="text-[10px] font-medium transition-colors"
                style={{ color: active ? ACCENT : 'rgba(255,255,255,0.3)' }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
