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
  ChevronDown
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
  const isActive = pathname?.startsWith('/agents') || pathname?.startsWith('/skills')

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
            ? 'text-white bg-white/10'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
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
            <div className="bg-[rgb(10,10,15)] border border-white/10 rounded-xl shadow-2xl shadow-black/40 overflow-hidden p-1.5">
              <Link
                href="/agents"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                  pathname?.startsWith('/agents')
                    ? 'bg-white/10 text-white'
                    : 'hover:bg-white/5 text-slate-300 hover:text-white'
                )}
              >
                <span className="text-lg mt-0.5">🤖</span>
                <div>
                  <p className="font-medium text-sm">Agents</p>
                  <p className="text-xs text-slate-500 group-hover:text-slate-400">Browse AI agents & trust scores</p>
                </div>
              </Link>

              <Link
                href="/skills"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                  pathname?.startsWith('/skills')
                    ? 'bg-white/10 text-white'
                    : 'hover:bg-white/5 text-slate-300 hover:text-white'
                )}
              >
                <span className="text-lg mt-0.5">⚡</span>
                <div>
                  <p className="font-medium text-sm">Skills</p>
                  <p className="text-xs text-slate-500 group-hover:text-slate-400">Discover reusable AI capabilities</p>
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
            ? 'bg-[rgb(10,10,15)]/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20'
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
                      <stop offset="0%" stopColor="#F97316" />
                      <stop offset="30%" stopColor="#EC4899" />
                      <stop offset="60%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#00D4FF" />
                    </linearGradient>
                  </defs>
                  {/* Checkmark path */}
                  <path
                    d="M6 16L12 22L26 8"
                    stroke="url(#checkGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]"
                  />
                </svg>
              </div>

              {/* Text */}
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">Agent</span>
                <span className="text-cyan-400">Score</span>
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
                      ? 'text-white bg-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
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
              className="lg:hidden border-t border-white/10 bg-[rgb(10,10,15)]/95 backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-2">
                <Link
                  href="/agents"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium transition-all',
                    pathname?.startsWith('/agents')
                      ? 'text-white bg-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  🤖 Agents
                </Link>
                <Link
                  href="/skills"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium transition-all',
                    pathname?.startsWith('/skills')
                      ? 'text-white bg-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  ⚡ Skills
                </Link>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'block px-4 py-3 rounded-xl text-base font-medium transition-all',
                      pathname?.startsWith(link.href)
                        ? 'text-white bg-white/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
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
