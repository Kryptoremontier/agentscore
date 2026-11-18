'use client'

/**
 * "Report a bug" in the footer (Etap 9): it was a button under the nav's More, on the sidebar and in
 * the phone's sheet; the nav is three places now, so the one way to report sits where every page
 * has it. Opens the same modal.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'

// Loaded on the first click: the footer is on every page, the modal (wallet hooks, a form) is rarely opened.
const BugReportModal = dynamic(() => import('@/components/shared/BugReportModal').then((m) => m.BugReportModal), { ssr: false })

export const REPORT_BUG_LABEL = 'Report a bug'

export function ReportBugLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} data-testid="report-bug">
        {REPORT_BUG_LABEL}
      </button>
      {open && <BugReportModal open onClose={() => setOpen(false)} />}
    </>
  )
}
