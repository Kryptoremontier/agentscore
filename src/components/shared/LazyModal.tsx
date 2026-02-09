'use client'

import { lazy, Suspense } from 'react'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

// Lazy load heavy modal components
// TODO: Uncomment when modals are implemented
// export const RegisterAgentModal = lazy(() =>
//   import('@/components/agents/RegisterAgentModal').then(mod => ({
//     default: mod.RegisterAgentModal
//   }))
// )

// export const StakeModal = lazy(() =>
//   import('@/components/trust/StakeModal').then(mod => ({
//     default: mod.StakeModal
//   }))
// )

// export const ReportModal = lazy(() =>
//   import('@/components/trust/ReportModal').then(mod => ({
//     default: mod.ReportModal
//   }))
// )

// Modal wrapper with suspense boundary
export function LazyModalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSkeleton className="fixed inset-0 bg-black/50 z-50" />}>
      {children}
    </Suspense>
  )
}