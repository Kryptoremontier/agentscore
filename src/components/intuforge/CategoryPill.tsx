'use client'

import { cn } from '@/lib/cn'
import { ForgeCategory, FORGE_CATEGORIES } from '@/lib/forge/types'

// Hex color lookup built from FORGE_CATEGORIES tailwind class → hex for inline styles
const CATEGORY_HEX_MAP: Record<string, { text: string; bg: string; border: string }> = {
  'text-purple-400':  { text: '#c084fc', bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.25)' },
  'text-amber-400':   { text: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)'  },
  'text-blue-400':    { text: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)'  },
  'text-pink-400':    { text: '#f472b6', bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.25)' },
  'text-cyan-400':    { text: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.25)'  },
  'text-emerald-400': { text: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)'  },
  'text-orange-400':  { text: '#fb923c', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.25)'  },
  'text-slate-400':   { text: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)' },
  'text-violet-400':  { text: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)' },
  'text-yellow-400':  { text: '#facc15', bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.25)'  },
  'text-red-400':     { text: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)' },
  'text-white/40':    { text: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
}

const LEGACY_CATEGORY_MAP: Record<string, ForgeCategory> = {
  tooling: ForgeCategory.DEVELOPER_TOOLS,
  gaming:  ForgeCategory.GAMING_NFT,
  data:    ForgeCategory.DATA_ANALYTICS,
  infra:   ForgeCategory.INFRASTRUCTURE,
}

export function mapLegacyCategory(cat: string): ForgeCategory {
  return (LEGACY_CATEGORY_MAP[cat] ?? cat) as ForgeCategory
}

function getCategoryDef(raw: string) {
  const id = mapLegacyCategory(raw)
  return FORGE_CATEGORIES.find(c => c.id === id) ?? FORGE_CATEGORIES[FORGE_CATEGORIES.length - 1]
}

interface CategoryPillProps {
  category: ForgeCategory | string
  size?: 'sm' | 'md'
  className?: string
}

export function CategoryPill({ category, size = 'sm', className }: CategoryPillProps) {
  const def = getCategoryDef(category as string)
  const hex = CATEGORY_HEX_MAP[def.color] ?? CATEGORY_HEX_MAP['text-white/40']

  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const padding  = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  const iconSize = size === 'sm' ? 'text-[11px]' : 'text-xs'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg font-medium',
        padding, textSize, className,
      )}
      style={{ color: hex.text, background: hex.bg, border: `1px solid ${hex.border}` }}
    >
      <span className={iconSize}>{def.icon}</span>
      {def.label}
    </span>
  )
}
