# AgentScore Ontology — Architecture Decision Log

> This file captures key ontology decisions made during AgentScore development.
> Each entry records the decision, the debate that preceded it, and the rationale,
> so future contributors (human and AI) don't re-litigate resolved questions.

---

## Decision 1 — `true` / `false` as resolution anchors, not opinion atoms

**Status:** Resolved  
**Participants:** Kryptoremontier (AgentScore), Zet (Intuition core team)

### Decision

`true` and `false` are **permanent resolution anchors** written by trusted publishers via
`[Subject] - resolved to - [true|false]`. They are **not** opinion markets — do not use
them with counter-vault staking to express disagreement.

### Context

Zet raised a valid concern: Intuition's deposit model already encodes boolean opinion — stake
on the support vault means "I agree", stake on the counter-vault means "I disagree". Why add
`true` and `false` atoms? And wouldn't staking on the counter-vault of `[X] - resolved to - [false]`
mean "X is actually true" — a semantic mess?

### Rationale

The distinction is between two fundamentally different epistemic layers:

| Layer | Mechanism | Authority | Mutability |
|---|---|---|---|
| **Stake-weighted opinion** | deposit on support/counter vault | democratic, anyone can enter/exit | shifts continuously as people trade |
| **Authoritative resolution** | `resolved to` triple written by publisher | restricted to trusted whitelist | write-once, permanent anchor |

Three concrete use cases where side-of-deposit is **not** sufficient:

1. **Authoritative finality** — prediction markets, dispute resolution, oracle outcomes.  
   A trusted publisher records the final outcome as a permanent on-chain triple. The support/counter
   vault balance shifts as people trade their opinions; the `resolved to` triple is the immutable
   anchor that everyone can query with `creator.id IN whitelist`.

2. **Asymmetric authority** — stake-weighted opinion is democratic (anyone deposits, anyone exits).
   Resolution is authoritative: only credentialed publishers write it. These are different signals
   for different consumers and should not share the same encoding.

3. **Composability with non-binary outcomes** — `resolved to` can point at `[true]`, `[false]`,
   `[Candidate A]`, `[Token]`, `[Event Outcome]`, `[Settlement Price]`. `true` and `false` are
   just two atoms in a larger family of outcome anchors. The predicate is reusable across any
   finality pattern.

### Anti-patterns to avoid

- **Do not stake on the counter-vault of a resolution triple** — `[X] - resolved to - [false]`
  is an audit record, not a market. Staking on its counter-vault is semantically undefined.
- **Do not use `true`/`false` for subjective ratings** — use score-based predicates or
  stake-weighted opinion directly on the subject atom.
- **Do not query resolution triples without a creator whitelist** — anyone can write a triple;
  `resolved to` is only meaningful when filtered to trusted publishers.

### Related atoms (Intuition ecosystem)

| Atom | Term ID |
|---|---|
| `resolved to` | `0x2c76a5344a15f60565878c8657463f0e2fb201eb05158cf41ad77f8b9d084be1` |
| `true` | `0x4f2874d4ad8b146c86ac84188e86635a794ddbfa4cfc40670a70467e08db36a2` |
| `false` | `0xa8cc267d1c74e7cd83cc8706fc1eb8d732bc5fa3bc4c8f37b2b992a819b9b550` |

### Zet's concern — validated

Zet was correct that for **opinion** use cases, side-of-deposit is strictly cleaner than
creating `true`/`false` triples. The distinction is:

- Authoritative finality → needs `resolved to` + `true`/`false` atoms  
- Stake-weighted opinion → uses deposit side directly, no `true`/`false` needed

---

## Decision 2 — Single `reported for` + object atoms vs three separate predicates

**Status:** Resolved  
**Participants:** Kryptoremontier, Saulo (Intuition core team)

### Decision

Use **one predicate** (`reported for`) combined with **typed object atoms** (`Scam`, `Spam`,
`Prompt Injection`) instead of three separate predicates (`reportedForScam`,
`reportedForSpam`, `reportedForInjection`).

### Context

The testnet implementation used three separate boolean predicates — one per report type.
Each was a different triple shape, making the graph harder to query uniformly and impossible
to extend without adding new predicates to the ontology.

Saulo (Intuition core team) recommended consolidating during a review of the predicate schema.

### Rationale

1. **Composability** — `[Agent] - reported for - [Scam]` and `[Agent] - reported for - [Prompt Injection]`
   share the same predicate. Querying "all things reported for anything" is a single predicate
   filter. With three predicates it requires an OR across predicate IDs.

2. **Graph cleanliness** — the predicate inventory stays compact. New report types (e.g.
   `[Copyright Violation]`, `[Data Poisoning]`) are added as new **object atoms**, not new
   predicates. Predicates are harder to deprecate once published on-chain.

3. **Uniform triple shape** — all report triples are `[Subject] - reported for - [Type]`.
   Downstream consumers (indexers, UIs, MCP tools) handle one shape instead of three.

4. **Counter-vault semantics preserved** — staking on the counter-vault of
   `[Agent] - reported for - [Scam]` cleanly means "I dispute this scam report", which is
   well-defined. This would be muddled with a boolean predicate like `reportedForScam`.

### Migration note

Testnet atoms for the three legacy predicates are abandoned. Mainnet uses `reported for` only.
The object atoms (`Scam`, `Spam`, `Prompt Injection`) are registered as canonical ecosystem atoms.

---

## Decision 3 — `same as` as canonical identity primitive

**Status:** Resolved  
**Participants:** Kryptoremontier, Kylan (Intuition ecosystem)

### Decision

Register `same as` as a first-class predicate following the [Schema.org `sameAs`](https://schema.org/sameAs)
pattern. Use `[Handle/URL] - same as - [Canonical ID]` to link mutable identifiers to
immutable on-chain identities.

### Context

Kylan raised the need to connect mutable handles (Twitter usernames, GitHub handles, domain names)
to immutable on-chain atom IDs. Without a canonical identity primitive, every consumer builds
their own link convention, leading to ecosystem fragmentation — multiple incompatible triples
claiming the same equivalence relationship.

`same as` was added to the predicate inventory as an ecosystem atom with a fixed term ID so
all consumers share one canonical version.

### Rationale

1. **Mutable handle → immutable ID** — on-chain atom IDs are permanent; social handles change.
   `[twitter.com/agent_x] - same as - [0xABC…]` lets consumers resolve the current handle to
   the canonical identity, surviving renames.

2. **Schema.org alignment** — `sameAs` is a well-understood semantic web primitive.
   Using the same concept name reduces the learning curve for Web3 builders familiar with
   linked-data patterns.

3. **One canonical version prevents fragmentation** — if `same as` lacks a fixed term ID,
   builders register their own `sameAs` / `same_as` / `equivalent to` atoms, splitting the
   graph. A single ecosystem atom with a known term ID means all triples are queryable with
   one predicate filter.

4. **Composability** — `same as` composes with any subject/object pair. It is not tied to
   agents; it works for skills, organizations, URLs, or any entity that has both a mutable
   handle and a stable identity.

### Anti-patterns to avoid

- **Do not create project-specific identity predicates** (`agentTwitter`, `agentGithub`, etc.) —
  use `same as` with a typed object atom instead.
- **Do not use `same as` for similarity or resemblance** — it asserts strict equivalence
  (`owl:sameAs` semantics). For softer relationships use `related to`.

---

## Decision 4 — Lowercase with spaces vs camelCase for predicate labels

**Status:** Resolved  
**Participants:** Kryptoremontier (informed by Intuition ontology conventions)

### Decision

All mainnet predicate labels use **lowercase with spaces** (e.g. `resolved to`, `belongs to`,
`reported for`, `same as`, `related to`). CamelCase labels used on testnet are considered
legacy and are not carried to mainnet.

### Context

The testnet predicate set grew organically and included labels like `reportedForScam`,
`isEvaluator`, and `hasSkill`. When designing the mainnet ontology, the question arose
whether to normalize casing or preserve the existing labels for backward compatibility.

Intuition's canonical ecosystem predicates (`resolved to`, `belongs to`, `related to`) all
use lowercase with spaces. Aligning with that convention was the clear choice.

### Rationale

1. **Intuition ontology convention** — the canonical ecosystem predicates already use
   lowercase-with-spaces. Deviating creates visual inconsistency in graph explorers and
   breaks the expectation developers build from the ecosystem docs.

2. **Readability in triple form** — `[Agent] - belongs to - [Domain]` reads as a natural
   English sentence. `[Agent] - belongsTo - [Domain]` does not.

3. **No backward compatibility obligation on testnet** — testnet atoms are throwaway.
   Mainnet is the first durable deployment, so there is no migration cost to normalizing now.

4. **Tooling alignment** — label-based lookup (used throughout `api-data.ts` and the
   predicate inventory) is case-sensitive. A single canonical casing eliminates a class of
   bugs where `"isEvaluator"` fails to match `"IsEvaluator"`.

### Affected predicates (testnet → mainnet rename)

| Testnet label | Mainnet label |
|---|---|
| `reportedForScam` | `reported for` (+ `Scam` object) |
| `reportedForSpam` | `reported for` (+ `Spam` object) |
| `reportedForInjection` | `reported for` (+ `Prompt Injection` object) |
| `isEvaluator` | `is evaluator` |
| `hasSkill` | `has skill` |
| `belongsTo` | `belongs to` |

### Note on label lookup

The predicate inventory (`src/lib/predicate-inventory.ts`) is the single source of truth for
label → term ID mapping. Never hard-code a label string outside that file.
