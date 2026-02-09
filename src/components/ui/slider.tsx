'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

interface SliderProps {
  value: [number, number]
  onValueChange: (value: [number, number]) => void
  min: number
  max: number
  step?: number
  className?: string
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  className,
}: SliderProps) {
  const [isDragging, setIsDragging] = React.useState<'min' | 'max' | null>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)

  const getPercentage = (val: number) => ((val - min) / (max - min)) * 100

  const handleMouseDown = (thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(thumb)
  }

  const updateValue = (clientX: number) => {
    if (!trackRef.current || !isDragging) return

    const rect = trackRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    let newValue = min + (percentage / 100) * (max - min)
    newValue = Math.round(newValue / step) * step

    if (isDragging === 'min') {
      onValueChange([Math.min(newValue, value[1] - step), value[1]])
    } else {
      onValueChange([value[0], Math.max(newValue, value[0] + step)])
    }
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValue(e.clientX)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, value])

  const minPercentage = getPercentage(value[0])
  const maxPercentage = getPercentage(value[1])

  return (
    <div className={cn('relative w-full h-6 flex items-center', className)}>
      {/* Track background */}
      <div
        ref={trackRef}
        className="absolute w-full h-2 bg-white/10 rounded-full cursor-pointer"
        onClick={(e) => {
          if (!isDragging) {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const clickPercentage = (clickX / rect.width) * 100
            const clickValue = min + (clickPercentage / 100) * (max - min)

            // Move closest thumb
            const distToMin = Math.abs(clickValue - value[0])
            const distToMax = Math.abs(clickValue - value[1])

            if (distToMin < distToMax) {
              onValueChange([Math.round(clickValue / step) * step, value[1]])
            } else {
              onValueChange([value[0], Math.round(clickValue / step) * step])
            }
          }
        }}
      >
        {/* Active range */}
        <div
          className="absolute h-full bg-gradient-to-r from-primary to-accent-cyan rounded-full"
          style={{
            left: `${minPercentage}%`,
            right: `${100 - maxPercentage}%`,
          }}
        />
      </div>

      {/* Min thumb */}
      <div
        className={cn(
          'absolute w-5 h-5 bg-white rounded-full shadow-lg cursor-grab',
          'border-2 border-primary transition-transform',
          isDragging === 'min' && 'scale-110 cursor-grabbing'
        )}
        style={{ left: `calc(${minPercentage}% - 10px)` }}
        onMouseDown={handleMouseDown('min')}
      />

      {/* Max thumb */}
      <div
        className={cn(
          'absolute w-5 h-5 bg-white rounded-full shadow-lg cursor-grab',
          'border-2 border-primary transition-transform',
          isDragging === 'max' && 'scale-110 cursor-grabbing'
        )}
        style={{ left: `calc(${maxPercentage}% - 10px)` }}
        onMouseDown={handleMouseDown('max')}
      />
    </div>
  )
}
