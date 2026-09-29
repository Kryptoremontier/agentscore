/**
 * In-app notices (Etap 5a) — what replaced every native browser dialog in the user-facing flows. A native
 * dialog blocks the page, can't carry a link, and on a phone reads like the site broke; a notice is
 * part of the page and says what to do next. Pure: the provider (components/shared/NoticeProvider)
 * renders these.
 */

import { INTUITION_HUB_URL } from './intuition-links'

export interface Notice {
  kind: 'error' | 'info'
  text: string
  /** One way forward, when there is one (e.g. the faucet for a missing balance). */
  link?: { href: string; label: string }
}

export const GET_TTRUST_LINK = { href: INTUITION_HUB_URL, label: 'Get free tTRUST from Intuition Hub' } as const

function messageOf(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  // Wallet errors carry a request dump after the first line; the first line is the reason.
  return raw.split('\n')[0].trim()
}

/**
 * A failed write, for a person: a rejection in the wallet is not an error, a missing balance
 * links to the faucet, anything else says what failed and why (the wallet's own first line).
 */
export function txFailureNotice(action: string, err: unknown): Notice {
  const msg = messageOf(err)
  const lower = msg.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return { kind: 'info', text: `${action} cancelled in your wallet.` }
  }
  if (lower.includes('insufficientbalance') || lower.includes('insufficient') || lower.includes('exceeds the balance')) {
    return { kind: 'error', text: `${action} failed: not enough tTRUST for the stake and fees.`, link: GET_TTRUST_LINK }
  }
  return { kind: 'error', text: `${action} failed: ${msg || 'unknown error'}` }
}
