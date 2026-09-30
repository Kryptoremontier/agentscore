'use client'

/**
 * The landing's example agent (the list's most vouched, lib/most-vouched.ts), as the Hero read it —
 * so the "For developers" block asks about the same agent without reading the list again.
 */

import { useSyncExternalStore } from 'react'

export interface HeroAgent { termId: string; name: string }

let current: HeroAgent | null | undefined // undefined = not read yet, null = the read failed
const listeners = new Set<() => void>()

export function setHeroAgent(agent: HeroAgent | null) {
  current = agent
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useHeroAgent(): HeroAgent | null | undefined {
  return useSyncExternalStore(subscribe, () => current, () => undefined)
}
