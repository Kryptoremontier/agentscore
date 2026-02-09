# 🎨 AGENTSCORE UI ENHANCEMENT - PROMPT DLA CURSOR

## 📋 INSTRUKCJA

Wklej ten prompt do Cursor Composer (Ctrl+I) aby ulepszyć wygląd AgentScore.

---

# ZADANIE: Ulepsz UI AgentScore

Mamy działającą aplikację AgentScore, ale potrzebuje visual polish. Zaimplementuj poniższe ulepszenia krok po kroku.

## OBECNY PROBLEM:
- Strona wygląda zbyt "plain"
- Brakuje efektów glass/blur
- Animacje są podstawowe
- Navbar nie ma efektu scroll
- Hero section jest statyczna

## CEL:
Osiągnąć premium, dark-mode, glassmorphism aesthetic jak nowoczesne Web3 platformy (Intuition, Uniswap, Aave).

---

# CZĘŚĆ 1: GLOBAL STYLES

## 1.1 Zaktualizuj `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   DESIGN SYSTEM - AGENTSCORE
   ============================================ */

:root {
  --background: 10 10 15;        /* #0A0A0F */
  --foreground: 255 255 255;
  --primary: 0 102 255;          /* #0066FF */
  --accent-cyan: 0 212 255;      /* #00D4FF */
  --accent-purple: 139 92 246;   /* #8B5CF6 */
}

/* ============================================
   BASE STYLES
   ============================================ */

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-[rgb(var(--background))] text-white antialiased;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}

/* Tight letter spacing for headlines */
.tracking-tighter {
  letter-spacing: -0.02em;
}

/* ============================================
   GLASSMORPHISM EFFECTS
   ============================================ */

.glass {
  @apply bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl;
}

.glass-hover {
  @apply hover:bg-white/10 hover:border-white/20 transition-all duration-300;
}

.glass-card {
  @apply bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl;
  box-shadow: 
    0 0 0 1px rgba(255,255,255,0.05) inset,
    0 20px 50px -20px rgba(0,0,0,0.5);
}

.glass-card-hover {
  @apply hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-500;
  &:hover {
    box-shadow: 
      0 0 0 1px rgba(255,255,255,0.1) inset,
      0 25px 60px -20px rgba(0,0,0,0.6),
      0 0 40px rgba(0,102,255,0.1);
  }
}

/* ============================================
   GRADIENT EFFECTS
   ============================================ */

.gradient-border {
  position: relative;
  background: linear-gradient(rgb(var(--background)), rgb(var(--background))) padding-box,
              linear-gradient(135deg, rgba(0,102,255,0.5), rgba(0,212,255,0.3), rgba(139,92,246,0.5)) border-box;
  border: 1px solid transparent;
}

.gradient-text {
  @apply bg-clip-text text-transparent;
  background-image: linear-gradient(135deg, #fff 0%, #0066FF 50%, #00D4FF 100%);
}

.gradient-text-animated {
  @apply bg-clip-text text-transparent;
  background-image: linear-gradient(90deg, #fff, #0066FF, #00D4FF, #8B5CF6, #fff);
  background-size: 200% auto;
  animation: gradient-shift 3s linear infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

/* ============================================
   GLOW EFFECTS
   ============================================ */

.glow-blue {
  box-shadow: 0 0 20px rgba(0,102,255,0.4), 0 0 40px rgba(0,102,255,0.2);
}

.glow-cyan {
  box-shadow: 0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.2);
}

.glow-subtle {
  box-shadow: 0 0 60px rgba(0,102,255,0.15);
}

/* Button glow on hover */
.btn-glow {
  @apply relative overflow-hidden;
  &::before {
    content: '';
    @apply absolute inset-0 opacity-0 transition-opacity duration-300;
    background: radial-gradient(circle at center, rgba(0,102,255,0.4) 0%, transparent 70%);
  }
  &:hover::before {
    @apply opacity-100;
  }
}

/* ============================================
   BACKGROUND EFFECTS
   ============================================ */

.bg-grid-pattern {
  background-image: 
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}

.bg-mesh-gradient {
  background: 
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(0,102,255,0.15) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 10%, rgba(139,92,246,0.1) 0%, transparent 50%),
    radial-gradient(ellipse 50% 30% at 10% 60%, rgba(0,212,255,0.08) 0%, transparent 50%),
    radial-gradient(ellipse 40% 40% at 90% 80%, rgba(0,102,255,0.08) 0%, transparent 50%);
}

.bg-noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.02;
}

/* ============================================
   FADE GRADIENTS
   ============================================ */

.fade-bottom {
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
}

.fade-top {
  mask-image: linear-gradient(to top, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 60%, transparent 100%);
}

/* ============================================
   ANIMATIONS
   ============================================ */

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(0,102,255,0.4); }
  50% { box-shadow: 0 0 40px rgba(0,102,255,0.6); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0.05) 50%,
    rgba(255,255,255,0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

/* ============================================
   SCROLLBAR
   ============================================ */

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}

/* ============================================
   SELECTION
   ============================================ */

::selection {
  background: rgba(0,102,255,0.3);
  color: white;
}
```

---

# CZĘŚĆ 2: NAVBAR Z SCROLL EFFECT

## 2.1 Utwórz/zaktualizuj `src/components/layout/Navbar.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Menu, 
  X, 
  Shield, 
  Plus,
  Command
} from 'lucide-react'
import { WalletButton } from '@/components/wallet/WalletButton'
import { SearchModal } from '@/components/shared/SearchModal'
import { cn } from '@/lib/cn'

const navLinks = [
  { href: '/agents', label: 'Explore' },
  { href: '/register', label: 'Register' },
  { href: '/docs', label: 'Docs' },
]

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
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors" />
                <Shield className="relative w-8 h-8 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Agent<span className="text-primary">Score</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    pathname === link.href
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
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded border border-white/10">
                    <Command className="w-3 h-3 inline" />
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded border border-white/10">
                    K
                  </kbd>
                </div>
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
                <span>Add Agent</span>
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
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'block px-4 py-3 rounded-xl text-base font-medium transition-all',
                      pathname === link.href
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
```

---

# CZĘŚĆ 3: SEARCH MODAL

## 3.1 Utwórz `src/components/shared/SearchModal.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Shield, Clock } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

// Mock search results - replace with real data
const recentSearches = ['OpenClaw Bot', 'Moltbook Agent', 'Trust Score API']
const popularAgents = [
  { id: '1', name: 'CodeHelper AI', score: 94, platform: 'moltbook' },
  { id: '2', name: 'DataAnalyst Pro', score: 87, platform: 'openclaw' },
  { id: '3', name: 'ContentWriter X', score: 78, platform: 'farcaster' },
]

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50"
          >
            <div className="glass-card overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-4 p-4 border-b border-white/10">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search agents, platforms, addresses..."
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-slate-500"
                />
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {/* Recent Searches */}
                {!query && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      Recent Searches
                    </div>
                    {recentSearches.map((search) => (
                      <button
                        key={search}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <Search className="w-4 h-4 text-slate-400" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular Agents */}
                <div className="p-2 mt-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <Shield className="w-3 h-3" />
                    {query ? 'Results' : 'Popular Agents'}
                  </div>
                  {popularAgents
                    .filter((agent) =>
                      agent.name.toLowerCase().includes(query.toLowerCase())
                    )
                    .map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        onClick={onClose}
                        className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-slate-400">{agent.platform}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm font-mono font-bold',
                            agent.score >= 70 ? 'text-emerald-400' : 'text-amber-400'
                          )}>
                            {agent.score}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↵</kbd>
                    Open
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded">esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

---

# CZĘŚĆ 4: HERO SECTION Z ANIMACJAMI

## 4.1 Utwórz/zaktualizuj `src/components/landing/Hero.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Sparkles, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

// Wave text animation - każda litera animuje się osobno
function WaveText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: i * 0.03,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  )
}

// Animated counter
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = value / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      setCurrent(Math.min(Math.round(increment * step), value))
      if (step >= steps) clearInterval(timer)
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  return (
    <span className="font-mono tabular-nums">
      {current.toLocaleString()}{suffix}
    </span>
  )
}

const stats = [
  { label: 'Active Agents', value: 770543, suffix: '' },
  { label: 'Avg Trust Score', value: 72.8, suffix: '' },
  { label: 'Total Staked', value: 2.3, suffix: 'M', prefix: '$' },
  { label: 'Attestations', value: 89432, suffix: '' },
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-purple/20 rounded-full blur-[128px] animate-float" style={{ animationDelay: '-3s' }} />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent-cyan/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-1.5s' }} />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        
        {/* Announcement Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/docs"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full',
              'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20',
              'text-sm font-medium transition-all duration-300 group'
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Built on Intuition Protocol</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Headline */}
        <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
          <WaveText text="Trust Score for" className="block text-white" />
          <WaveText text="AI Agents" className="block gradient-text-animated mt-2" />
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto"
        >
          Verify agent reputation before interaction. Decentralized trust verification 
          built on Intuition Protocol with economic attestations.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/agents"
            className={cn(
              'group flex items-center gap-2 px-8 py-4 rounded-xl',
              'bg-primary hover:bg-primary/90 text-white font-semibold',
              'transition-all duration-300 btn-glow glow-blue'
            )}
          >
            Explore Agents
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          
          <Link
            href="/register"
            className={cn(
              'flex items-center gap-2 px-8 py-4 rounded-xl',
              'glass glass-hover font-semibold'
            )}
          >
            Register Your Agent
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8"
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="glass-card p-6 text-center"
            >
              <div className="text-2xl sm:text-3xl font-bold text-white">
                {stat.prefix}
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Trust Score Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-20 flex justify-center"
        >
          <div className="relative">
            {/* Glow */}
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            
            {/* Score Ring */}
            <div className="relative glass-card p-8">
              <div className="flex items-center gap-8">
                {/* Large Score */}
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={283}
                      initial={{ strokeDashoffset: 283 }}
                      animate={{ strokeDashoffset: 283 * (1 - 0.87) }}
                      transition={{ duration: 1.5, delay: 1.2, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold font-mono text-emerald-400">87</span>
                  </div>
                </div>
                
                {/* Info */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Sample Agent</span>
                    <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">Verified</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Trust score based on 1,247 attestations
                  </div>
                  <div className="mt-3 flex gap-4 text-sm">
                    <span className="text-emerald-400">+$45.2K staked</span>
                    <span className="text-slate-400">128 stakers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[rgb(10,10,15)] to-transparent" />
    </section>
  )
}
```

---

# CZĘŚĆ 5: AGENT CARD Z ULEPSZENIAMI

## 5.1 Zaktualizuj `src/components/agents/AgentCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, ExternalLink, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Agent } from '@/types/agent'

interface AgentCardProps {
  agent: Agent
  index?: number
}

export function AgentCard({ agent, index = 0 }: AgentCardProps) {
  const trustColor = agent.trustScore >= 70 
    ? 'text-emerald-400' 
    : agent.trustScore >= 50 
      ? 'text-amber-400' 
      : 'text-red-400'

  const trustBg = agent.trustScore >= 70 
    ? 'from-emerald-500/20 to-cyan-500/20' 
    : agent.trustScore >= 50 
      ? 'from-amber-500/20 to-orange-500/20' 
      : 'from-red-500/20 to-rose-500/20'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link href={`/agents/${agent.id}`}>
        <div className={cn(
          'relative glass-card glass-card-hover p-6 h-full',
          'overflow-hidden'
        )}>
          {/* Gradient glow on hover */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            trustBg
          )} />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-cyan flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  {agent.verificationLevel !== 'none' && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[rgb(10,10,15)]">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg group-hover:text-white transition-colors">
                    {agent.name}
                  </h3>
                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-white/5 rounded-full">
                    {agent.platform}
                  </span>
                </div>
              </div>

              {/* Trust Score */}
              <div className="text-right">
                <div className={cn('text-2xl font-bold font-mono', trustColor)}>
                  {agent.trustScore}
                </div>
                <div className="text-xs text-slate-500">Trust Score</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Stakes:</span>
                <span className="font-mono text-white">
                  ${formatNumber(Number(agent.positiveStake))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Attestations:</span>
                <span className="font-mono text-white">{agent.attestationCount}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
                'transition-colors'
              )}>
                <Shield className="w-4 h-4" />
                Trust
              </button>
              <span className="flex items-center gap-1 text-sm text-slate-400 group-hover:text-white transition-colors">
                View Details
                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}
```

---

# CZĘŚĆ 6: LAYOUT WRAPPER

## 6.1 Upewnij się że layout.tsx ma prawidłową strukturę:

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgentScore | Trust Layer for AI Agents',
  description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}>
        <Providers>
          <div className="relative min-h-screen bg-[rgb(10,10,15)] text-white">
            {/* Background layers */}
            <div className="fixed inset-0 bg-mesh-gradient pointer-events-none" />
            <div className="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
            
            {/* Content */}
            <Navbar />
            <main className="relative z-10">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

---

# ✅ CHECKLIST PO IMPLEMENTACJI

Po wdrożeniu sprawdź:

- [ ] Dark background (#0A0A0F) jest widoczny
- [ ] Glassmorphism działa (blur, transparency)
- [ ] Navbar zmienia się przy scroll
- [ ] ⌘K otwiera search modal
- [ ] Wave text animation działa na Hero
- [ ] Stats mają animated counters
- [ ] Agent cards mają hover glow
- [ ] Grid pattern jest widoczny w tle
- [ ] Gradient orbs animują się (float)

---

# 🚀 JAK UŻYĆ

Wklej całą CZĘŚĆ po CZĘŚCI do Cursora:
1. Zacznij od CZĘŚĆ 1 (globals.css)
2. Potem CZĘŚĆ 2 (Navbar)
3. itd.

Po każdej części uruchom `npm run dev` i sprawdź czy działa.

---

**Ten prompt da Ci premium, modern, glassmorphism UI! 🎨**
