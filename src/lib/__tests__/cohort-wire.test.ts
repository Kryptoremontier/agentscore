/**
 * Etap 7a commit 4 — the cohort as its cards show it (lib/cohort-wire.ts): id, name, created, in a
 * compact form that is LOSSLESS — decode(encode(x)) is x for every input, the compact shapes and
 * the fall-backs alike — and attestations sent only for subjects that have any.
 */
import { describe, it, expect } from 'vitest'
import {
  decodeCohortAttestations, decodeCohortCard, encodeCohortAttestations, encodeCohortCard, type CohortCard,
} from '../cohort-wire'

const hex = (n: number) => `0x${n.toString(16).padStart(8, '0').repeat(8)}`
const card = (n: number, createdAt = '2026-08-18T17:14:47+00:00'): CohortCard => ({ termId: hex(n), label: `Agent ${n} · Ensoul`, createdAt })

describe('cohort cards', () => {
  it('round-trips exactly: the compact id and time decode to the original strings', () => {
    for (const c of [card(0), card(1), card(0xdeadbeef), card(7, '1970-01-01T00:00:00+00:00'), card(9, '2099-12-31T23:59:59+00:00')]) {
      const wire = encodeCohortCard(c)
      expect(wire[0]).toHaveLength(43) // base64url of the 32 bytes
      expect(typeof wire[2]).toBe('number') // epoch seconds
      expect(decodeCohortCard(wire)).toEqual(c)
    }
  })

  it('anything outside those exact shapes travels as-is — still exact', () => {
    const odd: CohortCard[] = [
      { termId: '0xABCDEF' + 'a'.repeat(58), label: 'Upper-case id', createdAt: '2026-08-18T17:14:47.123+00:00' },
      { termId: '0x1234', label: 'Short id', createdAt: '2026-08-18T17:14:47Z' },
      { termId: hex(3), label: '', createdAt: 'not a date' },
    ]
    for (const c of odd) expect(decodeCohortCard(JSON.parse(JSON.stringify(encodeCohortCard(c))))).toEqual(c)
  })

  it('a real-sized cohort (263 agents) fits the target: the list answer under 40 KB', () => {
    const cohort = Array.from({ length: 263 }, (_, i) => card(i * 7919 + 1))
    const objects = JSON.stringify(cohort.map((c) => ({ ...c, caipIdentity: `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${1000 + 10 * c.label.length}`, declaredDomains: [], declaredSkills: [] }))).length
    const wire = JSON.stringify(cohort.map(encodeCohortCard)).length
    expect(wire).toBeLessThan(objects / 2.5)
    expect(wire).toBeLessThan(25_000)
  })
})

describe('cohort attestations', () => {
  const entry = { domain: 'Crypto / Onchain', attesters: ['0xabc'] }
  it('only subjects with attestations are sent; the decoder gives every other cohort agent [] (never unread)', () => {
    const all = { a: [], b: [entry], c: [] }
    const wire = encodeCohortAttestations(all)
    expect(wire).toEqual({ b: [entry] })
    expect(decodeCohortAttestations(wire, ['a', 'b', 'c'])).toEqual(all)
  })
})
