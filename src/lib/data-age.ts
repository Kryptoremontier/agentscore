/**
 * How old the data behind a page is, in words — the human-facing counterpart of REST/MCP
 * `meta.dataAgeSeconds` (lib/server-cache.ts). Pure; safe in client components.
 */

/** "Read just now" / "Data from 42 s ago" / "Data from 3 min ago". null → no claim. */
export function dataAgeLabel(ageSeconds: number | null | undefined): string | null {
  if (ageSeconds == null || !Number.isFinite(ageSeconds) || ageSeconds < 0) return null
  if (ageSeconds < 5) return 'Read just now'
  if (ageSeconds < 90) return `Data from ${Math.round(ageSeconds)} s ago`
  return `Data from ${Math.round(ageSeconds / 60)} min ago`
}
