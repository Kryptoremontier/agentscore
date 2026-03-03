'use client'

import { cn } from '@/lib/cn'

interface PageBackgroundProps {
  image?: 'hero' | 'diagonal' | 'symmetric' | 'wave'
  opacity?: number
  parallax?: boolean
  children: React.ReactNode
  className?: string
}

// Global background is set in layout.tsx (gold/background.png).
// This component is kept as a transparent wrapper for backward compatibility.
export function PageBackground({
  children,
  className
}: PageBackgroundProps) {
  return (
    <div className={cn('relative min-h-screen', className)}>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
