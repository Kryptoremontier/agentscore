/**
 * One accent word per headline (Etap 6b): the italic accent face (--font-accent, Instrument Serif)
 * in the accent colour, with a hand-drawn swash under it. The swash is our own: two strokes (never
 * a fill), the long one sweeping up at its end, a lighter one under it. It stretches with the
 * word's width and its height and stroke follow the font size (em), so it scales with the word.
 */

import type { ReactNode } from 'react'

export function AccentWord({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block font-accent italic font-normal tracking-normal text-[#C8963C] pr-[0.06em] ${className}`} data-accent-word>
      {children}
      <svg
        aria-hidden
        focusable="false"
        viewBox="0 0 300 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-[-0.04em] right-[-0.08em] bottom-[-0.2em] h-[0.3em] w-[calc(100%+0.12em)] overflow-visible"
        data-swash
      >
        <path
          d="M3 15 C 48 10, 96 7, 150 8 C 204 9, 252 12, 282 9 C 291 8, 296 5, 297 2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: '0.075em' }}
        />
        <path
          d="M34 21 C 96 16, 170 15, 246 18"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: '0.04em', opacity: 0.55 }}
        />
      </svg>
    </span>
  )
}
