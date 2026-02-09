import { cn } from '@/lib/cn'

interface LoadingSkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  count?: number
}

export function LoadingSkeleton({
  className,
  variant = 'text',
  width,
  height,
  count = 1,
}: LoadingSkeletonProps) {
  const baseClasses = 'shimmer bg-white/10'

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const style = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'circular' ? width : undefined),
  }

  if (count > 1) {
    return (
      <div className="space-y-2">
        {[...Array(count)].map((_, i) => (
          <div
            key={i}
            className={cn(baseClasses, variantClasses[variant], className)}
            style={style}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
    />
  )
}

// Specific skeleton components
export function AgentCardSkeleton() {
  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <LoadingSkeleton variant="circular" width={48} />
          <div className="space-y-2">
            <LoadingSkeleton width={128} />
            <LoadingSkeleton width={80} />
          </div>
        </div>
        <LoadingSkeleton variant="circular" width={40} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <LoadingSkeleton width={64} />
          <LoadingSkeleton width={96} />
        </div>
        <div className="space-y-1">
          <LoadingSkeleton width={64} />
          <LoadingSkeleton width={80} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <LoadingSkeleton height={36} className="flex-1" />
        <LoadingSkeleton width={80} height={36} />
      </div>
    </div>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton variant="text" width={200} height={32} />
      <LoadingSkeleton variant="text" width={400} />
    </div>
  )
}