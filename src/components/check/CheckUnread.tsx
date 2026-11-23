'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CouldNotRead } from '@/components/shared/CouldNotRead'

/** /check/[id] when the agent couldn't be read (Etap 9d): "Try again" reads it again on the server (the page is dynamic, never cached). */
export function CheckUnread({ attemptedAt }: { attemptedAt: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <CouldNotRead attemptedAt={attemptedAt} retrying={pending} onRetry={() => startTransition(() => router.refresh())} />
}
