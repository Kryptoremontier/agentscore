'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { cn } from '@/lib/cn'

interface PageBackgroundProps {
  image?: 'hero' | 'diagonal' | 'symmetric' | 'wave'
  opacity?: number
  parallax?: boolean
  children: React.ReactNode
  className?: string
}

const backgroundImages: Record<string, string> = {
  hero: '/images/backgrounds/hero-bg.jpg',
  diagonal: '/images/backgrounds/diagonal-bg.jpg',
  symmetric: '/images/backgrounds/symmetric-bg.jpg',
  wave: '/images/backgrounds/wave-bg.jpg',
}

export function PageBackground({
  image = 'hero',
  opacity = 0.5,
  parallax = true,
  children,
  className
}: PageBackgroundProps) {
  const { scrollY } = useScroll()
  const backgroundY = useTransform(scrollY, [0, 1000], [0, 300])

  return (
    <div className={cn('relative min-h-screen', className)}>
      {/* FIXED Background - stays in place while scrolling */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        {/* Background Image with Parallax */}
        {parallax ? (
          <motion.div
            className="absolute inset-0"
            style={{ y: backgroundY }}
          >
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center scale-110"
              style={{
                backgroundImage: `url(${backgroundImages[image]})`,
                opacity: opacity,
              }}
            />
          </motion.div>
        ) : (
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${backgroundImages[image]})`,
              opacity: opacity,
            }}
          />
        )}

        {/* Gradient Overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/80 via-[rgb(10,10,15)]/50 to-[rgb(10,10,15)]/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(10,10,15)]/40 via-transparent to-[rgb(10,10,15)]/40" />

        {/* Animated subtle glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-purple-500/5"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Vignette effect */}
        <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.8)]" />
      </div>

      {/* Content - higher z-index */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
