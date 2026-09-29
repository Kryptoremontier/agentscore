/**
 * The /agents page's reads, served from the shared complete-reads cache (Etap 4c).
 *
 * The page used to read the indexer straight from the browser (32 requests for a cold list and
 * three modals), bypassing the cache: when the indexer failed a visitor saw an empty page while
 * our server held a complete read two minutes old. Now the page reads two routes built here —
 * the list (getAgentsPageData) and one agent's modal extras (getAgentModalData) — and every
 * part of them goes through lib/server-cache.ts: served within its TTL, refreshed in the
 * background, and — when the indexer is down — the last complete read with its real age.
 *
 * No new sources of truth (REPO_MAP §7 rule 4): the corpus, the cohort and the skill triples
 * are the cached readers REST and MCP already use (lib/api-data.ts); the new cached readers
 * wrap the same functions the page called in the browser. Only what the browser must see live
 * stays there: the connected wallet's own position, the Back/Sell panel, the refresh right
 * after the user's own transaction, and the attest flow.
 */

import {
  completeReadCache, readWithFreshness, recordLiveRead, SERVER_CACHE_TTL,
} from './server-cache'
import { CDN_MAX_EXTRA_AGE_SECONDS } from './api-helpers'
import { cachedAgentSkillTriples, loadAgentCorpus, loadErc8004Cohort, type AgentCorpus } from './api-data'
import { fetchAttestationsForSubjects, type AttestedEntry } from './attestation-reader'
import { attachVaultSnapshot, type AgentListAtom } from './agent-list'
import { fetchVaultPositions, sortPositions, type VaultPositionWithMeta } from './vault-positions'
import { livePositions } from './live-position'
import { readAgentSignals, readTrustTriple } from './agent-signals'
import { fetchAgentReports } from './agent-profile'
import { EVALUATOR_LEADERBOARD_MAX, fetchEvaluatorLeaderboard } from './evaluator-data'
import { calculateEvaluatorScore, type EvaluatorProfile } from './evaluator-score'
import { gqlRequest, type GqlRequest } from './gql-pager'
import type { AgentModalPayload, AgentsPagePayload, PagePart } from './agents-page-types'

/** Server reads bypass Next's fetch cache: the complete-reads cache decides what is kept. */
const serverRequest: GqlRequest = (query, variables) => gqlRequest(query, variables, { cache: 'no-store' })

/**
 * Past this age a part was not re-read when it should have been: twice its TTL (the most the
 * cache serves while the indexer answers) plus what a CDN hop can add.
 */
export function staleAfterSeconds(ttlSeconds: number): number {
  return 2 * ttlSeconds + CDN_MAX_EXTRA_AGE_SECONDS
}

/**
 * One part in its own child ledger: its value and the age of the reads behind it. A read that
 * throws — nothing was ever read, or nothing is left — is a failed part, and the answer is
 * marked incomplete so no CDN keeps it (the next request tries again).
 */
export async function pagePart<T>(key: string, ttlSeconds: number, read: () => Promise<T>): Promise<PagePart<T>> {
  try {
    const { value, freshness } = await readWithFreshness(read)
    return { status: 'ok', value, ...freshness, staleAfterSeconds: staleAfterSeconds(ttlSeconds) }
  } catch (err) {
    console.warn(`[agents-page] ${key} unread:`, err instanceof Error ? err.message : err)
    recordLiveRead(key, false)
    return { status: 'failed' }
  }
}

const FAILED: { status: 'failed' } = { status: 'failed' }

// ─── The list ─────────────────────────────────────────────────────────────────

/** The corpus as the list consumes it: post-junk rows (raw fields) with their vault snapshot. */
export function corpusForPage(corpus: AgentCorpus, readAt: number): Extract<AgentsPagePayload['agentScore'], { status: 'ok' }>['value'] {
  const rows = corpus.kept.map((item) => ({ ...corpus.rowsById.get(item.id)! }) as unknown as AgentListAtom)
  attachVaultSnapshot(rows, corpus.positions, readAt)
  return {
    rows,
    junk: corpus.junk.length,
    fetched: corpus.rowsById.size,
    total: corpus.total,
    truncated: corpus.truncated,
    attestations: corpus.attestationsBySubject ? Object.fromEntries(corpus.attestationsBySubject) : null,
  }
}

/** Attestations on every cohort agent, keyed by the (sorted) cohort ids — a new cohort agent is a new key. */
const loadCohortAttestations = completeReadCache(
  'cohort-attestations',
  // Throws if any chunk fails: a partial map is never stored.
  async (ids: string[]) => ({ value: await fetchAttestationsForSubjects(ids), complete: true }),
  { revalidate: SERVER_CACHE_TTL.cohortAttestations, tags: () => [] },
)

export async function getAgentsPageData(): Promise<AgentsPagePayload> {
  const [agentScoreRaw, cohort] = await Promise.all([
    pagePart('agent-corpus', SERVER_CACHE_TTL.agentCorpus, () => loadAgentCorpus()),
    pagePart('erc8004-cohort', SERVER_CACHE_TTL.erc8004Cohort, async () => {
      const c = await loadErc8004Cohort()
      return { agents: c.agents, total: c.total, truncated: c.truncated }
    }),
  ])
  const agentScore: AgentsPagePayload['agentScore'] = agentScoreRaw.status === 'ok'
    ? { ...agentScoreRaw, value: corpusForPage(agentScoreRaw.value, Date.parse(agentScoreRaw.dataReadAt)) }
    : FAILED
  const cohortAttestations: AgentsPagePayload['cohortAttestations'] = cohort.status === 'ok'
    ? await pagePart('cohort-attestations', SERVER_CACHE_TTL.cohortAttestations, async () =>
        Object.fromEntries(await loadCohortAttestations(cohort.value.agents.map((a) => a.termId).sort())) as Record<string, AttestedEntry[]>)
    : FAILED
  return { agentScore, cohort, cohortAttestations }
}

// ─── One agent's modal ────────────────────────────────────────────────────────

/** The trust triple and every position on the agent's vaults (raw rows, with meta). */
const loadAgentVault = completeReadCache(
  'agent-vault',
  async (termId: string) => {
    const trustTriple = await readTrustTriple(termId, serverRequest)
    const ids = trustTriple?.counterTermId ? [termId, trustTriple.counterTermId] : [termId]
    const positions = await fetchVaultPositions(ids, { withMeta: true, order: 'shares-desc', request: serverRequest })
    return { value: { trustTriple, positions }, complete: true }
  },
  { revalidate: SERVER_CACHE_TTL.agentDetail, tags: (termId) => [`agent:${termId}`] },
)

const loadAgentSignals = completeReadCache(
  'agent-signals',
  async (termId: string, counterTermId: string | null) => ({ value: await readAgentSignals(termId, counterTermId, serverRequest), complete: true }),
  { revalidate: SERVER_CACHE_TTL.agentDetail, tags: (termId) => [`agent:${termId}`] },
)

const loadAgentReports = completeReadCache(
  'agent-reports',
  // Throws on a failed or capped read.
  async (termId: string) => ({ value: await fetchAgentReports(termId), complete: true }),
  { revalidate: SERVER_CACHE_TTL.agentDetail, tags: (termId) => [`agent:${termId}`] },
)

/** The modal weighs its first 20 live stakers (largest first), as the browser hook did. */
export const STAKER_WEIGHTS_MAX = 20

/**
 * Staker wallet → evaluator weight, from the cached evaluator leaderboard — the weights /evaluators
 * shows, attestation gate included (evaluator-score.ts). The browser hook this replaces read each
 * wallet with StakerSupportPositions, which the indexer's schema no longer accepts
 * (`field 'vault' not found in type: 'atoms_bool_exp'`): every read failed and every staker was
 * silently weighed as a 1.0x newcomer. A wallet the leaderboard doesn't hold has no support position
 * on an agent (a newcomer's weight) — known only while the leaderboard holds every evaluator.
 */
export function stakerWeightsFrom(profiles: readonly EvaluatorProfile[], wallets: readonly string[]): Record<string, number> {
  const byWallet = new Map(profiles.map((p) => [p.address.toLowerCase(), p.evaluatorWeight]))
  const everyone = profiles.length < EVALUATOR_LEADERBOARD_MAX
  const out: Record<string, number> = {}
  for (const w of wallets) {
    const weight = byWallet.get(w) ?? (everyone ? calculateEvaluatorScore(w, []).evaluatorWeight : undefined)
    if (weight == null) throw new Error(`evaluator weight unknown for ${w} (leaderboard cut at ${EVALUATOR_LEADERBOARD_MAX})`)
    out[w] = weight
  }
  return out
}

export function stakerWalletsOf(positions: readonly VaultPositionWithMeta[]): string[] {
  const seen = new Set<string>()
  for (const p of livePositions(sortPositions(positions, 'shares-desc'))) {
    const w = p.account_id?.toLowerCase()
    if (w) seen.add(w)
  }
  return [...seen].slice(0, STAKER_WEIGHTS_MAX)
}

export async function getAgentModalData(termId: string): Promise<AgentModalPayload> {
  const vault = await pagePart('agent-vault', SERVER_CACHE_TTL.agentDetail, () => loadAgentVault(termId))
  const [signals, skillTriples, reports, stakerWeights] = await Promise.all([
    // Which vaults to read depends on the trust triple: no vault read, no signals.
    vault.status === 'ok'
      ? pagePart('agent-signals', SERVER_CACHE_TTL.agentDetail, () => loadAgentSignals(termId, vault.value.trustTriple?.counterTermId ?? null))
      : FAILED,
    pagePart('agent-skill-triples', SERVER_CACHE_TTL.agentDetail, () => cachedAgentSkillTriples(termId)),
    pagePart('agent-reports', SERVER_CACHE_TTL.agentDetail, () => loadAgentReports(termId)),
    // All or nothing: a wallet whose weight is unknown is not weighed as a newcomer.
    vault.status === 'ok'
      ? pagePart('staker-weights', SERVER_CACHE_TTL.evaluatorLeaderboard, async () =>
          stakerWeightsFrom(await fetchEvaluatorLeaderboard(), stakerWalletsOf(vault.value.positions)))
      : FAILED,
  ])
  return { vault, signals, skillTriples, reports, stakerWeights }
}

/**
 * Only agents the page lists get a modal answer (the corpus or the cohort, both cached): an
 * arbitrary id would otherwise cost indexer reads and cache entries per request. null = unknown
 * (either list couldn't be read, so membership can't be ruled out — the caller reads it anyway).
 */
export async function isListedAgent(termId: string): Promise<boolean | null> {
  const [corpus, cohort] = await Promise.all([
    loadAgentCorpus().catch(() => null),
    loadErc8004Cohort().catch(() => null),
  ])
  if (corpus?.rowsById.has(termId) || cohort?.agents.some((a) => a.termId === termId)) return true
  if (!corpus || !cohort || corpus.truncated !== false || cohort.truncated !== false) return null
  return false
}
