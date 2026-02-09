import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
}

export function GlassCard({
  children,
  className,
  hover = false,
  gradient = false,
}: GlassCardProps) {
  return (
    <div className={cn(
      'glass rounded-xl p-6',
      hover && 'glass-hover',
      gradient && 'gradient-border',
      className
    )}>
      {children}
    </div>
  )
}