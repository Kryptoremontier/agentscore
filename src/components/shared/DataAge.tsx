'use client'

/**
 * "Updated N min ago", from an absolute read time (Etap 8b). A page the server regenerates (ISR) is
 * served for a while after it was built, so the age is counted again in the browser: from the read
 * time to now, every minute — never the age frozen at build time. The full time is its title.
 */

import { useEffect, useState } from 'react'
import { updatedAgoLabel } from '@/lib/agents-page-types'

export function DataAge({ readAt, className = '' }: { readAt: string; className?: string }) {
  const ageAt = (now: number) => Math.max(0, Math.floor((now - Date.parse(readAt)) / 1000))
  const [age, setAge] = useState(() => ageAt(Date.now()))
  useEffect(() => {
    let cancelled = false
    const tick = () => { if (!cancelled) setAge(ageAt(Date.now())) }
    tick()
    const id = setInterval(tick, 60_000)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAt])
  return (
    <span className={className} title={readAt} data-testid="data-age" data-read-at={readAt} suppressHydrationWarning>
      {updatedAgoLabel(age)}
    </span>
  )
}
