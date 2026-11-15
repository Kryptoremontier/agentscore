/** An agent's initials on an amber tile (Etap 8b) — the landing's ranked lists and /domains?context=. */

import { initialsOf } from '@/lib/landing-story'

export function InitialsTile({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-lg bg-accent text-[#0B0C0F] font-display font-black tracking-[-0.02em] ${size === 'lg' ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base'}`}
    >
      {initialsOf(name)}
    </span>
  )
}
