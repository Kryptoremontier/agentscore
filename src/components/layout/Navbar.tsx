'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Command, Plus, ChevronDown, Bot, Zap,
} from 'lucide-react'
import { WalletButton } from '@/components/wallet/WalletButton'
import { SearchModal } from '@/components/shared/SearchModal'
import { cn } from '@/lib/cn'

function RegisterDropdown() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = pathname?.startsWith('/register')

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div
      ref={ref}
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          'bg-white/5 border border-white/10 hover:bg-white/10',
          isActive && 'border-[#C8963C]/30 text-[#C8963C]',
        )}
      >
        <Plus className="w-4 h-4" />
        <span>Register</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-1 w-48 z-[45]"
          >
            <div className="bg-[#0F1113] border border-[#C8963C]/20 rounded-xl shadow-2xl shadow-black/40 overflow-hidden p-1.5">
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group hover:bg-white/5 text-[#B5BDC6] hover:text-white"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.25)' }}>
                  <Bot className="w-4 h-4" style={{ color: '#C8963C' }} />
                </div>
                <div>
                  <p className="font-medium text-sm">Agent</p>
                  <p className="text-xs text-[#7A838D] group-hover:text-[#B5BDC6] transition-colors">Register AI agent</p>
                </div>
              </Link>

              <Link
                href="/register?tab=skill"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group hover:bg-white/5 text-[#B5BDC6] hover:text-white"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(46,230,214,0.10)', border: '1px solid rgba(46,230,214,0.22)' }}>
                  <Zap className="w-4 h-4" style={{ color: '#2EE6D6' }} />
                </div>
                <div>
                  <p className="font-medium text-sm">Skill</p>
                  <p className="text-xs text-[#7A838D] group-hover:text-[#B5BDC6] transition-colors">Register AI skill</p>
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          scrolled
            ? 'bg-[#0F1113]/85 backdrop-blur-xl border-b border-[#C8963C]/15 shadow-lg shadow-black/30'
            : 'bg-transparent',
        )}
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <div className="relative w-8 h-8">
                <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
                  <defs>
                    <linearGradient id="checkGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#A87820" />
                      <stop offset="50%" stopColor="#C8963C" />
                      <stop offset="100%" stopColor="#C9A84C" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M6 16L12 22L26 8"
                    stroke="url(#checkGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_8px_rgba(200,150,60,0.6)]"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">Agent</span>
                <span className="text-[#C8963C]">Score</span>
              </span>
            </Link>

            {/* Right side: Search + Create Claim + Register + Wallet */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className={cn(
                  'hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl',
                  'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20',
                  'transition-all duration-200 group',
                )}
              >
                <Search className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  Search...
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded border border-white/10">
                    <Command className="w-3 h-3 inline" />
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded border border-white/10">
                    K
                  </kbd>
                </span>
              </button>

              {/* Search icon only on mobile */}
              <button
                onClick={() => setSearchOpen(true)}
                className="sm:hidden p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <Search className="w-4 h-4 text-slate-400" />
              </button>

              {/* Create Claim */}
              <Link
                href="/claims?create=true"
                className={cn(
                  'hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
                  'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20',
                  'transition-all duration-200 text-slate-300 hover:text-white',
                )}
              >
                <Plus className="w-4 h-4" />
                <span>Create Claim</span>
              </Link>

              {/* Register dropdown */}
              <RegisterDropdown />

              {/* Wallet */}
              <WalletButton />
            </div>

          </div>
        </div>
      </motion.nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
