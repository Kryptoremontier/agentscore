/**
 * The landing's shared parts (Etap 8b): the mono eyebrow with its small accent square, the accent
 * block for a headline's one key word, and the section frame. Server components — no JavaScript.
 *
 * Our type and colours (Etap 6b): Inter Tight at its heaviest for the uppercase display, JetBrains
 * Mono for eyebrows, the amber accent. Uppercase is CSS, so the words stay words for a screen reader.
 */

import { storyEyebrow } from '@/lib/people-copy'

/** "■ 01 / HOW IT WORKS" — mono, uppercase, the square in the accent. */
export function StoryEyebrow({ section, children }: { section?: { num: string; label: string }; children?: React.ReactNode }) {
  return (
    <p className="eyebrow inline-flex items-center gap-2 text-[#B5BDC6]" data-testid="story-eyebrow">
      <span aria-hidden className="inline-block w-2 h-2 bg-accent flex-shrink-0" />
      {section ? storyEyebrow(section) : children}
    </p>
  )
}

/** The one key word of a headline on a solid accent block (once per section at most). */
export function AccentBlock({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-accent text-[#0B0C0F] px-[0.14em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]" data-testid="accent-block">
      {children}
    </span>
  )
}

/** The display headline: Inter Tight, heaviest weight, uppercase, tight. */
export const DISPLAY = 'font-display font-black uppercase tracking-[-0.035em] leading-[0.95] text-white [text-wrap:balance]'

/** A numbered section: its eyebrow, its heading, its content. `id` is the anchor and the harness's handle. */
export function StorySection({ id, section, heading, children, className = '' }: {
  id: string
  section: { num: string; label: string }
  heading?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} data-section={id} className={`relative scroll-mt-20 py-16 sm:py-24 ${className}`}>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <StoryEyebrow section={section} />
        {heading && <h2 className={`mt-4 text-3xl sm:text-5xl ${DISPLAY}`}>{heading}</h2>}
        <div className="mt-8 sm:mt-12">{children}</div>
      </div>
    </section>
  )
}

/** Our dark glass — never an off-white card. */
export const GLASS = 'rounded-2xl border border-white/10 bg-[#111318]/85 backdrop-blur-md'
