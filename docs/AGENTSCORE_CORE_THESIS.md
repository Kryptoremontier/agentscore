# AGENTSCORE — CORE THESIS
> Product constitution · v1.1 (v1.0 2026-06-21 + ERC-8004 addendum 2026-07-22, merged 2026-08-27)
> Author: kryptoremontier · STATUS: binding — every product and code decision must be
> consistent with this document. Core sections (1–4) change by explicit decision, never by drift.
> Agents (Cursor / INTU / advisors): read this before proposing strategy or architecture.

---

## 1. THE QUESTION WE ANSWER

billy (Intuition CEO), publicly, twice: *"Domain ontology is the biggest unsolved
piece — someone must build it on-chain"* and *"Interpretation pattern: whose
attestations are official — someone must start. That establishes the root of trust."*

Combined into one user question:

**"Whom should I believe that agent X is good in domain Y — and how do I know?"**

This is AgentScore's ONLY question. Every tab, score, and pixel either answers it
or should not exist. Ecosystem support: wieedze/matt_chain ("global agent score =
wrong unit", "best DeFi agent ≠ best research agent", "reputation is a property of
relationships"); Zet ("a list is a pair of atoms — compute lists on top of any
couple"; minimal identity on-chain, context off-chain). The official ERC-8004
launch (§7) made this framing the ecosystem's own headline: "who reputes the reputer?"

## 2. WHY NOBODY ANSWERS IT (measured, not assumed)

Mainnet recons (June 2026): categories ∩ reputation = 0/41 entities; trusts graph
is a star (1 wallet = 57%); evaluated by / opposes / refutes = 0 triples;
"agent X is good in domain Y according to trusted Z" = **not one row existed**.
The data layer billy asks about was EMPTY — a market gap, not an obstacle.
AgentScore therefore cannot be a reader of data that doesn't exist: **it must be
the place where that data is CREATED.**

## 3. THE UNIQUE STRUCTURE: AGENTSCORE TRUST STACK

```
LAYER 3 — INTERPRETATION ("whose attestations count")
  Trust tiers: T1 seed curators · T2 your own circle · T3 everyone.
  Score is a function of the chosen tier. No single global score.
LAYER 2 — ATTESTATIONS ("who claims what, with what stake")
  The canonical data unit (§4), created IN AgentScore via FeeProxy.
  Plus (v1.1): AgentScore as an ERC-8004 Trust Provider publishing
  its computed scores via the official provider pattern (§7).
LAYER 1 — ONTOLOGY ("which domains exist")
  8 canonical buckets as the human display lens, CURATING A MAPPING onto
  the official OASF taxonomy (v1.1 pivot — see §7; we no longer mint
  mid-level taxonomy ourselves). Junk filter + atom-dedup (refineSkillTriples)
  as the read discipline for a fragmented graph.
```

Nobody else has all three: ARP has a staking fragment of L2; curator 0x665e3192
had a fragment of L1; ERC-8004 providers (Helixa, AsterPay) publish scores without
domain scoping or community attestation surface. **AgentScore = the only full stack.**

## 4. THE CANONICAL DATA UNIT — AN ATTESTATION

```
TRIPLE:    [agent] — is skilled in — [canonical domain]
POSITIONS: stake FOR (vault) / stake AGAINST (counter-vault)
EACH POSITION HAS A WALLET → that wallet IS the attester
```

Rules: (1) reuse `is skilled in` 0xe332e7d6… (cross-network, never mint a new
competence predicate); (2) object = canonical domain atom ONLY, no free text in
the UI — cleanliness at the source; (3) the attester is EXPOSED, never hidden —
"5 attestations" always expands to "by whom"; (4) negative side: `reported for`
+ our safety taxonomy; (5) sybil resistance at the base: dedup by wallet
(distinct attesters), a fully-redeemed position is not an attestation.

## 5. TABS = USER QUESTIONS

- **DOMAINS** — "I need an agent for domain X: who is verified and BY WHOM?"
  ✓ Attested section (staked claims, visible authors) strictly separated from
  Ecosystem signals (unweighted tags). Live since 2026-08-27 (Etap 2a).
- **AGENTS** — "Should I trust this one: good at what, who stands behind it,
  any reports?" Attest Competence = the primary action (Etap 1, live).
- **CURATORS (future)** — "Whose attestations mean something?" (evaluator score).
- **ATTEST FLOW (function, the heart)** — find-or-create-then-stake via FeeProxy;
  every attestation = a data row the ecosystem lacks + revenue.

## 6. HONESTY WITH SPARSE DATA (iron rule)

No data = **"Unverified"** + "be the first" CTA — never a fake score. Empty
states are growth engines. Score is layered (feature-flagged): v1 = distinct
attesters × stake → v2 = + attester quality (evaluator score) → v3 =
+ personalized trust-rank (Trust Flow Engine, when the graph matures).
Statistical discipline (adopted from the technocore audit, matching this
section's spirit): null ≠ 0.0; every ratio ships with its window size;
shrinkage for small samples.

## 7. THE ERC-8004 LAYER (v1.1 — what changed 2026-07-21)

Intuition shipped the official ERC-8004 reputation layer: ~100-agent cohort as
canonical Atoms (`same as` → CAIP), the 4-triple provider pattern
(`has trust provider` / `has trust assessment` / `provided by` + mutable JSON at
a resolver URL), stakeable provider credibility, and the **OASF taxonomy**
(137 skills + 205 domains, `has category` hierarchy) as the official agent
classification. Consequences:

- **L1 pivot: we MAP, we don't mint.** The 17-subcategory minting plan is
  FROZEN permanently. Buckets sit above OASF as a display lens; the mapping
  table (OASF → bucket) is code, pattern = skill-domain-map.
- **Semantic split that keeps our L2 intact:** `has tag {oasf}` = what an agent
  DECLARES; `is skilled in + stake` = what the community ATTESTS. Both valid,
  different things.
- **AgentScore as Trust Provider (Etap 2b, needs Partner API key):** publish our
  computed scores ONLY via the official provider pattern (resolver JSON with
  dimensions + Ed25519 signature + "highest version that verifies" rollback
  rule). Never as direct mutable triples. AsterPay = the reference shape;
  Helixa's inconsistent subject anchoring = the anti-pattern.
- **L3 confirmed empty:** one bot wallet stakes uniformly on every provider
  edge of both launch partners — no organic provider-credibility market yet.
  Our interpretation tiers remain undeveloped terrain.
- **Testnet canon is itself fragmented** (duplicate OASF atoms, orphaned
  documented IDs, hierarchy on residue atoms): consume canon with
  dual-resolution + fold-to-representative. Never trust a single documented
  term_id on testnet without verification.

## 8. MINES (do not step on)

1. Do NOT mint the 17 subcategories (frozen — OASF covers the level).
2. Do NOT mint a new competence predicate (reuse is skilled in).
3. Do NOT write mutable scores as direct triples (provider pattern only).
4. Testnet OASF/trust-pattern atoms: dual-resolution always (duplicates exist).
5. Do NOT return to the abandoned 15-fold raw-atom batch (June).
6. Fully-redeemed positions are not attestations (code enforces this).
7. "Renders on a route" ≠ "reachable by a user" — verify the real user path,
   on the deployed preview, both viewports.

## 9. WHAT WE DON'T DO

No fake scores. No flat-reputation race with ARP (we answer "good at WHAT and
according to WHOM"). No duplicate minting — reuse-first, recon before mint.
No mixing attested signal with ecosystem noise. No hiding the "who".

## 10. ROADMAP (status 2026-08-27)

- **Etap 1 ✅** Attest Flow MVP — live, E2E-verified, first attestation on-chain
  2026-07-11 (Luda → Knowledge/Productivity, triple 0x54c64639…).
- **Etap 2a ✅** DOMAINS Attested section — live in production (301f0d2).
- **Agent-surface track (from the technocore audit, in progress):**
  REPO_MAP → public machine-readable surface (llms.txt + content negotiation on
  existing score endpoints + SKILL.md + agent.json; reuse /agents/:id/trust and
  /agents/:id/card — do not duplicate routes).
- **Engagement signals (technocore Etap 3): phase B PARKED by recon verdict
  (2026-09-03)** — 100% of agents null in a 90-day window; reciprocity does
  not map to a stake-on-claim substrate (closest proxy: co-staking).
  Re-run the recon when (i) ≥10 real registered agents have ≥3 distinct
  non-self stakers in a rolling 90d window, OR (ii) ≥20 attested
  (agent, domain) pairs have ≥3 distinct attesters each. Bottleneck is
  Attest Flow adoption, not signal math.
- **Etap 2b** (blocked on Partner API key application — postponed, tracked):
  provider identity + resolver JSON (with signature + anti-rollback).
- **Etap 2c** ERC-8004 cohort in DOMAINS via OASF→bucket mapping; attest flow
  targeting cohort agents (zero overlap today = we build the first bridges).
- **Etap 3-5** AGENTS profile per thesis · interpretation tiers + CURATORS ·
  identity predicates (incl. did:key claimed→verified via on-chain reverse proof).
- **Housekeeping debt:** INTU's stash (verify graphql-client/domain-data liveness
  BEFORE applying), bucket-source unification TODO (4af870e), Next.js bump +
  npm audit, docs upkeep.

## 11. THE THESIS IN ONE SENTENCE

**AgentScore is the first full trust stack for AI agents: a curated ontology
lens over the official taxonomy (L1), staked attestations with visible authors
created in-app plus provider-published scores (L2), interpreted through a
chosen circle of trust (L3) — a working answer to "whom to believe that agent X
is good in domain Y", in an ecosystem where identity proves WHO and AgentScore
says WHETHER IT'S WORTH IT.**
