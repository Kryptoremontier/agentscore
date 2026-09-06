'use client'

/**
 * ATTESTED DOMAINS — the profile headline (thesis §5): what this agent is
 * attested as good at, according to whom, with how much stake. Rows come
 * from the canonical unit ([agent] is skilled in [canonical domain] +
 * positions), never from legacy skill predicates.
 *
 * Zero attestations → the existing AttestEmptyState (thesis §6: honest
 * "be the first", same AttestButton flow). Shared by the /agents modal and
 * the /agents/[id] route — one component, two surfaces.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { truncateWallet, type AttestedEntry } from '@/lib/attestation-reader'
import { AttestEmptyState } from '@/components/attest/AttestEmptyState'

interface AttestedDomainsProps {
  entries: AttestedEntry[]
  loading: boolean
  agentId: string
  agentName: string
  className?: string
}

const fmt = (wei: bigint) => (Number(wei) / 1e18).toFixed(4)

export function AttestedDomains({ entries, loading, agentId, agentName, className }: AttestedDomainsProps) {
  if (loading) {
    return (
      <div className={`rounded-2xl p-5 animate-pulse ${className ?? ''}`} style={{ background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.15)' }}>
        <div className="h-3 w-40 rounded bg-white/10 mb-3" />
        <div className="h-10 rounded bg-white/5" />
      </div>
    )
  }

  if (entries.length === 0) {
    return <AttestEmptyState agentId={agentId} agentName={agentName} className={className} />
  }

  return (
    <div className={`rounded-2xl p-5 ${className ?? ''}`} style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.3)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: '#2ECC71' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#2ECC71' }}>
          Attested Domains
        </p>
        <span className="text-[10px] text-[#7A838D]">— staked on-chain claims with visible authors</span>
      </div>
      <p className="text-[11px] text-[#7A838D] mb-3">
        {entries.length} domain{entries.length !== 1 ? 's' : ''} · attested by{' '}
        {new Set(entries.flatMap((e) => e.attesters.map((a) => a.toLowerCase()))).size} distinct wallet
        {new Set(entries.flatMap((e) => e.attesters.map((a) => a.toLowerCase()))).size !== 1 ? 's' : ''}
      </p>
      <div className="space-y-2">
        {entries.map((e) => (
          <AttestedRow key={`${e.agentId}:${e.domain.termId}`} entry={e} />
        ))}
      </div>
    </div>
  )
}

function AttestedRow({ entry }: { entry: AttestedEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-[#0F1113]/80 border border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{entry.domain.emoji}</span>
          <span className="text-sm font-semibold text-white truncate">{entry.domain.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          <span className="text-white">
            {entry.distinctAttesters} attester{entry.distinctAttesters !== 1 ? 's' : ''}
          </span>
          <span className="text-[#B5BDC6] font-mono">{fmt(entry.totalStake)} tTRUST</span>
          {entry.opposeStake > 0n && (
            <span className="font-mono" style={{ color: '#EF4444' }}>−{fmt(entry.opposeStake)} opposed</span>
          )}
          <span className="text-[#8B5CF6] flex items-center gap-0.5">
            attested by {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </div>
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-1 border-t border-white/[0.06] space-y-1">
          {entry.attesterStakes.map((a) => (
            <div key={a.wallet.toLowerCase()} className="flex items-center justify-between text-xs">
              <Link href={`/profile/${a.wallet}`} className="font-mono text-[#C8963C] hover:underline" title={a.wallet}>
                {truncateWallet(a.wallet)}
              </Link>
              <span className="font-mono text-[#B5BDC6]">{fmt(a.shares)} tTRUST</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
