/**
 * Etap 5a commit 3 — the profile tells the same story as the modal: one stat-row derivation
 * (statRowView) over the same parts, one component, the modal's Atom ID. The rendered rows are
 * compared live, modal vs profile, for Dackie, Luda and OPEN CLAW by the harness
 * (tests/e2e/screenshots.spec.ts statRowMatchesModal).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { statRowView, backersFromPositions, type StatRowInput } from '../agent-profile'
import { CANONICAL_DOMAINS_REGISTRY } from '../canonical-domains'
import type { AttestedEntry } from '../attestation-reader'
import type { AgentModalPayload } from '../agents-page-types'
import { shortTermId } from '../../components/profile/AtomIdLine'

const E18 = 10n ** 18n
const wei = (tTrust: string) => BigInt(Math.round(Number(tTrust) * 1e6)) * (E18 / 1_000_000n)
const ATTESTER = '0x1392aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0006'
const entry = (agentId: string, domainIdx: number, stake: bigint): AttestedEntry => ({
  agentId, agentName: '', domain: CANONICAL_DOMAINS_REGISTRY[domainIdx], distinctAttesters: 1, attesters: [ATTESTER],
  attesterStakes: [{ wallet: ATTESTER, shares: stake }], totalStake: stake, opposeStake: 0n, positionCount: 1, score: 0,
})
const pos = (term_id: string, account_id: string, shares: bigint) => ({ id: `${term_id}-1-${account_id}`, term_id, account_id, shares: shares.toString(), created_at: '', updated_at: '' })

// Live 2026-09-29 (the modal's header, before this change):
const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const OC_COUNTER = '0x' + 'cc'.repeat(32)

/** The parts one agent's surfaces read: attestations + the modal answer (vault, signals, reports). */
const PARTS: Record<string, { attested: AttestedEntry[]; modal: AgentModalPayload }> = {
  dackie: {
    attested: [entry(DACKIE, 0, wei('0.0099'))],
    modal: part({ trustTriple: null, positions: [] }, 0, 0),
  },
  luda: {
    attested: [entry(LUDA, 2, wei('0.0208'))],
    modal: part({ trustTriple: null, positions: [pos(LUDA, '0xludarep', wei('0.001')), pos(LUDA, '0xsoldout', 0n)] }, 1, 0),
  },
  openclaw: {
    attested: [],
    modal: part({ trustTriple: { termId: '0xt', counterTermId: OC_COUNTER }, positions: [pos(OPEN_CLAW, '0xowner', wei('0.3351')), pos(OC_COUNTER, '0xowner', 0n)] }, 16, 0),
  },
}
function part(vault: { trustTriple: { termId: string; counterTermId: string | null } | null; positions: ReturnType<typeof pos>[] }, signals: number, reports: number): AgentModalPayload {
  const ok = <T,>(value: T) => ({ status: 'ok' as const, value, dataReadAt: '2026-09-29T00:00:00Z', dataAgeSeconds: 0, complete: true, staleAfterSeconds: 105 })
  return {
    vault: ok(vault as never),
    signals: ok({ signals: [], totalCount: signals }),
    skillTriples: ok([] as never),
    reports: ok(Array.from({ length: reports }) as never),
    stakerWeights: ok({}),
  }
}
const ID = { dackie: DACKIE, luda: LUDA, openclaw: OPEN_CLAW } as const

/** How /agents/[id] builds its input (app/agents/[id]/page.tsx). */
function profileInput(key: keyof typeof ID): StatRowInput {
  const { attested, modal } = PARTS[key]
  const vault = modal.vault.status === 'ok' ? modal.vault.value : null
  return {
    attested,
    reportCount: modal.reports.status === 'ok' ? modal.reports.value.length : null,
    backers: vault ? backersFromPositions(vault.positions, ID[key], vault.trustTriple?.counterTermId ?? null) : null,
    signals: modal.signals.status === 'ok' ? modal.signals.value.totalCount : null,
  }
}
/** How the /agents modal builds it (app/agents/page.tsx): the positions it seeded from the same answer. */
function modalInput(key: keyof typeof ID): StatRowInput {
  const { attested, modal } = PARTS[key]
  const vault = modal.vault.status === 'ok' ? modal.vault.value : null
  const allPositions = vault!.positions.filter((p) => BigInt(p.shares) > 0n) // livePositions(seed)
  return {
    attested,
    reportCount: modal.reports.status === 'ok' ? modal.reports.value.length : null,
    backers: backersFromPositions(allPositions, ID[key], vault?.trustTriple?.counterTermId ?? null),
    signals: modal.signals.status === 'ok' ? modal.signals.value.totalCount : null,
  }
}

describe('statRowView — the modal and the profile render the same row', () => {
  it.each([
    ['dackie', ['1 Attester', '1 Domain attested', '0.0099 tTRUST tTRUST attested', '0 Reports'], 'Backers: 0 · 0.0000 tTRUST on atom vault'],
    ['luda', ['1 Attester', '1 Domain attested', '0.0208 tTRUST tTRUST attested', '0 Reports'], 'Backers: 1 · 0.0010 tTRUST on atom vault · 1 signal'],
    ['openclaw', ['0 Attesters', '0 Domains attested', '0.0000 tTRUST tTRUST attested', '0 Reports'], 'Backers: 1 · 0.3351 tTRUST on atom vault · 16 signals'],
  ] as const)('%s', (key, boxes, backersLine) => {
    const profile = statRowView(profileInput(key))
    expect(profile).toEqual(statRowView(modalInput(key)))
    expect(profile.boxes.map((b) => `${b.value} ${b.label}`)).toEqual(boxes)
    expect(profile.backersLine).toBe(backersLine)
  })

  it('a part not read renders "—", never a 0 derived from nothing; one signal is singular', () => {
    const v = statRowView({ attested: null, reportCount: null, backers: null, signals: null })
    expect(v.boxes.map((b) => b.value)).toEqual(['—', '—', '—', '—'])
    expect(v.boxes.map((b) => b.label)).toEqual(['Attesters', 'Domains attested', 'tTRUST attested', 'Reports'])
    expect(v.backersLine).toBe('Backers: — · — on atom vault')
    expect(statRowView({ attested: [], reportCount: 0, backers: { count: 1, atomVaultWei: wei('0.001') }, signals: 1 }).backersLine)
      .toBe('Backers: 1 · 0.0010 tTRUST on atom vault · 1 signal')
  })

  it('backers: live wallets on the atom vault and its counter-vault; stake on the atom vault only; 0-share rows are not backers', () => {
    const b = backersFromPositions([
      pos(OPEN_CLAW, '0xA', wei('0.2')), pos(OPEN_CLAW, '0xa', wei('0.1')), // same wallet, two rows
      pos(OC_COUNTER, '0xB', wei('0.05')), pos(OPEN_CLAW, '0xC', 0n),
    ], OPEN_CLAW, OC_COUNTER)
    expect(b).toEqual({ count: 2, atomVaultWei: wei('0.3') })
  })

  it('Atom ID: the modal\'s shortened hex (copy gives the full id), never the decimal', () => {
    expect(shortTermId(LUDA)).toBe('0x82d87d9517b6...24802c5a')
    expect(shortTermId(LUDA)).not.toMatch(/^\d+$/)
  })
})

describe('source guards — same components on both surfaces, no tier-sounding score words', () => {
  const SRC = path.join(__dirname, '..', '..')
  const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
  const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')

  it('modal and profile render <ProfileStatRow view={statRow} …> from statRowView and <AtomIdLine>', () => {
    const modal = code('app/agents/page.tsx')
    expect(modal).toMatch(/const statRow = useMemo\(\(\) => statRowView\(\{/)
    expect(modal).toMatch(/<ProfileStatRow\s+view=\{statRow\}/)
    expect(modal).toMatch(/<AtomIdLine termId=\{selectedAgent\.term_id\}/)
    const profile = code('app/agents/[id]/page.tsx')
    expect(profile).toMatch(/const statRow = statRowView\(\{/)
    expect(profile.match(/<ProfileStatRow view=\{statRow\} \/>/g)).toHaveLength(2) // scored + non-scored tier
    expect(profile).toMatch(/fetchAgentModalData\(agentId, MODAL_HEADER_PARTS\)/) // the modal's own answer, its header's parts
    expect(profile).toMatch(/<AtomIdLine termId=\{agentId\} \/>/)
    const header = code('components/agents/AgentHeader.tsx')
    expect(header).toMatch(/<AtomIdLine termId=\{agent\.id\} \/>/)
    expect(header).not.toMatch(/atomId\.toString\(\)|Total Stake|>\s*Stakers\s*</)
  })

  it('no "Moderate Trust" / "Trust Level" beside the attestation tier on the profile', () => {
    const stats = code('components/agents/AgentStats.tsx')
    expect(stats).not.toMatch(/Trust Level|getTrustLevel/)
    expect(stats).toMatch(/<TrustScoreBadge score=\{agent\.trustScore\} size="lg" showLabel=\{false\} \/>/)
  })
})
