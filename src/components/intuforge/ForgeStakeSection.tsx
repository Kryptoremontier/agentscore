'use client'

/**
 * ForgeStakeSection — thin client wrapper for ForgeStakeButtons on the project
 * profile page (server component). Calls router.refresh() after a successful
 * stake so the server re-fetches updated staker count / trust score.
 */

import { useRouter } from 'next/navigation'
import { ForgeStakeButtons } from './ForgeStakeButtons'

interface ForgeStakeSectionProps {
  atomId: string
  counterTermId?: string | null
  projectName: string
}

export function ForgeStakeSection({ atomId, counterTermId, projectName }: ForgeStakeSectionProps) {
  const router = useRouter()
  return (
    <ForgeStakeButtons
      atomId={atomId}
      counterTermId={counterTermId}
      projectName={projectName}
      onStakeSuccess={() => router.refresh()}
    />
  )
}
