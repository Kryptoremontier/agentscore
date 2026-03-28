'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Zap, Trophy, Target, MessageSquare, Crown,
  PenSquare, BookOpen, User, Menu, X,
} from 'lucide-react'
import { WalletButton } from '@/components/wallet/WalletButton'
import { cn } from '@/lib/cn'

const BOTTOM_TABS = [
  { href: '/agents',     label: 'Agents',      icon: Bot,          color: '#C8963C' },
  { href: '/domains',    label: 'Domains',      icon: Trophy,       color: '#8B5CF6' },
  { href: '/claims',     label: 'Claims',       icon: MessageSquare, color: '#38B6FF' },
  { href: '/evaluators', label: 'Evaluators',   icon: Target,       color: '#F59E0B' },
]

const MENU_GROUPS = [
  {
    label: 'Explore',
    items: [
      { href: '/agents',     label: 'Agents',      icon: Bot,          color: '#C8963C' },
      { href: '/skills',     label: 'Skills',       icon: Zap,          color: '#2EE6D6' },
      { href: '/domains',    label: 'Domains',      icon: Trophy,       color: '#8B5CF6' },
      { href: '/evaluators', label: 'Evaluators',   icon: Target,       color: '#F59E0B' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { href: '/claims',      label: 'Claims',      icon: MessageSquare, color: '#38B6FF' },
      { href: '/leaderboard', label: 'Leaderboard', icon: Crown,         color: '#C8963C' },
    ],
  },
  {
    label: 'Create',
    items: [
      { href: '/register',         label: 'Register Agent', icon: PenSquare, color: '#C8963C' },
      { href: '/register?tab=skill', label: 'Register Skill', icon: Zap,      color: '#2EE6D6' },
    ],
  },
  {
    label: 'Info',
    items: [
      { href: '/docs',    label: 'Documentation', icon: BookOpen, color: '#7A838D' },
      { href: '/profile', label: 'My Profile',    icon: User,     color: '#C8963C' },
    ],
  },
]

export function MobileBottomNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href.split('?')[0]))

  const anyTabActive = BOTTOM_TABS.some(t => isActive(t.href))

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden z-40"
        style={{
          background: 'rgba(8,8,14,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="grid grid-cols-5 h-16">
          {BOTTOM_TABS.map(tab => {
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <tab.icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: active ? tab.color : 'rgba(255,255,255,0.3)' }}
                />
                <span
                  className="text-[10px] font-medium transition-colors"
                  style={{ color: active ? tab.color : 'rgba(255,255,255,0.3)' }}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Menu
              className="w-5 h-5"
              style={{ color: menuOpen ? '#C8963C' : 'rgba(255,255,255,0.3)' }}
            />
            <span
              className="text-[10px] font-medium"
              style={{ color: menuOpen ? '#C8963C' : 'rgba(255,255,255,0.3)' }}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Full-screen menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Slide-up panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl overflow-hidden"
              style={{
                background: '#0d0d14',
                border: '1px solid rgba(255,255,255,0.08)',
                maxHeight: '85vh',
              }}
            >
              {/* Handle + close */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/10 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                <span className="text-sm font-semibold text-white/60">Navigation</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Nav groups */}
              <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(85vh - 60px)' }}>
                {MENU_GROUPS.map((group, gi) => (
                  <div key={group.label} className={gi > 0 ? 'mt-4' : 'mt-2'}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 px-2 mb-1">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map(item => {
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                              active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                            )}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: `${item.color}15`,
                                border: `1px solid ${item.color}30`,
                              }}
                            >
                              <item.icon className="w-4 h-4" style={{ color: item.color }} />
                            </div>
                            <span className={cn(
                              'text-sm font-medium',
                              active ? 'text-white' : 'text-white/60',
                            )}>
                              {item.label}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Wallet */}
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <WalletButton />
                </div>

                {/* Safe area spacer */}
                <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// Legacy export — kept for any stray imports
export function MobileNav() {
  return null
}
