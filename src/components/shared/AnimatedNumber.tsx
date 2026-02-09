'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { cn } from '@/lib/cn'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  format?: (value: number) => string
}

export function AnimatedNumber({
  value,
  duration = 1,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  format,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, latest => {
    const formatted = decimals > 0
      ? latest.toFixed(decimals)
      : Math.round(latest).toString()

    if (format) {
      return format(parseFloat(formatted))
    }

    // Add thousand separators
    const parts = formatted.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  })

  useEffect(() => {
    const animation = animate(motionValue, value, {
      duration,
      ease: 'easeOut',
    })

    return animation.stop
  }, [motionValue, value, duration])

  return (
    <span ref={ref} className={cn('font-mono tabular-nums', className)}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  )
}

// Counter with + or - animation
export function AnimatedChange({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const isPositive = value > 0
  const formatted = Math.abs(value).toFixed(1)

  return (
    <motion.span
      initial={{ opacity: 0, y: isPositive ? 10 : -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: isPositive ? -10 : 10 }}
      className={cn(
        'font-mono font-semibold',
        isPositive ? 'text-trust-good' : 'text-trust-critical',
        className
      )}
    >
      {isPositive ? '+' : '-'}{formatted}%
    </motion.span>
  )
}