/**
 * The ERC-8004 cohort as the /agents list sends it (Etap 7a): only what a card shows — the agent's
 * id, its name and when it was created (the "Newest" sort) — in a compact, LOSSLESS form. What only
 * the modal shows (the CAIP identity, the declared OASF domains and skills) comes with the modal
 * (agents-page-data.ts, part `identity`).
 *
 * 263 cohort agents as objects cost 76 KB of the 112 KB list answer; as `[id, name, created]`
 * tuples, with each 0x + 64-hex id as 43 base64url characters and each "…T…+00:00" time as epoch
 * seconds, about 26 KB. Anything outside those exact shapes is sent as-is, so decode(encode(x))
 * is always x. Browser-safe: no I/O, no Node APIs.
 */

/** One cohort agent on the list: what its card shows. */
export interface CohortCard {
  termId: string
  label: string
  createdAt: string
}

/** On the wire: [id (base64url of the 32 bytes, or the id as-is), name, created (epoch s, or the string as-is)]. */
export type CohortCardWire = [string, string, number | string]

const HEX_ID = /^0x[0-9a-f]{64}$/
const UTC_SECOND = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function hexToB64url(hex: string): string {
  const bytes = hex.slice(2).match(/../g)!.map((b) => parseInt(b, 16))
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2
    for (let c = 0; c < chars; c++) out += B64[(n >> (18 - 6 * c)) & 63]
  }
  return out
}

function b64urlToHex(s: string): string {
  let bits = 0
  let acc = 0
  let hex = '0x'
  for (const ch of s) {
    acc = (acc << 6) | B64.indexOf(ch)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      hex += ((acc >> bits) & 255).toString(16).padStart(2, '0')
    }
  }
  return hex
}

export function encodeCohortCard(c: CohortCard): CohortCardWire {
  const id = HEX_ID.test(c.termId) ? hexToB64url(c.termId) : c.termId
  const created = UTC_SECOND.test(c.createdAt) ? Date.parse(c.createdAt) / 1000 : c.createdAt
  return [id, c.label, created]
}

export function decodeCohortCard([id, label, created]: CohortCardWire): CohortCard {
  return {
    termId: id.startsWith('0x') || id.length !== 43 ? id : b64urlToHex(id),
    label,
    createdAt: typeof created === 'number' ? `${new Date(created * 1000).toISOString().slice(0, 19)}+00:00` : created,
  }
}

/**
 * Attestations on the cohort's agents: only the subjects that have any. The read always covers the
 * whole cohort it was asked about, so an agent of that cohort missing here has none — the decoder
 * gives it `[]` (never "unread": a failed read fails the whole part).
 */
export function encodeCohortAttestations<E>(bySubject: Record<string, E[]>): Record<string, E[]> {
  return Object.fromEntries(Object.entries(bySubject).filter(([, entries]) => entries.length > 0))
}

export function decodeCohortAttestations<E>(nonEmpty: Record<string, E[]>, cohortIds: readonly string[]): Record<string, E[]> {
  const out: Record<string, E[]> = {}
  for (const id of cohortIds) out[id] = nonEmpty[id] ?? []
  for (const [id, entries] of Object.entries(nonEmpty)) out[id] = entries
  return out
}
