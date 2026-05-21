# AgentScore — Predicate Integration Guide

> **Single source of truth** for external builders integrating with AgentScore
> predicates on Intuition Protocol mainnet (MetaMask Snap, indexers, MCP clients).
> Copy `term_id` values from the Quick Reference below.

**Related docs:** [`ONTOLOGY_DECISIONS.md`](./ONTOLOGY_DECISIONS.md) (architecture rationale) ·
[`src/lib/predicate-mainnet-ids.ts`](../src/lib/predicate-mainnet-ids.ts) (TypeScript constants)

All `term_id` values below match `MAINNET_TERM_IDS` in
`src/lib/predicate-mainnet-ids.ts` (no unregistered or planned predicates).

---

## Quick Reference — All term_ids

Copy-paste table for integrators. All values are immutable on-chain facts.

### Resolution & Truth

| Label | term_id | Notes |
|-------|---------|-------|
| `resolved to` | `0x2c76a5344a15f60565878c8657463f0e2fb201eb05158cf41ad77f8b9d084be1` | Canonical (PR #7). Filter by trusted publisher. |
| `true` | `0x4f2874d4ad8b146c86ac84188e86635a794ddbfa4cfc40670a70467e08db36a2` | Resolution anchor — not an opinion market. |
| `false` | `0xa8cc267d1c74e7cd83cc8706fc1eb8d732bc5fa3bc4c8f37b2b992a819b9b550` | Resolution anchor — not an opinion market. |

> In TypeScript these are exposed as `MAINNET_TERM_IDS.trueAtom` and
> `MAINNET_TERM_IDS.falseAtom` (the on-chain labels remain `true` / `false`).

### Structure

| Label | term_id | Notes |
|-------|---------|-------|
| `related to` | `0xa1fadfcf5e29bd37e048625f1deee9a6374b249fcda4905649a85022c74070ec` | Canonical (PR #7). Links entities (e.g. name atom → metadata atom). |
| `belongs to` | `0x3317b232b1d59ae421283a4ce4d8bef0f739574c3a53386d5d8597d4b272d4e8` | Canonical (PR #7). Membership / grouping. |
| `same as` | `0xbeebfb7d177cbd96ffc239d2196c72ec346efe81f39dc595773f13d83506f5f0` | AgentScore-registered. Identity equivalence (Schema.org `sameAs`). |

### Reputation

| Label | term_id | Notes |
|-------|---------|-------|
| `trusts` | `0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9` | REUSE from Intuition Ontology. Positive trust. |
| `opposes` | `0x3ce0f03b579b0b3d2dcbfbbfb7adb0dd00ab2cf3393ab7201518fabae6dc05f7` | AgentScore-registered. Counter-signal to `trusts`. |
| `evaluated by` | `0xb769bc51460e2dc29927c825f743238174c02901603a0c9604dd2e8ea40f8226` | AgentScore-registered. Subject ↔ evaluator link. |
| `has agent skill` | `0x638fd866e4564e213a11ebeb98bbaea58e81f677860d90fa4ad01e50bb007108` | AgentScore-registered. Agent ↔ skill capability. |

### Safety (reports)

| Label | term_id | Notes |
|-------|---------|-------|
| `reported for` | `0x51f1febac0b9d05953442f082597c5d1ce827bd2f888446ad811692e0a0f428d` | Generic predicate — object atom carries category. |
| `Scam` (object) | `0x27f33aaa8e3ff821e0eff6fedfec0b20a29164e21848c5f33e736eede13c39ba` | `[Subject] — reported for — Scam` |
| `Spam` (object) | `0x6ae6a37850484a61d76ad868c83d1bbe4d6975fa29cd724d7485141a03cde78f` | `[Subject] — reported for — Spam` |
| `Injection` (object) | `0x8e7674f0813f000a12951d8bf1ea4c8ffac05a2ab5d56fc4f9550a0a19a5887a` | `[Subject] — reported for — Injection` |

### Tag

| Label | term_id | Notes |
|-------|---------|-------|
| `In Use By AgentScore` | `0xed484ed04e06699c7815f18654c0f48f3e3ba32d25bd5d7289c92532b1910b89` | Tag atom applied to predicates above. |

**GraphQL endpoint:** `NEXT_PUBLIC_INTUITION_GRAPHQL_URL` (Hasura indexer for Intuition mainnet/testnet).

---

## Canonical Ontology Predicates (PR #7 — merged)

These five predicates are part of the **Intuition Ontology** canonical set, merged via
[PR #7](https://github.com/intuition-box/Ontology/pull/7) into [`ontology.intuition.box`](https://ontology.intuition.box).
**Do not register duplicates** — reuse these `term_id` values in all triples.

### `resolved to`

| Field | Value |
|-------|-------|
| **term_id** | `0x2c76a5344a15f60565878c8657463f0e2fb201eb05158cf41ad77f8b9d084be1` |
| **Purpose** | Authoritative finality anchor. A trusted publisher records the outcome of a claim, dispute, or oracle result. **Not** an opinion market — do not stake on counter-vaults of resolution triples. |
| **Example triple** | `[Prediction Market] — resolved to — [true]` |
| **Consumer rule** | Always filter `creator.id` against a trusted-publisher whitelist (see [Publisher Filter Pattern](#publisher-filter-pattern)). |

### `related to`

| Field | Value |
|-------|-------|
| **term_id** | `0xa1fadfcf5e29bd37e048625f1deee9a6374b249fcda4905649a85022c74070ec` |
| **Purpose** | General association between two entities. AgentScore uses it to link a clean **name atom** to a **metadata atom** (e.g. IntuForge: `[ProjectName] — related to — [JSON metadata atom]`). |
| **Example triple** | `[MyProject] — related to — [0xABC…metadata]` |

### `belongs to`

| Field | Value |
|-------|-------|
| **term_id** | `0x3317b232b1d59ae421283a4ce4d8bef0f739574c3a53386d5d8597d4b272d4e8` |
| **Purpose** | Membership or grouping — entity A is part of / belongs to entity B (domain, organization, category). |
| **Example triple** | `[Agent] — belongs to — [DeFi Agents]` |

### `true`

| Field | Value |
|-------|-------|
| **term_id** | `0x4f2874d4ad8b146c86ac84188e86635a794ddbfa4cfc40670a70467e08db36a2` |
| **Purpose** | Resolution **object atom** — the affirmative outcome anchor. Used as the object in `[Subject] — resolved to — [true]`. |
| **Example triple** | `[Will BTC hit 100k by 2026?] — resolved to — [true]` |

### `false`

| Field | Value |
|-------|-------|
| **term_id** | `0xa8cc267d1c74e7cd83cc8706fc1eb8d732bc5fa3bc4c8f37b2b992a819b9b550` |
| **Purpose** | Resolution **object atom** — the negative outcome anchor. Used as the object in `[Subject] — resolved to — [false]`. |
| **Example triple** | `[Will BTC hit 100k by 2026?] — resolved to — [false]` |

> **Distinction:** `true`/`false` are permanent anchors for authoritative resolution.
> For stake-weighted *opinion*, use deposit side on the subject's vault directly —
> do not create `resolved to` triples for subjective ratings. See
> [`ONTOLOGY_DECISIONS.md` Decision 1](./ONTOLOGY_DECISIONS.md#decision-1--true--false-as-resolution-anchors-not-opinion-atoms).

---

## Publisher Filter Pattern

> **Principle: Data is open — trust is not.**

### Why

Anyone can write any triple on Intuition Protocol. A scammer can write
`[YourAgent] — reported for — Scam` or `[YourAgent] — resolved to — [false]`.
**Reading all triples without filtering is unsafe.** Consumers must apply a
**publisher whitelist** before treating a triple as trusted signal.

This applies especially to:

- **`resolved to`** — only meaningful from credentialed publishers (oracle, admin, dispute resolver)
- **`reported for`** — weight by reporter reputation; ignore anonymous/low-stake reporters
- **`opposes`** — counter-vault stakes are democratic; publisher identity still matters for audit

### How — three-level filter

```typescript
// 1. Define trusted publishers (EIP-55 checksummed — required for Hasura filters)
const TRUSTED_PUBLISHERS = [
  '0xYourOracleAddress...',
  '0xAgentScoreAdmin...',
] as const

// 2. Predicate + subject match (example: authoritative resolution)
const RESOLVED_TO = '0x2c76a5344a15f60565878c8657463f0e2fb201eb05158cf41ad77f8b9d084be1'
const TRUE_ATOM     = '0x4f2874d4ad8b146c86ac84188e86635a794ddbfa4cfc40670a70467e08db36a2'

// 3. Apply all three filters when processing triples from GraphQL
function isTrustedResolution(triple: {
  subject_id: string
  predicate_id: string
  object_id: string
  creator: { id: string }
}): boolean {
  return (
    triple.subject_id === agentTermId &&
    triple.predicate_id === RESOLVED_TO &&
    triple.object_id === TRUE_ATOM &&
    TRUSTED_PUBLISHERS.includes(triple.creator.id as typeof TRUSTED_PUBLISHERS[number])
  )
}
```

### GraphQL filter (server-side)

Combine `creator_id` whitelist with predicate/subject filters in one query:

```graphql
query TrustedResolutions($agentId: String!) {
  triples(where: {
    subject_id: { _eq: $agentId }
    predicate_id: { _eq: "0x2c76a5344a15f60565878c8657463f0e2fb201eb05158cf41ad77f8b9d084be1" }
    creator_id: { _in: ["0xYourOracleAddress...", "0xAgentScoreAdmin..."] }
  }) {
    term_id
    object_id
    creator { id }
    created_at
  }
}
```

### Anti-patterns

| Anti-pattern | Why it's wrong |
|--------------|----------------|
| Trusting any `resolved to` triple | Spoofed resolutions from arbitrary wallets |
| Staking on counter-vault of a resolution triple | Resolution triples are audit records, not markets |
| Lowercase addresses in GraphQL `_in` / `_eq` | Hasura stores EIP-55 checksummed addresses — lowercase filters silently match nothing |
| Using `atom.creator_id` to find who registered an agent | FeeProxy is `creator_id` but user wallet is `positions[0]` (first holder by `created_at asc`) |

---

## Querying Predicates (GraphQL)

Practical patterns for external builders querying the Intuition Hasura indexer.
Full performance rules: [`docs/architecture/scoring-and-performance.md`](./architecture/scoring-and-performance.md).

> **Field naming:** Intuition Hasura uses **snake_case** (`subject_id`, `predicate_id`,
> `object_id`, `creator_id`). Nested relations use GraphQL object syntax (`creator { id }`).

### a) All triples for a subject with a specific predicate

Filter by `subject_id` (the entity's `term_id`) + `predicate_id` (predicate atom's `term_id`):

```graphql
query AgentSkills($agentTermId: String!) {
  triples(where: {
    subject_id: { _eq: $agentTermId }
    predicate_id: { _eq: "0x638fd866e4564e213a11ebeb98bbaea58e81f677860d90fa4ad01e50bb007108" }
  }) {
    term_id
    object_id
    object { label data }
    creator { id }
    created_at
  }
}
```

Equivalent via nested `as_subject_triples` on the atom (≤2 JOIN levels — fast):

```graphql
query AgentWithSkills($agentTermId: String!) {
  atoms(where: { term_id: { _eq: $agentTermId } }, limit: 1) {
    term_id
    label
    as_subject_triples(
      where: {
        predicate: { term_id: { _eq: "0x638fd866e4564e213a11ebeb98bbaea58e81f677860d90fa4ad01e50bb007108" } }
      }
    ) {
      term_id
      object { term_id label }
      creator { id }
    }
  }
}
```

### b) Safety check — is an address reported?

Check for active reports: `subject = agent`, `predicate = reported for`, `object IN (Scam, Spam, Injection)`.

```graphql
query ActiveReports($agentTermId: String!) {
  triples(where: {
    subject_id: { _eq: $agentTermId }
    predicate_id: { _eq: "0x51f1febac0b9d05953442f082597c5d1ce827bd2f888446ad811692e0a0f428d" }
    object_id: { _in: [
      "0x27f33aaa8e3ff821e0eff6fedfec0b20a29164e21848c5f33e736eede13c39ba",
      "0x6ae6a37850484a61d76ad868c83d1bbe4d6975fa29cd724d7485141a03cde78f",
      "0x8e7674f0813f000a12951d8bf1ea4c8ffac05a2ab5d56fc4f9550a0a19a5887a"
    ]}
  }) {
    term_id
    object_id
    object { label }
    creator { id }
    created_at
  }
}
```

**Recommended:** apply publisher/reporter reputation filter in application code
(see [Publisher Filter Pattern](#publisher-filter-pattern)). Counter-vault stake on
`[Agent] — reported for — [Scam]` means "I dispute this report" — well-defined semantics.

TypeScript constants: `src/lib/predicate-mainnet-ids.ts` (`MAINNET_TERM_IDS.reportedFor`, `.scam`, `.spam`, `.injection`).

### c) Deep JOIN workaround — positions vs creator_id

**Never use 4-level position JOINs** — they always timeout on Hasura:

```graphql
# ❌ ALWAYS TIMES OUT
positions(where: { vault: { term: { atom: { label: { _ilike: "%agent%" } } } } })
```

**Two-fetch pattern** (from production AgentScore code):

```typescript
// Fetch 1: get term_ids by label/triple filter (~1s)
const { atoms } = await gql(`{
  atoms(where: { label: { _ilike: "agent:%" } }, limit: 500) {
    term_id
  }
}`)
const termIds = atoms.map((a: { term_id: string }) => a.term_id)

// Fetch 2: positions filtered by vault.term_id _in [...] (1 JOIN, fast)
const { positions } = await gql(`{
  positions(
    where: { vault: { term_id: { _in: ${JSON.stringify(termIds)} } } }
    order_by: { created_at: asc }
  ) {
    account_id
    shares
    vault { term_id }
  }
}`)
```

**FeeProxy registrant detection** — do not use `atom.creator_id`:

```typescript
// FeeProxy calls createAtoms(receiver, ...) — shares go to receiver (user wallet).
// positions[0] ordered by created_at asc = real registrant
const firstHolderByVault = new Map<string, string>()
for (const p of positions) {
  const vid = p.vault?.term_id
  if (vid && !firstHolderByVault.has(vid)) {
    firstHolderByVault.set(vid, p.account_id)
  }
}
```

**Address casing rule:**

```typescript
// GraphQL filters — MUST be EIP-55 checksummed
const FEE_PROXY_CS = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41'
// positions(where: { account_id: { _neq: "${FEE_PROXY_CS}" } })  ✅

// JS comparisons after fetch — lowercase is fine
if (p.account_id?.toLowerCase() === '0x2f76ef07df7b3904c1350e24ad192e507fd4ec41') { ... }
```

**Other Hasura quirks:**

- Use `creator { id }` not `account { address }`
- `atom.label` shows `"json object"` for JSON atoms — read `atom.data` instead
- `as_subject_triples` (2-level JOIN) is fast; only `positions` 4-level JOINs timeout
- Order atoms by `created_at: desc` not `vault: desc`

---

For the internal registration workflow (portal steps, icon generation, Phase 0–4),
see [`PREDICATE_REGISTRATION_WORKFLOW.md`](./PREDICATE_REGISTRATION_WORKFLOW.md).
