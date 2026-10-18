/**
 * The /check header and its one box (Etap 7 Run B) — on /check and on every card's permalink
 * (/check/[id]). A plain GET form: it works before any JS has loaded.
 */

import { CHECK_TITLE, CHECK_EYEBROW, CHECK_SUB, CHECK_LABEL, CHECK_PLACEHOLDER, CHECK_BUTTON } from '@/lib/people-copy'

export function CheckBox({ q = '' }: { q?: string }) {
  return (
    <>
      <p className="eyebrow eyebrow-slash text-accent">{CHECK_EYEBROW}</p>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-display leading-display text-white mt-2">{CHECK_TITLE}</h1>
      <p className="text-[#B5BDC6] mt-2">{CHECK_SUB}</p>

      <form action="/check" method="get" className="mt-6 flex flex-col sm:flex-row gap-2" role="search" data-testid="check-form">
        <label htmlFor="check-q" className="sr-only">{CHECK_LABEL}</label>
        <input
          id="check-q"
          name="q"
          defaultValue={q}
          placeholder={CHECK_PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          className="w-full sm:flex-1 min-w-0 h-12 rounded-sm border border-white/15 bg-[#0D0F13] px-4 text-white placeholder:text-[#5C6570] focus:outline-none focus:border-accent/70"
        />
        <button type="submit" className="btn-primary h-12 px-6">{CHECK_BUTTON}</button>
      </form>
      <p className="mt-2 text-xs text-[#7A838D]">{CHECK_LABEL}</p>
    </>
  )
}
