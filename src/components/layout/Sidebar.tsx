'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import {
  Bot, Zap, Trophy, Target, MessageSquare, Crown,
  PenSquare, BookOpen, User, Plus, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const EXPLORE_ITEMS = [
  { href: '/agents',     label: 'Agents',      icon: Bot,          color: '#C8963C' },
  { href: '/skills',     label: 'Skills',       icon: Zap,          color: '#2EE6D6' },
  { href: '/domains',    label: 'Domains',      icon: Trophy,       color: '#8B5CF6' },
  { href: '/claims',     label: 'Claims',       icon: MessageSquare, color: '#38B6FF' },
] as const

const ACTIVITY_ITEMS = [
  { href: '/evaluators', label: 'Evaluators',   icon: Target,       color: '#F59E0B' },
  { href: '/leaderboard', label: 'Leaderboard', icon: Crown,        color: '#C8963C' },
] as const

const INFO_ITEMS = [
  { href: '/docs', label: 'Docs', icon: BookOpen, color: '#7A838D' },
] as const

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

function NavLink({ href, label, icon: Icon, color, pathname }: { href: string; label: string; icon: React.ElementType; color: string; pathname: string }) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href.split('?')[0]))

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
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: color }}
        />
      )}
      <Icon
        className="w-5 h-5 shrink-0 transition-colors duration-150"
        style={{ color: active ? color : 'rgba(255,255,255,0.32)' }}
      />
      <span className={cn(
        'text-sm font-medium whitespace-nowrap transition-colors duration-150 leading-none',
        active ? 'text-white' : 'text-white/50 group-hover:text-white/80',
      )}>
        {label}
      </span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { address } = useAccount()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href.split('?')[0]))

  const registerActive = pathname?.startsWith('/register')

  return (
    <aside
      className="fixed left-0 top-16 lg:top-20 bottom-0 z-40 hidden md:flex flex-col w-56"
      style={{
        background: 'rgba(8,8,14,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-hide">

        {/* CREATE */}
        <GroupLabel label="Create" first />

        {/* Create Claim */}
        <Link
          href="/claims?create=true"
          className="relative flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg transition-colors duration-150 group hover:bg-white/[0.04]"
        >
          <Plus
            className="w-5 h-5 shrink-0 transition-colors duration-150"
            style={{ color: 'rgba(255,255,255,0.32)' }}
          />
          <span className="text-sm font-medium whitespace-nowrap text-white/50 group-hover:text-white/80 transition-colors leading-none">
            Create Claim
          </span>
        </Link>

        {/* Register accordion trigger */}
        <button
          onClick={() => setRegisterOpen(o => !o)}
          className={cn(
            'relative flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg w-[calc(100%-16px)]',
            'transition-colors duration-150 group',
            registerActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
            !registerActive ? 'border border-dashed border-[#C8963C]/25' : '',
          )}
        >
          {registerActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#C8963C]" />
          )}
          <PenSquare
            className="w-5 h-5 shrink-0 transition-colors duration-150"
            style={{ color: registerActive ? '#C8963C' : 'rgba(255,255,255,0.32)' }}
          />
          <span className={cn(
            'flex-1 text-left text-sm font-medium whitespace-nowrap transition-colors duration-150 leading-none',
            registerActive ? 'text-white' : 'text-[#C8963C]/70 group-hover:text-[#C8963C]',
          )}>
            Register
          </span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 mr-1 transition-transform duration-200',
              registerOpen ? 'rotate-180' : '',
              registerActive ? 'text-[#C8963C]/60' : 'text-white/20',
            )}
          />
        </button>

        {/* Register sub-items */}
        {registerOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            <Link
              href="/register"
              className={cn(
                'flex items-center gap-3 mx-2 px-2 py-2 rounded-lg transition-colors duration-150 group',
                isActive('/register') && !pathname.includes('tab=skill')
                  ? 'bg-white/[0.07]'
                  : 'hover:bg-white/[0.04]',
              )}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.25)' }}>
                <Bot className="w-3.5 h-3.5" style={{ color: '#C8963C' }} />
              </div>
              <span className={cn(
                'text-sm font-medium whitespace-nowrap transition-colors leading-none',
                isActive('/register') && !pathname.includes('tab=skill')
                  ? 'text-white'
                  : 'text-white/50 group-hover:text-white/80',
              )}>
                Agent
              </span>
            </Link>

            <Link
              href="/register?tab=skill"
              className={cn(
                'flex items-center gap-3 mx-2 px-2 py-2 rounded-lg transition-colors duration-150 group',
                pathname.includes('tab=skill') ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              )}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'rgba(46,230,214,0.10)', border: '1px solid rgba(46,230,214,0.22)' }}>
                <Zap className="w-3.5 h-3.5" style={{ color: '#2EE6D6' }} />
              </div>
              <span className={cn(
                'text-sm font-medium whitespace-nowrap transition-colors leading-none',
                pathname.includes('tab=skill') ? 'text-white' : 'text-white/50 group-hover:text-white/80',
              )}>
                Skill
              </span>
            </Link>
          </div>
        )}

        {/* EXPLORE */}
        <GroupLabel label="Explore" />
        {EXPLORE_ITEMS.map(item => <NavLink key={item.href} {...item} pathname={pathname} />)}

        {/* ACTIVITY */}
        <GroupLabel label="Activity" />
        {ACTIVITY_ITEMS.map(item => <NavLink key={item.href} {...item} pathname={pathname} />)}

        {/* INFO */}
        <GroupLabel label="Info" />
        {INFO_ITEMS.map(item => <NavLink key={item.href} {...item} pathname={pathname} />)}

      </div>

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
                isActive('/profile') ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              )}
            >
              <User
                className="w-5 h-5 shrink-0"
                style={{ color: isActive('/profile') ? '#C8963C' : 'rgba(255,255,255,0.32)' }}
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
