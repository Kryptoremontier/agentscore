'use client'

/**
 * In-app notices (lib/user-notice.ts) — where the old native browser dialogs went. Bottom of the screen,
 * above the mobile nav, one at a time (a newer notice replaces the older). Info fades after 5 s;
 * an error stays until dismissed or 12 s pass, so there is time to read it and follow its link.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Info, X, ExternalLink } from 'lucide-react'
import type { Notice } from '@/lib/user-notice'

interface NoticeApi {
  notify: (notice: Notice) => void
}

const NoticeContext = createContext<NoticeApi | null>(null)

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<(Notice & { id: number }) | null>(null)
  const seq = useRef(0)
  const notify = useCallback((n: Notice) => setNotice({ ...n, id: ++seq.current }), [])
  const api = useMemo(() => ({ notify }), [notify])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice((cur) => (cur?.id === notice.id ? null : cur)), notice.kind === 'error' ? 12_000 : 5_000)
    return () => clearTimeout(t)
  }, [notice])

  const error = notice?.kind === 'error'
  return (
    <NoticeContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            role={error ? 'alert' : 'status'}
            data-testid="app-notice"
            data-kind={notice.kind}
            className="fixed left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[120]"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          >
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl"
              style={error
                ? { background: '#2a1416', border: '1px solid rgba(239,68,68,0.4)' }
                : { background: '#161b22', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {error
                ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                : <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#B5BDC6' }} />}
              <div className="min-w-0 flex-1 text-sm text-white">
                <p className="break-words">{notice.text}</p>
                {notice.link && (
                  <a
                    href={notice.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 underline underline-offset-2"
                    style={{ color: '#C8963C' }}
                  >
                    {notice.link.label} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 rounded hover:bg-white/10">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NoticeContext.Provider>
  )
}

export function useNotice(): NoticeApi {
  const api = useContext(NoticeContext)
  if (!api) throw new Error('useNotice needs <NoticeProvider> (app/providers.tsx)')
  return api
}
