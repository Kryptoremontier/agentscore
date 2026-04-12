'use client'

import { Hammer } from 'lucide-react'

interface ForgeBadgeProps {
  trustScore?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: { pad: 'px-2 py-1',   text: 'text-xs',  icon: 'w-3 h-3'   },
  md: { pad: 'px-3 py-1.5', text: 'text-sm',  icon: 'w-3.5 h-3.5' },
  lg: { pad: 'px-4 py-2',   text: 'text-base', icon: 'w-4 h-4'   },
}

export function ForgeBadge({ trustScore, size = 'md', className = '' }: ForgeBadgeProps) {
  const s = SIZE_MAP[size]
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg ${s.pad} ${s.text} ${className}`}
      style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.22)' }}
    >
      <Hammer className={s.icon} style={{ color: '#C8963C' }} />
      <span style={{ color: 'rgba(200,150,60,0.85)' }} className="font-medium">
        Listed on IntuForge
      </span>
      {trustScore !== undefined && (
        <>
          <span className="w-px h-3.5" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <span className="font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{trustScore}</span>
        </>
      )}
    </div>
  )
}

