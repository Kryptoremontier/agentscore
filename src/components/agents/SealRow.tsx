'use client'

/**
 * Three seals — the path to Verified (Etap 6). Verified takes three people, so the row always has
 * three slots (components/agents/seal-slots.ts): a filled seal per distinct live person who vouches,
 * most tTRUST behind the vouch first, the person by name (PersonName: ENS, else the short hex) and
 * the area; an open slot is a dashed ring. More than three: three filled and "and N more". A failed
 * read shows no slots — the surface's own unread line already says so (REPO_MAP §7 rule 5).
 *
 * The words stay: the row is the picture beside the people line, never instead of it.
 * sm — the /agents card and list row: rings only; the names for screen readers, the area on hover.
 * md — the landing's example card: a column per slot — ring, then name and area under it.
 * lg — the modal and the profile, under the stat row: the same columns, in tiles, a larger ring.
 */

import { Check } from 'lucide-react'
import type { AttesterSummary } from '@/lib/agent-profile'
import { SEAL_OPEN, sealsMore, sealRowLabel, sealAreas } from '@/lib/people-copy'
import { PersonName } from '@/components/shared/PersonName'
import { sealSlots, SEAL_SLOTS } from './seal-slots'

type Size = 'sm' | 'md' | 'lg'

const RING: Record<Size, { box: string; icon: string }> = {
  sm: { box: 'w-3.5 h-3.5', icon: 'w-2 h-2' },
  md: { box: 'w-5 h-5', icon: 'w-3 h-3' },
  lg: { box: 'w-7 h-7', icon: 'w-3.5 h-3.5' },
}

function Ring({ size, kind }: { size: Size; kind: 'filled' | 'open' | 'loading' }) {
  const box = `${RING[size].box} flex-shrink-0 rounded-full`
  if (kind === 'loading') return <span aria-hidden className={`${box} inline-block bg-white/[0.08] animate-pulse`} />
  if (kind === 'open') return <span aria-hidden className={`${box} inline-block border border-dashed border-accent/40`} />
  return (
    <span aria-hidden className={`${box} inline-flex items-center justify-center bg-accent/15 border border-accent/70`}>
      <Check className={`${RING[size].icon} text-accent`} strokeWidth={3} />
    </span>
  )
}

export function SealRow({ attesters, size, className = '' }: {
  /** summarizeAttesters(entries); undefined = not read yet, null = the read failed. */
  attesters: readonly AttesterSummary[] | null | undefined
  size: Size
  className?: string
}) {
  const slots = sealSlots(attesters)
  const common = { 'data-testid': 'seal-row', 'data-size': size, 'data-state': slots.state }

  if (slots.state === 'unread') return <span {...common} hidden />

  if (slots.state === 'loading') {
    const rings = Array.from({ length: SEAL_SLOTS }, (_, i) => <Ring key={i} size={size} kind="loading" />)
    if (size !== 'sm') {
      // The columns' own height while loading, so nothing moves when the read answers.
      const cell = size === 'lg'
        ? 'bg-[#171A1D] border border-accent/15 rounded-xl px-2 py-2.5 flex flex-col items-center gap-1.5'
        : 'flex flex-col items-center gap-1 py-0.5'
      return (
        <div {...common} aria-busy className={`grid grid-cols-3 ${size === 'lg' ? 'gap-2' : 'gap-1.5'} ${className}`}>
          {rings.map((r, i) => (
            <div key={i} className={cell}>
              {r}
              <span aria-hidden className="h-3.5 w-16 max-w-full rounded bg-white/[0.06] animate-pulse" />
              <span aria-hidden className="h-3 w-12 max-w-full rounded bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      )
    }
    return <span {...common} aria-busy className={`inline-flex items-center gap-1 ${className}`}>{rings}</span>
  }

  const label = sealRowLabel(slots.total, SEAL_SLOTS)
  const open = Array.from({ length: slots.open }, (_, i) => i)

  if (size === 'sm') {
    return (
      <span {...common} role="group" aria-label={label} className={`inline-flex items-center gap-1 flex-shrink-0 ${className}`}>
        {slots.filled.map((a) => (
          <span key={a.wallet} data-seal="filled" className="inline-flex" title={sealAreas(a.domains)}>
            <Ring size="sm" kind="filled" />
            <span className="sr-only"><PersonName wallet={a.wallet} />, {sealAreas(a.domains)}</span>
          </span>
        ))}
        {open.map((i) => (
          <span key={`open-${i}`} data-seal="open" className="inline-flex"><Ring size="sm" kind="open" /></span>
        ))}
        {slots.more > 0 && (
          <span className="text-[10px] leading-none text-[#7A838D]" data-seal="more" title={sealsMore(slots.more)}>
            <span aria-hidden>+{slots.more}</span><span className="sr-only">{sealsMore(slots.more)}</span>
          </span>
        )}
      </span>
    )
  }

  if (size === 'md') {
    return (
      <div {...common} className={className}>
        <ul aria-label={label} className="grid grid-cols-3 gap-1.5">
          {slots.filled.map((a) => (
            <li key={a.wallet} data-seal="filled" className="flex flex-col items-center text-center min-w-0 py-0.5">
              <Ring size="md" kind="filled" />
              <PersonName wallet={a.wallet} className="mt-1 block max-w-full truncate font-mono text-[11px] leading-4 text-[#B5BDC6]" />
              <span className="block max-w-full truncate text-[10px] leading-[14px] text-[#7A838D]" title={sealAreas(a.domains)}>{sealAreas(a.domains)}</span>
            </li>
          ))}
          {open.map((i) => (
            <li key={`open-${i}`} data-seal="open" className="flex flex-col items-center text-center py-0.5">
              <Ring size="md" kind="open" />
              <span className="mt-1 text-xs leading-4 text-[#7A838D]">{SEAL_OPEN}</span>
              <span aria-hidden className="text-[10px] leading-[14px]">&nbsp;</span>
            </li>
          ))}
        </ul>
        {slots.more > 0 && <p className="mt-1 text-right text-xs text-[#7A838D]" data-seal="more">{sealsMore(slots.more)}</p>}
      </div>
    )
  }

  return (
    <div {...common} className={className}>
      <ul aria-label={label} className="grid grid-cols-3 gap-2">
        {slots.filled.map((a) => (
          <li key={a.wallet} data-seal="filled" className="bg-[#171A1D] border border-accent/15 rounded-xl px-2 py-2.5 flex flex-col items-center text-center min-w-0">
            <Ring size="lg" kind="filled" />
            <PersonName wallet={a.wallet} className="mt-1.5 block max-w-full truncate font-mono text-xs text-white" />
            <span className="block max-w-full truncate text-[10px] text-[#7A838D]" title={sealAreas(a.domains)}>{sealAreas(a.domains)}</span>
          </li>
        ))}
        {open.map((i) => (
          <li key={`open-${i}`} data-seal="open" className="border border-dashed border-accent/25 rounded-xl px-2 py-2.5 flex flex-col items-center text-center">
            <Ring size="lg" kind="open" />
            <span className="mt-1.5 text-xs text-[#7A838D]">{SEAL_OPEN}</span>
            <span aria-hidden className="text-[10px]">&nbsp;</span>
          </li>
        ))}
      </ul>
      {slots.more > 0 && <p className="mt-1.5 text-right text-xs text-[#7A838D]" data-seal="more">{sealsMore(slots.more)}</p>}
    </div>
  )
}
