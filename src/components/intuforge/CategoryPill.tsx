'use client'

import {
  Bot, Shield, Coins, Globe, Fingerprint, BarChart2,
  Wrench, Server, Target, ScrollText, Gamepad2, Layers,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ForgeCategory, FORGE_CATEGORIES } from '@/lib/forge/types'

// ─── Icon map ──────────────────────────────────────────────────────────────────

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'bot':         Bot,
  'shield':      Shield,
  'coins':       Coins,
  'globe':       Globe,
  'fingerprint': Fingerprint,
  'bar-chart-2': BarChart2,
  'wrench':      Wrench,
  'server':      Server,
  'target':      Target,
  'scroll-text': ScrollText,
  'gamepad-2':   Gamepad2,
  'layers':      Layers,
}

// ─── Color map: tailwind class → hex values for inline styles ─────────────────

export const CATEGORY_HEX: Record<string, { text: string; bg: string; border: string; rgb: string }> = {
  'text-purple-400':  { text: '#c084fc', bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.25)', rgb: '192,132,252' },
  'text-amber-400':   { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  rgb: '251,191,36'  },
  'text-blue-400':    { text: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)',  rgb: '96,165,250'  },
  'text-pink-400':    { text: '#f472b6', bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.25)', rgb: '244,114,182' },
  'text-cyan-400':    { text: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.25)',  rgb: '34,211,238'  },
  'text-emerald-400': { text: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)',  rgb: '52,211,153'  },
  'text-orange-400':  { text: '#fb923c', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.25)',  rgb: '251,146,60'  },
  'text-slate-400':   { text: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', rgb: '148,163,184' },
  'text-violet-400':  { text: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', rgb: '167,139,250' },
  'text-yellow-400':  { text: '#facc15', bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.25)',  rgb: '250,204,21'  },
  'text-red-400':     { text: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', rgb: '248,113,113' },
  'text-white/40':    { text: 'rgba(255,255,255,0.40)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)', rgb: '255,255,255' },
}

// ─── Legacy ID mapping ────────────────────────────────────────────────────────

const LEGACY_MAP: Record<string, ForgeCategory> = {
  tooling: ForgeCategory.DEVELOPER_TOOLS,
  gaming:  ForgeCategory.GAMING_NFT,
  data:    ForgeCategory.DATA_ANALYTICS,
  infra:   ForgeCategory.INFRASTRUCTURE,
}

export function mapLegacyCategory(cat: string): ForgeCategory {
  return (LEGACY_MAP[cat] ?? cat) as ForgeCategory
}

function getCategoryDef(raw: string) {
  const id = mapLegacyCategory(raw)
  return FORGE_CATEGORIES.find(c => c.id === id) ?? FORGE_CATEGORIES[FORGE_CATEGORIES.length - 1]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CategoryPillProps {
  category: ForgeCategory | string
  size?: 'sm' | 'md'
  className?: string
}

export function CategoryPill({ category, size = 'sm', className }: CategoryPillProps) {
  const def   = getCategoryDef(category as string)
  const hex   = CATEGORY_HEX[def.color] ?? CATEGORY_HEX['text-white/40']
  const Icon  = CATEGORY_ICON_MAP[def.icon] ?? Layers

  const iconSize = size === 'sm' ? 'w-3 h-3'   : 'w-3.5 h-3.5'
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const padding  = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg font-medium',
        padding, textSize, className,
      )}
      style={{ color: hex.text, background: hex.bg, border: `1px solid ${hex.border}` }}
    >
      <Icon className={iconSize} style={{ color: hex.text }} />
      {def.label}
    </span>
  )
}

// ─── Icon square (used in cards & registration form) ─────────────────────────

interface CategoryIconSquareProps {
  category: ForgeCategory | string
  /** Container size in px */
  size?: number
  /** Icon size Tailwind class */
  iconClass?: string
  className?: string
}

export function CategoryIconSquare({
  category,
  size = 40,
  iconClass = 'w-5 h-5',
  className,
}: CategoryIconSquareProps) {
  const def  = getCategoryDef(category as string)
  const hex  = CATEGORY_HEX[def.color] ?? CATEGORY_HEX['text-white/40']
  const Icon = CATEGORY_ICON_MAP[def.icon] ?? Layers

  return (
    <div
      className={cn('rounded-xl flex items-center justify-center shrink-0', className)}
      style={{
        width:     size,
        height:    size,
        background: `rgba(${hex.rgb},0.12)`,
        border:    `1px solid rgba(${hex.rgb},0.28)`,
        boxShadow: `0 0 14px rgba(${hex.rgb},0.15)`,
      }}
    >
      <Icon className={iconClass} style={{ color: hex.text }} />
    </div>
  )
}
