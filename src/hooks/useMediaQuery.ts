'use client'

import { useEffect, useState } from 'react'

/** Tailwind's `md` breakpoint — the desktop layout starts here. */
export const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * Whether a media query matches: null until mounted (unknown — render neither variant), then
 * kept in sync. For UI that must exist ONCE per page in one of two places (Etap 5a: the attest
 * CTA is the sticky bar on a phone, inline on desktop) — CSS `hidden md:block` keeps both in the DOM.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

// Preset breakpoints (unknown before mount → false, as before).
export const useBreakpoint = () => {
  const isMobile = useMediaQuery('(max-width: 639px)') === true
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)') === true
  const isDesktop = useMediaQuery('(min-width: 1024px)') === true

  return {
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen: isMobile || isTablet,
  }
}
