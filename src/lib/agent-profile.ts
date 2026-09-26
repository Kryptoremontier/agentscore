/**
 * Agent Profile — ETAP 3. The read side of the AGENTS tab question
 * (thesis §5): "good at WHAT, according to WHOM, any REPORTS?" — answered
 * from the canonical unit, not from the legacy widgets.
 *
 * Three DISTINCT claims live on one atom, and this module keeps them apart
 * (thesis §4 — do not conflate):
 *   ATTESTED  [agent] is skilled in [canonical domain] + staked position
 *             → attestation-reader (subject-filtered). Attester = position wallet.
 *   BACKERS   positions on the agent's OWN atom vault / trust counter-vault
 *             → "I stake on this agent", not "competent in domain X".
 *   REPORTS   [agent] reported for [safety category] (+ stake)
 *             → the negative side, same who+how-much visibility.
 *
 * Pure aggregation functions are exported and unit-tested; fetch* wrappers
 * are thin I/O with graceful degradation ([] / null on error, never throw).
 */

import { APP_CONFIG } from './app-config'
import { AGENT_WHERE_STR } from './gql-filters'
import { TRUST_PREDICATE_TERM_ID } from './intuition'
import { fetchAttestations, isLivePosition, type AttestedEntry } from './attestation-reader'
import { fetchAllRows, gqlRequest, SERVER_ROW_CAP } from './gql-pager'
import { fetchVaultPositions } from './vault-positions'

// `reported for` — the canonical (mainnet-minted, cross-network) report
// predicate. Same term_id the modal's report query and predicates.ts use.
export const REPORTED_FOR_TERM_ID = '0x51f1febac0b9d05953442f082597c5d1ce827bd2f888446ad811692e0a0f428d'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentReport {
  tripleId: string
  /** Safety category, e.g. "Scam" / "Phishing" — from the object atom (canonical) or the legacy predicate suffix. */
  category: string
  /** Reporter wallet: first support position on the report triple, falling back to creator (FeeProxy-routed triples have creator = proxy). */
  reporter: string
  reporterLabel: string | null
  /** Total support stake on the report triple (wei). */
  stakeWei: bigint
  createdAt: string
}

export interface Backer {
  wallet: string
  label: string | null
  supportShares: bigint
  opposeShares: bigint
}

export interface AttesterSummary {
  wallet: string
  /** Canonical domain labels this wallet attested for the agent. */
  domains: string[]
  totalStake: bigint
}

/** null = that read failed — "couldn't read", never "none" (REPO_MAP §7 rule 5). */
export interface AgentProfileVector {
  attested: AttestedEntry[] | null
  reports: AgentReport[] | null
}

export interface RawReportRow {
  term_id: string
  created_at: string
  creator_id: string | null
  predicate: { term_id: string; label: string | null } | null
  object: { term_id: string; label: string | null } | null
}

export interface PositionRow {
  term_id: string
  account_id: string | null
  shares: string
  created_at?: string
  account?: { label: string | null } | null
}

// ─── Pure ────────────────────────────────────────────────────────────────────

/**
 * Report category from a report triple. Canonical form ([x] reported for
 * [Scam]) carries the category on the OBJECT; the testnet-era form
 * ([x] reported_for_scam [reason]) carries it in the PREDICATE suffix.
 */
export function resolveReportCategory(
  predicateLabel: string | null | undefined,
  objectLabel: string | null | undefined,
): string {
  const pred = (predicateLabel ?? '').trim()
  if (pred.startsWith('reported_for_')) {
    const suffix = pred.replace('reported_for_', '').replace(/_/g, ' ')
    return suffix.charAt(0).toUpperCase() + suffix.slice(1)
  }
  const obj = (objectLabel ?? '').trim()
  return obj || 'Unspecified'
}

function parseShares(v: string | null | undefined): bigint {
  try { return BigInt(v || '0') } catch { return 0n }
}

/**
 * Aggregate report triples with their vault positions into displayable rows.
 * Stake = summed support positions on the triple. Reporter = earliest
 * support position wallet (positions must be passed created_at-ascending),
 * else creator_id. Sorted newest first.
 */
export function aggregateReports(rows: readonly RawReportRow[], positions: readonly PositionRow[]): AgentReport[] {
  const byVault = new Map<string, PositionRow[]>()
  for (const p of positions) {
    if (!p?.term_id || !p.account_id) continue
    const arr = byVault.get(p.term_id) ?? []
    arr.push(p)
    byVault.set(p.term_id, arr)
  }

  const out: AgentReport[] = []
  for (const r of rows ?? []) {
    if (!r?.term_id) continue
    const ps = byVault.get(r.term_id) ?? []
    const stakeWei = ps.reduce((s, p) => s + parseShares(p.shares), 0n)
    const first = ps.find((p) => parseShares(p.shares) > 0n) ?? ps[0]
    out.push({
      tripleId: r.term_id,
      category: resolveReportCategory(r.predicate?.label, r.object?.label),
      reporter: first?.account_id ?? r.creator_id ?? 'unknown',
      reporterLabel: first?.account?.label ?? null,
      stakeWei,
      createdAt: r.created_at,
    })
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/**
 * Backers: wallets holding positions on the agent's own vault (support) or
 * the trust counter-vault (oppose). Dedup by wallet (case-insensitive),
 * shares summed per side, zero-share rows dropped. Sorted by support desc.
 */
export function aggregateBackers(
  positions: readonly PositionRow[],
  agentTermId: string,
  counterTermId?: string | null,
): Backer[] {
  const acc = new Map<string, Backer>()
  const agentId = agentTermId.toLowerCase()
  const counterId = counterTermId?.toLowerCase() ?? null
  for (const p of positions) {
    if (!p?.account_id) continue
    const shares = parseShares(p.shares)
    if (!isLivePosition({ shares })) continue // a wallet that sold out is not a backer
    const vault = p.term_id.toLowerCase()
    const isSupport = vault === agentId
    const isOppose = counterId !== null && vault === counterId
    if (!isSupport && !isOppose) continue
    const key = p.account_id.toLowerCase()
    const b = acc.get(key) ?? { wallet: p.account_id, label: p.account?.label ?? null, supportShares: 0n, opposeShares: 0n }
    if (isSupport) b.supportShares += shares
    else b.opposeShares += shares
    if (!b.label && p.account?.label) b.label = p.account.label
    acc.set(key, b)
  }
  return [...acc.values()].sort((a, b) =>
    a.supportShares === b.supportShares ? 0 : a.supportShares > b.supportShares ? -1 : 1,
  )
}

/**
 * Attesters across all of an agent's attested domains: one row per wallet
 * listing which canonical domains it attested and its total support stake.
 * Dedup by wallet across domains (case-insensitive). Sorted by stake desc.
 *
 * An agent's distinct-attester count (thesis §4, the sybil-safe measure) is
 * this function's `.length`, across all of its domains. The modal stat row
 * (computeModalStatSummary) and the AttestedDomains header read it. Per-domain
 * rows print `entry.distinctAttesters`, which aggregateAttestations computes.
 * Both counts use the same predicate, isLivePosition: a wallet that sold out is
 * not an attester. aggregateAttestations already drops 0-share rows. The check
 * runs here too, so a count can't disagree with the rule whatever built the entries.
 */
export function summarizeAttesters(entries: readonly AttestedEntry[]): AttesterSummary[] {
  const acc = new Map<string, AttesterSummary>()
  for (const e of entries ?? []) {
    for (const { wallet, shares } of e.attesterStakes ?? []) {
      if (!wallet || !isLivePosition({ shares })) continue
      const key = wallet.toLowerCase()
      const s = acc.get(key) ?? { wallet, domains: [], totalStake: 0n }
      if (!s.domains.includes(e.domain.label)) s.domains.push(e.domain.label)
      s.totalStake += shares
      acc.set(key, s)
    }
  }
  return [...acc.values()].sort((a, b) =>
    a.totalStake === b.totalStake ? 0 : a.totalStake > b.totalStake ? -1 : 1,
  )
}

export interface ModalStatSummary {
  /** Distinct attester wallets across ALL of this agent's attested domains — dedup, not row count. */
  attesters: number
  /** Distinct domains this agent is attested in (one AttestedEntry per domain already). */
  domains: number
  /** Sum of support stake across every attestation triple (the canonical unit, thesis §4) — wei. */
  tTrustAttestedWei: bigint
  reports: number
  /** Stakers: distinct wallets with a LIVE position on the agent's atom vault or its trust
   *  counter-vault (lib/live-position.ts countLiveStakers) — Backers, not attesters. */
  backerCount: number
  /** Total stake on the agent's own atom vault — wei. */
  backerVaultWei: bigint
  /** Raw signal/event count on the agent's own vault (deposits+redemptions, NOT distinct wallets — a
   *  wallet can produce several). Demoted onto the Backers line when non-zero, never a primary stat
   *  and never hidden outright (thesis §6) — see the Etap 4b follow-up that added this field. */
  signals: number
}

/**
 * Etap 4b modal — one derivation for both rows the modal shows: the primary
 * attestation-unit row (attesters/domains/tTrustAttested/reports) and the
 * secondary Backers line (vault stakers/stake). Pure so the hierarchy the
 * modal renders is a tested rule, not a per-surface accident (same
 * principle as profileSections below). No new data fetches — every input
 * here is already fetched for AttestedDomains/ReportsSection/the vault
 * stats grid; this only re-derives display numbers from those same rows.
 */
export function computeModalStatSummary(input: {
  attested: readonly AttestedEntry[]
  reportCount: number
  backerCount: number
  backerVaultWei: bigint
  signals: number
}): ModalStatSummary {
  return {
    domains: input.attested.length,
    attesters: summarizeAttesters(input.attested).length,
    tTrustAttestedWei: input.attested.reduce((sum, e) => sum + e.totalStake, 0n),
    reports: input.reportCount,
    backerCount: input.backerCount,
    backerVaultWei: input.backerVaultWei,
    signals: input.signals,
  }
}

export type ProfileSectionKey = 'attested' | 'declared' | 'reports'

export interface ProfileSectionPlan {
  /** Fixed top-to-bottom order (thesis §5: attested is the headline, declared secondary, reports collapsed). */
  order: readonly ProfileSectionKey[]
  attestedEmpty: boolean
  /** Declared is a cohort-only concept — hidden (not "empty") when the agent declared nothing. */
  declaredHidden: boolean
  reportsEmpty: boolean
}

/**
 * Section plan for a profile. Pure so the hierarchy is a tested rule, not
 * a per-surface accident: ATTESTED > DECLARED > REPORTS, always.
 */
export function profileSections(input: { attestedCount: number; declaredCount: number; reportCount: number }): ProfileSectionPlan {
  return {
    order: ['attested', 'declared', 'reports'] as const,
    attestedEmpty: input.attestedCount <= 0,
    declaredHidden: input.declaredCount <= 0,
    reportsEmpty: input.reportCount <= 0,
  }
}

// ─── I/O ─────────────────────────────────────────────────────────────────────

// Shared transport: throws on HTTP errors (incl. 429), GraphQL errors and a body without data.
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  if (!APP_CONFIG.GRAPHQL_URL) return null
  return gqlRequest<T>(query, variables)
}

// Our ceiling on report triples per agent (the pager reports hitting it — never a silent first 50).
const REPORTS_MAX = 1_000

/** Attestations where this agent is the SUBJECT of the canonical unit. */
export function fetchAgentAttestations(agentId: string): Promise<AttestedEntry[]> {
  return fetchAttestations({ subjectId: agentId })
}

/** Reports filed against this agent (canonical `reported for` + testnet-era `reported_for_*`), with stake. */
export async function fetchAgentReports(agentId: string): Promise<AgentReport[]> {
  try {
    if (!APP_CONFIG.GRAPHQL_URL) return []
    const where = `{
      subject_id: { _eq: $id }
      _or: [
        { predicate_id: { _eq: $pred } }
        { predicate: { label: { _ilike: "reported_for_%" } } }
      ]
    }`
    const page = await fetchAllRows<RawReportRow>({
      query: `query GetAgentReports($id: String!, $pred: String!, $limit: Int!, $offset: Int!) {
        triples(where: ${where}, order_by: [{ created_at: desc }, { term_id: asc }], limit: $limit, offset: $offset) {
          term_id created_at creator_id predicate { term_id label } object { term_id label }
        }
      }`,
      field: 'triples',
      countQuery: `query GetAgentReportCount($id: String!, $pred: String!) {
        triples_aggregate(where: ${where}) { aggregate { count } }
      }`,
      countField: 'triples_aggregate',
      variables: { id: agentId, pred: REPORTED_FOR_TERM_ID },
      pageSize: SERVER_ROW_CAP.triples,
      maxRows: REPORTS_MAX,
    })
    if (page.truncated !== false) throw new Error('report triples not read to the end')
    const rows = page.rows
    if (rows.length === 0) return []
    // created_at ascending: aggregateReports takes the earliest live position as the reporter.
    const positions = await fetchVaultPositions(rows.map((r) => r.term_id), { order: 'created-asc', withMeta: true })
    return aggregateReports(rows, positions)
  } catch (err) {
    console.warn('[fetchAgentReports] error:', err)
    throw err
  }
}

/**
 * Positions on the agent's own vault + its trust counter-vault, aggregated per wallet.
 * null = the read failed (never an empty list for a failure).
 */
export async function fetchAgentBackers(agentId: string): Promise<Backer[] | null> {
  try {
    const t = await gql<{ triples: Array<{ counter_term_id: string | null }> }>(
      `query GetTrustCounter($id: String!, $pred: String!) {
        triples(where: { subject_id: { _eq: $id }, predicate_id: { _eq: $pred } }, limit: 1) { counter_term_id }
      }`,
      { id: agentId, pred: TRUST_PREDICATE_TERM_ID },
    )
    const counter = t?.triples?.[0]?.counter_term_id ?? null
    const ids = counter ? [agentId, counter] : [agentId]
    // Paged: `limit: 200` here used to get at most 100 positions back, silently.
    const positions = await fetchVaultPositions(ids, { order: 'shares-desc', withMeta: true })
    return aggregateBackers(positions, agentId, counter)
  } catch (err) {
    console.warn('[fetchAgentBackers] error:', err)
    return null
  }
}

/**
 * Everything the profile's canonical sections need, in parallel. Never throws:
 * a part whose read failed is null, so the page can say "couldn't read" instead
 * of printing an empty record as a fact.
 */
export async function fetchAgentProfileVector(agentId: string): Promise<AgentProfileVector> {
  const [attested, reports] = await Promise.all([
    fetchAgentAttestations(agentId).catch((err) => { console.warn('[fetchAgentAttestations] error:', err); return null }),
    fetchAgentReports(agentId).catch(() => null),
  ])
  return { attested, reports }
}

export interface ProfileAtom {
  termId: string
  label: string
  data: string | null
  createdAt: string
}

/**
 * Resolve an atom for /agents/[id] BEFORE touching the scored API:
 * `inScope` = matches the AgentScore corpus filter (scored API will 200),
 * `atom` = the raw atom if it exists at all (cohort agents, attested
 * humans like Luda, …) so the route can render the non-scored profile
 * instead of a 404 — and never fires a request it knows will 404 (the
 * console-noise item from 2c). One indexer round-trip.
 */
export async function resolveProfileAtom(termId: string): Promise<{ inScope: boolean; atom: ProfileAtom | null }> {
  try {
    const data = await gql<{
      scoped: Array<{ term_id: string }>
      any: Array<{ term_id: string; label: string | null; data: string | null; created_at: string }>
    }>(
      `query ResolveProfileAtom($id: String!) {
        scoped: atoms(where: { _and: [${AGENT_WHERE_STR}, { term_id: { _eq: $id } }] }, limit: 1) { term_id }
        any: atoms(where: { term_id: { _eq: $id } }, limit: 1) { term_id label data created_at }
      }`,
      { id: termId },
    )
    const row = data?.any?.[0]
    return {
      inScope: (data?.scoped?.length ?? 0) > 0,
      atom: row ? { termId: row.term_id, label: row.label ?? 'Unknown', data: row.data, createdAt: row.created_at } : null,
    }
  } catch (err) {
    console.warn('[resolveProfileAtom] error:', err)
    // Unknown → let the caller fall through to the scored API (old behavior).
    return { inScope: true, atom: null }
  }
}
