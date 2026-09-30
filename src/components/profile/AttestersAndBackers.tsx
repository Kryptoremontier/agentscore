'use client'

/**
 * People who vouch vs Backers — two different claims on one atom, kept apart
 * (thesis §4):
 *   WHO VOUCHES  wallets with positions on [agent] is skilled in [domain]
 *              → "good at area X, and I put tTRUST behind it"
 *   BACKERS    wallets with positions on the agent's own vault / counter-vault
 *              → "I stake on (or against) this agent" — real data, not an
 *              attestation of competence. Formerly mislabeled "Attestors".
 *
 * Exported separately so the /agents modal (which already renders a richer,
 * signal-based backers list) can mount AttestersList alone, while
 * /agents/[id] mounts the composed pair.
 */

import Link from 'next/link'
import type { AttesterSummary, Backer } from '@/lib/agent-profile'
import {
  PEOPLE_WHO_VOUCH_HEADING, PEOPLE_WHO_VOUCH_NOTE, PEOPLE_WHO_VOUCH_EMPTY, WHO_VOUCHES_UNREAD,
  BACKERS_HEADING, BACKERS_NOTE, BACKERS_UNREAD, BACKERS_EMPTY,
} from '@/lib/people-copy'
import { PersonName } from '@/components/shared/PersonName'

const fmt = (wei: bigint) => (Number(wei) / 1e18).toFixed(4)

/** `attesters` null = the read failed — shown as unavailable, never as "nobody vouches". */
export function AttestersList({ attesters, loading, className }: { attesters: AttesterSummary[] | null; loading: boolean; className?: string }) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold" style={{ color: '#2ECC71' }}>{PEOPLE_WHO_VOUCH_HEADING}</h4>
        <span className="text-[10px] text-[#7A838D]">{PEOPLE_WHO_VOUCH_NOTE}</span>
      </div>
      {loading ? (
        <div className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : attesters == null ? (
        <p className="text-xs text-[#7A838D] py-3" data-testid="attesters-failed">{WHO_VOUCHES_UNREAD}</p>
      ) : attesters.length === 0 ? (
        <p className="text-xs text-[#7A838D] py-3" data-testid="attesters-empty">{PEOPLE_WHO_VOUCH_EMPTY}</p>
      ) : (
        <div className="space-y-1.5">
          {attesters.map((a) => (
            <Link
              key={a.wallet.toLowerCase()}
              href={`/profile/${a.wallet}`}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#171A1D] border border-white/[0.06] hover:border-[#2ECC71]/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-white"><PersonName wallet={a.wallet} /></p>
                <p className="text-[10px] text-[#B5BDC6] truncate">{a.domains.join(' · ')}</p>
              </div>
              <span className="font-mono text-xs text-[#B5BDC6] flex-shrink-0">{fmt(a.totalStake)} tTRUST</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

/** `backers` null = the read failed — shown as unavailable, never as "no positions". */
export function BackersList({ backers, loading, className }: { backers: Backer[] | null; loading: boolean; className?: string }) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-white">{BACKERS_HEADING}</h4>
        <span className="text-[10px] text-[#7A838D]">{BACKERS_NOTE}</span>
      </div>
      {loading ? (
        <div className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : backers == null ? (
        <p className="text-xs text-[#7A838D] py-3" data-testid="backers-failed">{BACKERS_UNREAD}</p>
      ) : backers.length === 0 ? (
        <p className="text-xs text-[#7A838D] py-3" data-testid="backers-empty">{BACKERS_EMPTY}</p>
      ) : (
        <div className="space-y-1.5">
          {backers.map((b) => (
            <Link
              key={b.wallet.toLowerCase()}
              href={`/profile/${b.wallet}`}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#171A1D] border border-white/[0.06] hover:border-[#C8963C]/30 transition-colors"
            >
              <p className="font-mono text-sm text-white"><PersonName wallet={b.wallet} label={b.label} /></p>
              <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
                {b.supportShares > 0n && <span style={{ color: '#34a872' }}>↑ {fmt(b.supportShares)}</span>}
                {b.opposeShares > 0n && <span style={{ color: '#c45454' }}>↓ {fmt(b.opposeShares)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export function AttestersAndBackers({ attesters, backers, loading, className }: { attesters: AttesterSummary[] | null; backers: Backer[] | null; loading: boolean; className?: string }) {
  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      <AttestersList attesters={attesters} loading={loading} />
      <BackersList backers={backers} loading={loading} />
    </div>
  )
}
