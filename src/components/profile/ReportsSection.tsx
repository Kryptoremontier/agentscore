'use client'

/**
 * REPORTS — the negative side of the canonical unit (thesis §4 rule 4):
 * [agent] reported for [safety category] + stake. Same visibility
 * discipline as attestations: who reported, with how much.
 *
 * Empty state is ONE honest line — "No reports on-chain" — phrased as the
 * absence of report claims, never as a safety verdict (thesis §6/§9).
 * Collapsed/secondary by design so it never dominates an unreported profile.
 */

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { truncateWallet } from '@/lib/attestation-reader'
import type { AgentReport } from '@/lib/agent-profile'

interface ReportsSectionProps {
  reports: AgentReport[]
  loading: boolean
  className?: string
}

const fmt = (wei: bigint) => (Number(wei) / 1e18).toFixed(4)

export function ReportsSection({ reports, loading, className }: ReportsSectionProps) {
  const [open, setOpen] = useState(false)

  if (loading) {
    return <div className={`h-8 rounded-lg bg-white/[0.03] animate-pulse ${className ?? ''}`} />
  }

  if (reports.length === 0) {
    return (
      <p className={`text-[11px] text-[#7A838D] flex items-center gap-1.5 ${className ?? ''}`} data-testid="reports-empty">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4A5260]" />
        No reports on-chain
        <span className="text-[#4A5260]">· no <code className="font-mono">reported for</code> claims exist for this atom — not a vetting result</span>
      </p>
    )
  }

  return (
    <div className={`rounded-xl border ${className ?? ''}`} style={{ background: 'rgba(249,115,22,0.05)', borderColor: 'rgba(249,115,22,0.3)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#f97316' }}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {reports.length} report{reports.length !== 1 ? 's' : ''} on-chain
        </span>
        <span className="text-[#7A838D]">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-white/[0.06] pt-2">
          {reports.map((r) => (
            <div key={r.tripleId} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold uppercase text-[10px]" style={{ color: '#f97316' }}>{r.category}</span>
                <span className="text-[#30363d]">·</span>
                <Link href={`/profile/${r.reporter}`} className="font-mono text-[#C8963C] hover:underline" title={r.reporter}>
                  by {r.reporterLabel?.includes('.eth') ? r.reporterLabel : truncateWallet(r.reporter)}
                </Link>
                <span className="text-[#30363d]">·</span>
                <span className="text-[#7A838D]">{new Date(r.createdAt).toLocaleDateString('pl-PL')}</span>
              </div>
              <span className="font-mono text-[#B5BDC6] flex-shrink-0">{fmt(r.stakeWei)} tTRUST</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
