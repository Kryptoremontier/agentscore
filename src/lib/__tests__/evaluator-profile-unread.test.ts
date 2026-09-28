import { describe, it, expect, vi, beforeEach } from 'vitest'
import { currentFreshness, runWithReadLedger } from '../server-cache'
import type { AttestationResult } from '../attestation-gate'
import type { EvaluatorProfile } from '../evaluator-score'

/**
 * Etap 4b-finish commit 2 — the evaluator profile. A failed attestation read stopped being cached
 * in 4b-cache, but REST /api/v1/evaluators/:address and MCP get_evaluator still printed it as
 * "0 attestations" (and, above 1.0x, as a weight capped for want of attestations). REPO_MAP §7 rule 5.
 */

const WALLET = '0x139219107c1ebe569f543c581b3b807cf6740006'
const entry = (raw: number): EvaluatorProfile => ({
  address: WALLET, totalPositions: 5, goodPicks: 4, rawAccuracy: 0.8, confidence: 0.5, adjustedAccuracy: 0.7,
  evaluatorWeight: raw, rawEvaluatorWeight: raw, evaluatorTier: 'analyst', streakCount: 2, bestPick: 'Luda', worstPick: null,
  meetsAttestationThreshold: true, attestationCount: 2,
})

const leaderboard = vi.fn<() => Promise<EvaluatorProfile[]>>()
const attestation = vi.fn<() => Promise<AttestationResult>>()
vi.mock('../evaluator-data', () => ({ fetchEvaluatorLeaderboard: () => leaderboard(), fetchStakerPositions: vi.fn(async () => []) }))
vi.mock('../attestation-gate', async (orig) => ({ ...(await orig<typeof import('../attestation-gate')>()), getAttestationCount: () => attestation() }))

const cfg = { minAttestations: 1, acceptedPredicates: [], requireAttestedAttestors: false }
const failed: AttestationResult = { walletAddress: WALLET, attestationCount: 0, attestors: [], meetsThreshold: false, config: cfg, incomplete: true }
const read = (n: number): AttestationResult => ({ walletAddress: WALLET, attestationCount: n, attestors: [], meetsThreshold: n >= 1, config: cfg })

beforeEach(() => { leaderboard.mockReset(); attestation.mockReset() })

describe('evaluator profile — a failed attestation read is "—" with the reason, never 0', () => {
  it('amplified evaluator (1.3x): count, gate and weight unknown; answer incomplete (no-store)', async () => {
    leaderboard.mockResolvedValue([entry(1.3)])
    attestation.mockResolvedValue(failed)
    const { getEvaluatorProfile } = await import('../api-data')
    const out = await runWithReadLedger(async () => ({ p: await getEvaluatorProfile(WALLET), f: currentFreshness() }))
    expect(out.p).toMatchObject({ attestationCount: null, meetsAttestationThreshold: null, attestationGateActive: null, evaluatorWeight: null, rawEvaluatorWeight: 1.3 })
    expect(out.p?.attestationMessage).toMatch(/Couldn’t read this evaluator’s attestations/)
    expect(out.p?.attestationMessage).not.toMatch(/capped|needs \d+ attestation/)
    expect(out.f.complete).toBe(false)
  })

  it('at or below 1.0x the gate never decides the weight: it stays known', async () => {
    leaderboard.mockResolvedValue([entry(0.9)])
    attestation.mockResolvedValue(failed)
    const { getEvaluatorProfile } = await import('../api-data')
    const p = await getEvaluatorProfile(WALLET)
    expect(p).toMatchObject({ attestationCount: null, evaluatorWeight: 0.9 })
  })

  it('a read attestation count is reported as before (0 is a real 0 when read)', async () => {
    leaderboard.mockResolvedValue([entry(1.3)])
    attestation.mockResolvedValue(read(0))
    const { getEvaluatorProfile } = await import('../api-data')
    const p = await getEvaluatorProfile(WALLET)
    expect(p).toMatchObject({ attestationCount: 0, meetsAttestationThreshold: false, attestationGateActive: true, evaluatorWeight: 1.0 })
  })

  it('evaluator list: a row whose gate was not checked is not reported as "gated"', async () => {
    leaderboard.mockResolvedValue([{ ...entry(1.3), meetsAttestationThreshold: null, attestationCount: null }])
    const { getEvaluators } = await import('../api-data')
    const [row] = await getEvaluators()
    expect(row).toMatchObject({ attestationCount: null, meetsAttestationThreshold: null, attestationGateActive: null })
  })
})
