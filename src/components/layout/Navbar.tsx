'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Menu,
  X,
  Plus,
  Command,
  ChevronDown,
  Bot,
  Zap,
  MessageSquare,
  Trophy,
} from 'lucide-react'
import { WalletButton } from '@/components/wallet/WalletButton'
import { SearchModal } from '@/components/shared/SearchModal'
import { cn } from '@/lib/cn'

const navLinks = [
  { href: '/register', label: 'Register' },
  { href: '/docs', label: 'Docs' },
]

function ExploreDropdown() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = pathname?.startsWith('/agents') || pathname?.startsWith('/skills') || pathname?.startsWith('/claims') || pathname?.startsWith('/leaderboard')

  // Click outside to close
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
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          isActive
            ? 'text-[#C8963C] bg-[#C8963C]/10'
            : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
        )}
      >
        Explore
        <ChevronDown
          className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-56 z-50"
          >
            <div className="bg-[#0F1113] border border-[#C8963C]/20 rounded-xl shadow-2xl shadow-black/40 overflow-hidden p-1.5">
              <Link
                href="/agents"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  pathname?.startsWith('/agents')
                    ? 'bg-[#C8963C]/10 text-[#C8963C]'
                    : 'hover:bg-white/5 text-[#B5BDC6] hover:text-white'
                )}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.25)', boxShadow: '0 0 10px rgba(200,150,60,0.15)' }}>
                  <Bot className="w-4 h-4" style={{ color: '#C8963C' }} />
                </div>
                <div>
                  <p className="font-medium text-sm">Agents</p>
                  <p className="text-xs text-[#7A838D] group-hover:text-[#B5BDC6] transition-colors">Browse AI agents & trust scores</p>
                </div>
              </Link>

              <Link
                href="/skills"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  pathname?.startsWith('/skills')
                    ? 'bg-[#2EE6D6]/10 text-[#2EE6D6]'
                    : 'hover:bg-white/5 text-[#B5BDC6] hover:text-white'
                )}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(46,230,214,0.10)', border: '1px solid rgba(46,230,214,0.22)', boxShadow: '0 0 10px rgba(46,230,214,0.12)' }}>
                  <Zap className="w-4 h-4" style={{ color: '#2EE6D6' }} />
                </div>
                <div>
                  <p className="font-medium text-sm">Skills</p>
                  <p className="text-xs text-[#7A838D] group-hover:text-[#B5BDC6] transition-colors">Discover reusable AI capabilities</p>
                </div>
              </Link>

              <Link
                href="/claims"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  pathname?.startsWith('/claims')
                    ? 'bg-[#38B6FF]/10 text-[#38B6FF]'
                    : 'hover:bg-white/5 text-[#B5BDC6] hover:text-white'
                )}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(56,182,255,0.10)', border: '1px solid rgba(56,182,255,0.22)', boxShadow: '0 0 10px rgba(56,182,255,0.12)' }}>
                  <MessageSquare className="w-4 h-4" style={{ color: '#38B6FF' }} />
                </div>
                <div>
                  <p className="font-medium text-sm">Claims</p>
                  <p className="text-xs text-[#7A838D] group-hover:text-[#B5BDC6] transition-colors">Agent-Skill relationship claims</p>
                </div>
              </Link>

              <div className="my-1 h-px bg-white/5" />

              <Link
                href="/leaderboard"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  pathname?.startsWith('/leaderboard')
                    ? 'bg-[#C8963C]/10 text-[#C8963C]'
                    : 'hover:bg-white/5 text-[#B5BDC6] hover:text-white'
                )}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(200,150,60,0.10)', border: '1px solid rgba(200,150,60,0.22)', boxShadow: '0 0 10px rgba(200,150,60,0.12)' }}>
                  <Trophy className="w-4 h-4" style={{ color: '#C8963C' }} />
                </div>
                <div>
                  <p className="font-medium text-sm">Leaderboard</p>
                  <p className="text-xs text-[#7A838D] group-hover:text-[#B5BDC6] transition-colors">Top contributors on-chain</p>
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Keyboard shortcut ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
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
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {/* Logo Icon - stylizowany checkmark */}
              <div className="relative w-8 h-8">
                <svg
                  viewBox="0 0 32 32"
                  className="w-full h-full"
                  fill="none"
                >
                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="checkGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#A87820" />
                      <stop offset="50%" stopColor="#C8963C" />
                      <stop offset="100%" stopColor="#C9A84C" />
                    </linearGradient>
                  </defs>
                  {/* Checkmark path */}
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

              {/* Text */}
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">Agent</span>
                <span className="text-[#C8963C]">Score</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {/* Explore Dropdown */}
              <ExploreDropdown />

              {/* Other nav links */}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    pathname?.startsWith(link.href)
                      ? 'text-[#C8963C] bg-[#C8963C]/10'
                      : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-3">

              {/* Search Button */}
              <button
                onClick={() => setSearchOpen(true)}
                className={cn(
                  'hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl',
                  'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20',
                  'transition-all duration-200 group'
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

              {/* Add Agent Button */}
              <Link
                href="/register"
                className={cn(
                  'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl',
                  'bg-white/5 border border-white/10 hover:bg-white/10',
                  'text-sm font-medium transition-all duration-200'
                )}
              >
                <Plus className="w-4 h-4" />
                <span>Register</span>
              </Link>

              {/* Wallet Button */}
              <WalletButton />

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-[#C8963C]/15 bg-[#0F1113]/95 backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-2">
                <Link
                  href="/agents"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all',
                    pathname?.startsWith('/agents')
                      ? 'text-[#C8963C] bg-[#C8963C]/10'
                      : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
                  )}
                >
                  <Bot className="w-5 h-5 text-[#C8963C]" /> Agents
                </Link>
                <Link
                  href="/skills"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all',
                    pathname?.startsWith('/skills')
                      ? 'text-[#2EE6D6] bg-[#2EE6D6]/10'
                      : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
                  )}
                >
                  <Zap className="w-5 h-5 text-[#2EE6D6]" /> Skills
                </Link>
                <Link
                  href="/claims"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all',
                    pathname?.startsWith('/claims')
                      ? 'text-[#38B6FF] bg-[#38B6FF]/10'
                      : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
                  )}
                >
                  <MessageSquare className="w-5 h-5 text-[#38B6FF]" /> Claims
                </Link>
                <Link
                  href="/leaderboard"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all',
                    pathname?.startsWith('/leaderboard')
                      ? 'text-[#C8963C] bg-[#C8963C]/10'
                      : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
                  )}
                >
                  <Trophy className="w-5 h-5 text-[#C8963C]" /> Leaderboard
                </Link>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'block px-4 py-3 rounded-xl text-base font-medium transition-all',
                      pathname?.startsWith(link.href)
                        ? 'text-[#C8963C] bg-[#C8963C]/10'
                        : 'text-[#B5BDC6] hover:text-white hover:bg-white/5'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
