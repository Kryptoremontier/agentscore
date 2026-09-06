/**
 * Shared display formatters — Etap 4a hygiene fix.
 *
 * Before this file, "$0.0010" (tTRUST rendered with a literal dollar sign)
 * and "0,05" (a comma-decimal number-input glyph on non-US locales) were
 * both real, live bugs, and date rendering used THREE different locale
 * args (`pl-PL`, `en-US`, none) across the same features. One shared
 * en-US formatter for money and dates, repo-wide.
 */

/**
 * Format a tTRUST amount for display. Accepts wei (bigint/numeric string) by
 * default; pass `fromEther: true` when the input is already ether-denominated
 * (e.g. `AgentApiItem.supportStake`, `ForgeProject.totalStaked`).
 * Never renders "$" — tTRUST is not a dollar-pegged asset.
 */
export function formatTTrust(
  value: bigint | string | number,
  opts?: { decimals?: number; fromEther?: boolean },
): string {
  let n: number
  if (opts?.fromEther) {
    n = typeof value === 'number' ? value : Number(value)
  } else if (typeof value === 'bigint') {
    n = Number(value) / 1e18
  } else {
    try {
      n = Number(BigInt(String(value))) / 1e18
    } catch {
      n = Number(value) / 1e18
    }
  }
  if (!Number.isFinite(n)) n = 0

  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tTRUST`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K tTRUST`
  const decimals = opts?.decimals ?? (n >= 1 ? 2 : 4)
  return `${n.toFixed(decimals)} tTRUST`
}

function toDate(input: string | number | Date): Date {
  return input instanceof Date ? input : new Date(input)
}

/**
 * Format a date for display. `short`: "Sep 8, 2026". `long`: "September 8,
 * 2026, 14:32" (24h). en-US only — the app previously mixed `pl-PL`,
 * `en-US`, and no-locale-arg (browser default) across the same UI.
 * Invalid input returns "—", never "Invalid Date".
 */
export function formatDate(input: string | number | Date, style: 'short' | 'long' = 'short'): string {
  const date = toDate(input)
  if (Number.isNaN(date.getTime())) return '—'

  if (style === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    }).format(date).replace(' at ', ', ')
  }
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

/**
 * Compact date for chart ticks / dense lists: "Sep 8", or "Sep 8, 14:32"
 * with `withTime`. Invalid input returns "—".
 */
export function formatDateShort(input: string | number | Date, opts?: { withTime?: boolean }): string {
  const date = toDate(input)
  if (Number.isNaN(date.getTime())) return '—'

  if (opts?.withTime) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    }).format(date).replace(' at ', ', ')
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}
