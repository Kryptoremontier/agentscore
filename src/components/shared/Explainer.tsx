'use client'

/**
 * "?" — one short explainer at the point of use (Etap 6): a newcomer meets "vouch", the tier
 * names, "backing score" and "tTRUST" on the modal, the profile and the landing, and the answer
 * is one click away, next to the word (lib/people-copy.ts EXPLAINERS) — never a separate FAQ page.
 *
 * Both are an <InfoPopover>: a real <button> (with an aria-label when its text isn't its name);
 * Enter / Space opens it (a native button), Esc or a click outside closes it and Esc gives focus
 * back to the button. The panel is portalled to <body> and kept inside the viewport (a card's
 * overflow can't clip it); it follows the button when the page or the modal scrolls. Its focus
 * moves into the panel so a link inside it (tTRUST → the Intuition Hub) is the next Tab; leaving
 * the panel closes it and returns to the button.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EXPLAINERS, type ExplainerTerm } from '@/lib/people-copy'

const PANEL_W = 288
const GAP = 6
const EDGE = 8

export function InfoPopover({ label, button: buttonContent, nameFromContent = false, buttonClassName, testId, term, children }: {
  /** The panel's name, and the button's too unless its own text names it (nameFromContent). */
  label: string
  button: ReactNode
  /** true when the button's text is its accessible name (a line of words, not a "?"). */
  nameFromContent?: boolean
  buttonClassName: string
  testId: string
  term?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  const place = useCallback(() => {
    const b = button.current
    if (!b) return
    const r = b.getBoundingClientRect()
    const width = Math.min(PANEL_W, window.innerWidth - 2 * EDGE)
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE)
    const h = panel.current?.offsetHeight ?? 0
    // Below the button; above it when there is no room below.
    const below = r.bottom + GAP
    const top = h && below + h > window.innerHeight - EDGE && r.top - GAP - h >= EDGE ? r.top - GAP - h : below
    setPos({ top, left, width })
  }, [])

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }, [])

  // Measure once the panel exists (its height decides above/below), then hand it the focus.
  useLayoutEffect(() => {
    if (!open) return
    place()
    panel.current?.focus({ preventScroll: true })
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.stopPropagation() // Esc closes the explainer, not the dialog or page behind it
      close(true)
    }
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node
      if (panel.current?.contains(t) || button.current?.contains(t)) return
      close(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place, close])

  const toggle = (ev: MouseEvent) => {
    ev.stopPropagation() // a card's own click opens its agent; this click only explains
    ev.preventDefault() //  and inside a link it must not follow it
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={nameFromContent ? undefined : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-testid={testId}
        data-term={term}
        className={buttonClassName}
      >
        {buttonContent}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          data-testid={`${testId}-panel`}
          data-term={term}
          onBlur={(ev) => {
            const next = ev.relatedTarget as Node | null
            if (next && (panel.current?.contains(next) || button.current?.contains(next))) return
            if (next) close(false)
          }}
          onKeyDown={(ev) => {
            // Tab past the panel's end (or Shift+Tab before it): back to the button, closed.
            if (ev.key !== 'Tab') return
            const links = panel.current?.querySelectorAll('a') ?? []
            const last = links[links.length - 1]
            const leaving = ev.shiftKey ? document.activeElement === panel.current : !last || document.activeElement === last
            if (leaving) { ev.preventDefault(); close(true) }
          }}
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? PANEL_W, zIndex: 100 }}
          className="rounded-xl border border-[#C8963C]/25 bg-[#0F1113] px-3.5 py-3 text-left text-xs leading-relaxed text-[#B5BDC6] shadow-[0_8px_30px_rgba(0,0,0,0.5)] outline-none"
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}

export function Explainer({ term, className = '' }: { term: ExplainerTerm; className?: string }) {
  const e = EXPLAINERS[term]
  // The link, if any, is written into the sentence (people-copy keeps the whole sentence).
  const [before, after] = e.link ? e.text.split(e.link.text) : [e.text, '']
  return (
    <InfoPopover
      label={e.label}
      button="?"
      testId="explainer"
      term={term}
      buttonClassName={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} z-10 inline-flex items-center justify-center w-4 h-4 flex-shrink-0 rounded-full border border-[#C8963C]/40 text-[#C8963C] text-[10px] font-bold leading-none align-middle hover:bg-[#C8963C]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963C]/60 ${className}`}
    >
      {before}
      {e.link && (
        <a href={e.link.href} target="_blank" rel="noopener noreferrer" className="text-[#C8963C] underline underline-offset-2 hover:text-[#E8B84B]">
          {e.link.text}
        </a>
      )}
      {after}
    </InfoPopover>
  )
}
