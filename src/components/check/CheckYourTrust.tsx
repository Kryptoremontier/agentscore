'use client'

import { useRouter } from 'next/navigation'
import { YourTrust } from '@/components/trust/YourTrust'

/** "Your trust" under the /check card (Etap 9c): after a withdrawal the server card is read again. */
export function CheckYourTrust({ agentId }: { agentId: string }) {
  const router = useRouter()
  return <YourTrust agentId={agentId} onChanged={() => router.refresh()} />
}
