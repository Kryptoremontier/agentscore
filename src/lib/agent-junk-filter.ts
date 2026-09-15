/**
 * Agent + Forge test-fixture filter — Etap 4a hygiene.
 *
 * Mirrors the shape of skill-junk-filter.ts (classify-style pure function,
 * exported reason enum, counted and surfaced, NEVER silently dropped —
 * thesis §6). A separate module because the rules are different: that one
 * targets skill-corpus LABELS (leaked predicates, vanity self-descriptions);
 * this one targets AGENT/PROJECT REGISTRATIONS (test fixtures, duplicate
 * re-registrations of the same real thing).
 *
 * Two independent mechanisms, deliberately kept apart:
 *
 * (A) BLOCKLIST — pure fixtures only, by EXACT term_id, never by label
 *     (a real agent could legitimately be named "XYZ"). Reserved for atoms
 *     verified live to carry zero ACTIVE stake (shares > 0 on any position).
 *     Regex is a second net for the same fixture *families*, not a
 *     replacement for verifying each ID.
 * (B) FOLD — duplicate re-registrations of the same real thing, resolved
 *     DATA-DRIVEN by a representative-selection chain, never by a
 *     hand-picked ID: most distinct stakers > highest total stake > oldest.
 *     Stakers before stake is deliberate (thesis §4: distinct wallets are
 *     the sybil-safe measure; raw capital is not — a 3-staker atom must
 *     beat a 1-whale atom).
 *
 * Verified live on testnet 2026-09-06 (prod /api/v1/agents, /api/v1/forge/projects):
 * - Blocklist candidates all had exactly 1 self-deposit position (0.00098
 *   tTRUST) except Trust Test Agent Alpha, whose 2 positions are BOTH
 *   fully redeemed to 0 shares (a fully-redeemed position is not an
 *   attestation — same convention as attestation-reader.ts) — judged
 *   equivalent to zero active stake and blocklisted on that basis.
 * - "Code Helper AI" pair: 0x60b8fa47... (3 stakers, 0.2249 tTRUST) beats
 *   0xfd05c1f7... (2 stakers, 0.3322 tTRUST) on the stakers-first rule
 *   DESPITE having less raw stake — exactly the case the chain order exists
 *   for. Neither ID is hardcoded anywhere below; the data decides.
 * - Forge "Agent Score" cluster: all 6 variants have exactly 1 staker each
 *   (the staker-count tier is a tie across the board), so V1.0 (0.315
 *   tTRUST) wins on the stake tier — confirmed by data, not assumed.
 *
 * Label input contract (both mechanisms): callers pass the RAW atom label —
 * api-data.ts's `effectiveLabel(row)` (already resolves the label-vs-data
 * Hasura quirk, see api-data.ts) and agents/page.tsx's own call to that same
 * exported `effectiveLabel`. Neither caller pre-cleans it beyond that. ALL
 * further cleaning for fold-matching (stripping the "Agent:"/"INTU:"
 * wrapper, cutting the " - description" tail, case-folding) happens once,
 * here, in normalizeAgentLabel — so the two fetch paths cannot drift apart
 * on how a label is read (see the 2026-09-06 regression: agents/page.tsx
 * briefly used its own display-name resolver as a workaround instead of the
 * raw label, which happened to normalize differently and silently stopped
 * folding the real Code Helper AI duplicate on that page only).
 */

export type AgentJunkReason = 'test_fixture' | 'blocklisted_id' | 'folded_duplicate'

/**
 * A candidate wraps the caller's own row (`original`) with just the fields
 * this module needs, normalized to one shape. Each of the three call sites
 * (REST/MCP AgentApiItem, client-side GraphQLAgent, ForgeProject) has
 * different field names (id/termId, name/label, supportStake/totalStaked
 * wei-or-ether) — mapping once here avoids forcing a shared field-naming
 * scheme onto three otherwise-unrelated types.
 */
export interface JunkCandidate<T> {
  termId: string
  label: string
  stakerCount: number
  /** Any consistent unit — only ever compared within one filter call. */
  totalStake: number
  createdAt: string
  original: T
}

export interface JunkFilterResult<T> {
  kept: T[]
  junk: Array<{ item: T; reason: AgentJunkReason }>
}

// ─── (A) Blocklist + regex — pure fixtures ────────────────────────────────────

// Full term_ids, lowercase. Each verified live (2026-09-06) to carry zero
// active stake before being added — see file header. Do NOT add an ID here
// without that verification; a real agent with real stake is a duplicate
// (fold, mechanism B) or a real registration, never a blocklist entry.
const BLOCKLIST_IDS: ReadonlySet<string> = new Set([
  '0x999e5bb71e149b98694dd49e9a0aaf172a10de428664d80244792d61234a00e4', // SchemaTest-003
  '0x4cc998ef5da452cd773f7054066fc1ca2567d10b45b34a726bcddbc578dd89f3', // SchemaTest-002
  '0xe7aec6efa6f9056eac7fc1855ae4fe0b260a5546b4ea1f5ea8a3ab9e4f2779d4', // SchemaTest-001
  '0x5cf62914ed17eea568b9e30c4df714d45c6e81e3390f8e64db45af279348bf90', // XYZ
  '0x69eb97b10f25457dd6b6a410d5ca52f6afd975e9d621261d9f1bcd55b7ddf586', // Trust Test Agent Alpha (2 positions, both redeemed to 0)
])

// Second net for the same fixture FAMILIES, in case more are registered
// later under the same naming convention. Deliberately no bare "XYZ" —
// a real agent may be named that; XYZ is handled by ID only, above.
const JUNK_LABEL_PATTERNS: readonly RegExp[] = [
  /^SchemaTest-\d+$/i,
  /^Trust Test Agent\b/i,
]

/** Classify one atom as a pure test fixture, or null if it may be real. */
export function classifyAgentJunk(a: { termId: string; label: string }): AgentJunkReason | null {
  if (BLOCKLIST_IDS.has(a.termId.toLowerCase())) return 'blocklisted_id'
  const label = (a.label ?? '').trim()
  if (JUNK_LABEL_PATTERNS.some((re) => re.test(label))) return 'test_fixture'
  return null
}

// ─── (B) Fold — duplicate re-registrations ────────────────────────────────────

/**
 * Cleans a RAW atom.label for fold-matching. Real raw labels carry one or
 * both wrapper prefixes stacked — "Agent:INTU: Code Helper AI - First
 * On-Chain with Full reputaiton..." — or just one — "Agent: Code Helper AI
 * - The best Claude Code Helper AI on Intuition !" — or already come in
 * pre-cleaned ("Code Helper AI", e.g. from a caller that resolved a display
 * name for its own purposes). All four must fold to the same key: strip
 * "Agent:" first (so a stacked "Agent:INTU:" fully unwraps), then "INTU:",
 * then cut the " - description" tail, then case-fold. This is the ONLY
 * place this cleaning happens — see the file-header note on the label input
 * contract.
 */
function normalizeAgentLabel(label: string): string {
  return label
    .replace(/^Agent:\s*/i, '')
    .replace(/^INTU:\s*/i, '')
    .split(' - ')[0]!
    .trim()
    .toLowerCase()
}

/** "Agent Score V1.0" / "V1.2" / "V1" -> "agent score"; "Talaria" untouched. */
function normalizeForgeLabel(label: string): string {
  return label.replace(/\s*V?\d+(\.\d+)?$/i, '').trim().toLowerCase()
}

/** True if `a` should replace `b` as the group's representative. */
function isBetterRepresentative<T>(a: JunkCandidate<T>, b: JunkCandidate<T>): boolean {
  if (a.stakerCount !== b.stakerCount) return a.stakerCount > b.stakerCount
  if (a.totalStake !== b.totalStake) return a.totalStake > b.totalStake
  return new Date(a.createdAt).getTime() < new Date(b.createdAt).getTime()
}

function foldByNormalizedLabel<T>(
  candidates: readonly JunkCandidate<T>[],
  normalize: (label: string) => string,
): JunkFilterResult<T> {
  const groups = new Map<string, JunkCandidate<T>[]>()
  for (const c of candidates) {
    const key = normalize(c.label)
    const arr = groups.get(key) ?? []
    arr.push(c)
    groups.set(key, arr)
  }

  const kept: T[] = []
  const junk: Array<{ item: T; reason: AgentJunkReason }> = []
  for (const group of groups.values()) {
    let best = group[0]!
    for (const c of group.slice(1)) if (isBetterRepresentative(c, best)) best = c
    kept.push(best.original)
    for (const c of group) if (c !== best) junk.push({ item: c.original, reason: 'folded_duplicate' })
  }
  return { kept, junk }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Filter registered agents: blocklist/regex fixtures out first, then fold
 * duplicate re-registrations of the same real agent. Order matters — a
 * blocklisted fixture must never win a fold as someone else's "duplicate".
 */
export function filterAgents<T>(candidates: readonly JunkCandidate<T>[]): JunkFilterResult<T> {
  const stage1Kept: JunkCandidate<T>[] = []
  const stage1Junk: Array<{ item: T; reason: AgentJunkReason }> = []
  for (const c of candidates) {
    const reason = classifyAgentJunk(c)
    if (reason) stage1Junk.push({ item: c.original, reason })
    else stage1Kept.push(c)
  }
  const { kept, junk: foldJunk } = foldByNormalizedLabel(stage1Kept, normalizeAgentLabel)
  return { kept, junk: [...stage1Junk, ...foldJunk] }
}

/**
 * Filter IntuForge projects: fold only (no test-fixture blocklist exists
 * for forge projects today — all 6 "Agent Score" variants are the same
 * real project re-registered, not fixtures).
 */
export function filterForgeProjects<T>(candidates: readonly JunkCandidate<T>[]): JunkFilterResult<T> {
  return foldByNormalizedLabel(candidates, normalizeForgeLabel)
}
