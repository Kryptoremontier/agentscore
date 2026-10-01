'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { User, ChevronDown, Bug, ShieldAlert, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { isAdminWallet } from '@/lib/constants'
import { BugReportModal } from '@/components/shared/BugReportModal'
import { PRIMARY_NAV, MORE_NAV, MORE_LABEL, ACCENT, isNavActive, isUnderMore } from './nav-items'

function GroupLabel({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <div className={cn('px-4 pb-1', first ? 'pt-2' : 'pt-3')}>
      <span className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'rgba(255,255,255,0.18)' }}>
        {label}
      </span>
    </div>
  )
}

// `color` is the item's own colour (the More sheet's icons); the active state is always the accent.
function NavLink({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: React.ElementType; color?: string; active: boolean; badge?: string }) {

  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg',
        'transition-colors duration-150 group',
        active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-accent"
        />
      )}
      <Icon
        className="w-5 h-5 shrink-0 transition-colors duration-150"
        style={{ color: active ? ACCENT : 'rgba(255,255,255,0.32)' }}
      />
      <span className={cn(
        'flex-1 text-sm font-medium whitespace-nowrap transition-colors duration-150 leading-none',
        active ? 'text-white' : 'text-white/50 group-hover:text-white/80',
      )}>
        {label}
      </span>
      {badge && (
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(200,150,60,0.15)', color: '#C8963C', border: '1px solid rgba(200,150,60,0.2)' }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [bugModalOpen, setBugModalOpen] = useState(false)
  // Etap 5b Run 2: three places up front, the rest under More — open when the page is one of More's.
  const [moreOpen, setMoreOpen] = useState(() => isUnderMore(pathname))
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (isUnderMore(pathname)) setMoreOpen(true) }, [pathname])

  const isAdmin = mounted && isAdminWallet(address)

  return (
    <aside
      className="fixed left-0 top-16 lg:top-20 bottom-0 z-40 hidden md:flex flex-col w-56"
      style={{
        background: 'rgba(8,8,14,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
      data-testid="sidebar"
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-hide">

        {/* The three places */}
        <nav aria-label="Primary" className="space-y-0.5 pt-1">
          {PRIMARY_NAV.map(item => (
            <NavLink key={item.href} {...item} active={isNavActive(item.href, pathname)} />
          ))}
        </nav>

        {/* Everything else */}
        <button
          type="button"
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
          data-testid="nav-more"
          className="relative flex items-center gap-3 mx-2 mt-2 px-2 py-2.5 rounded-lg w-[calc(100%-16px)] transition-colors duration-150 group hover:bg-white/[0.04]"
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" style={{ color: 'rgba(255,255,255,0.32)' }} />
          <span className="flex-1 text-left text-sm font-medium whitespace-nowrap text-white/50 group-hover:text-white/80 leading-none">
            {MORE_LABEL}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 mr-1 text-white/25 transition-transform duration-200', moreOpen && 'rotate-180')} />
        </button>

        {moreOpen && (
          <div data-testid="nav-more-items">
            {MORE_NAV.map(group => (
              <div key={group.label}>
                <GroupLabel label={group.label} />
                {group.items.map(item => (
                  <NavLink key={item.href} {...item} active={isNavActive(item.href, pathname)} />
                ))}
              </div>
            ))}

            {/* Report Bug */}
            <div className="pt-2">
              <button
                onClick={() => setBugModalOpen(true)}
                className="relative flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg w-[calc(100%-16px)] transition-colors duration-150 group hover:bg-white/[0.04]"
              >
                <Bug className="w-5 h-5 shrink-0" style={{ color: '#EF4444' }} />
                <span className="text-sm font-medium whitespace-nowrap text-white/50 group-hover:text-white/80 transition-colors leading-none">
                  Report Bug
                </span>
              </button>
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <GroupLabel label="Admin" />
            <NavLink href="/admin/predicates" label="Predicates" icon={ShieldAlert} color="#C8963C" active={isNavActive('/admin/predicates', pathname)} />
            <NavLink href="/admin/feedback" label="Bug Reports" icon={Bug} color="#EF4444" active={isNavActive('/admin/feedback', pathname)} />
          </>
        )}

      </div>

      <BugReportModal open={bugModalOpen} onClose={() => setBugModalOpen(false)} />

      {/* Profile (bottom, wallet connected only) */}
      {mounted && address && (
        <>
          <div className="mx-3 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="py-2">
            <Link
              href="/profile"
              className={cn(
                'flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg',
                'transition-colors duration-150 group',
                isNavActive('/profile', pathname) ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              )}
            >
              <User
                className="w-5 h-5 shrink-0"
                style={{ color: isNavActive('/profile', pathname) ? ACCENT : 'rgba(255,255,255,0.32)' }}
              />
              <span className="text-xs font-mono text-white/40 group-hover:text-white/60 transition-colors truncate">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            </Link>
          </div>
        </>
      )}
    </aside>
  )
}
