/**
 * Pure validation/normalization logic behind DecimalInput.tsx, extracted so
 * it's directly unit-testable with the repo's existing .test.ts convention.
 *
 * The repo has zero component/DOM test infrastructure (vitest environment
 * is `node`, no jsdom or @testing-library/react, `.test.ts` only) — adding
 * that for one component is out of scope for a hygiene commit. Every other
 * test in this codebase tests a pure function directly; this keeps that
 * convention instead of introducing new test infra.
 */

/**
 * Normalize a raw keystroke value for a decimal amount input.
 * - comma -> period (fixes the native `type="number"` locale-glyph bug:
 *   OS-locale renders "0,05" while app state must always be period-decimal)
 * - rejects anything but digits and at most one separator (letters, a
 *   second ".", etc.) by returning null — caller should ignore the keystroke
 * - empty string is allowed (clearing the field)
 * - clamps to `max` when provided and the value is a complete number
 *   (not mid-typing a trailing ".")
 */
export function normalizeDecimalInput(raw: string, opts?: { max?: string }): string | null {
  if (raw === '') return ''

  const normalized = raw.replace(',', '.')
  if (!/^\d*\.?\d*$/.test(normalized)) return null

  if (opts?.max !== undefined && !normalized.endsWith('.')) {
    const num = parseFloat(normalized)
    const maxNum = parseFloat(opts.max)
    if (Number.isFinite(num) && Number.isFinite(maxNum) && num > maxNum) return opts.max
  }

  return normalized
}

/** Drop a trailing "." left over from mid-typing (e.g. blur after typing "5."). */
export function trimTrailingDot(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value
}
