# AgentScore — Mainnet Predicates Registration Guide

> Complete checklist for manually registering all canonical AgentScore predicates
> on Intuition Portal (mainnet). Follow Saulo's convention — lowercase names with
> spaces, Schema.org JSON-LD format, IPFS-hosted icons.

---

## ⚠️ CRITICAL — Check for Existing Atoms FIRST

**The Intuition Protocol is a SHARED ontology.** Many of these predicates may
already exist on mainnet, created by Saulo, the Intuition team, or other
community members. **Never duplicate** — always reuse.

### Why this matters

1. **Fragmentation kills interop** — if AgentScore writes
   `Agent → trusts(NEW) → X` while another dApp uses `Agent → trusts(OLD) → X`,
   neither side can aggregate the other's stakes. Community trust gets split.
2. **Stakes accumulate on one atom** — reusing the popular `is better than`
   (3.32K $TRUST, 9 holders) gives our triples instant economic gravity.
3. **Saulo's "Recommended Predicates" are canonical** — the Intuition team
   curates these as the official ontology. Use them.
4. **Cost & gas** — registering a duplicate burns ~0.001 $TRUST + fees for
   nothing. The protocol may even reject it (term_id collision if JSON identical).

### Confirmed existing on mainnet (DO NOT REGISTER)

Based on portal observation:

| Name | Creator | Status | Recommended Action |
|------|---------|--------|--------------------|
| `is better than`     | `0x9F23...e3B1` | ✅ Exists, 9 holders, 3.32K $TRUST | **REUSE term_id** |
| `belongs to`         | (Saulo)         | ✅ Recommended Predicate | **REUSE term_id** |
| `related to`         | (Saulo)         | ✅ Recommended Predicate | **REUSE term_id** |
| `resolved to`        | (Saulo)         | ✅ Recommended Predicate | (not in our list) |
| `true` / `false`     | (Saulo)         | ✅ Recommended Predicate | (not predicates) |

### Phase 0 — Discovery Workflow (DO THIS FIRST)

For **every** predicate in this doc, before generating an icon or writing a
description:

1. Open https://portal.intuition.systems/explore (mainnet)
2. Search for the exact lowercase-with-spaces name (e.g. `trusts`, `endorses`,
   `vouches for`, `depends on`)
3. Look for atoms tagged **"Recommended Predicates"** with a non-zero holder count
4. **If found** → record the `term_id` in the tracker below as `✅ REUSE: 0x...`
   and skip Phases 1–3 for that predicate
5. **If not found** → proceed with Phases 1–3 (generate icon, register, etc.)

Likely candidates to search for first (high probability of existing):

- `trusts` — fundamental trust predicate, very generic
- `endorses` — generic recommendation predicate
- `vouches for` — common social-trust predicate
- `depends on` — generic dependency relationship
- `works well with` — common compatibility relationship
- `is alternative to` — common substitution relationship
- `verified by` — standard attestation pattern
- `is certified by` — standard credential pattern

Likely AgentScore-specific (probably need to register):

- `has agent skill` — domain-specific to AI agents
- `evaluated by` — specific to AgentScore evaluator pattern
- `delegated to` — agent-to-agent composability
- `enhances` — capability extension
- `works bad with` — negative compatibility
- `opposes` — negative trust (might exist as generic)
- `reported for scam` / `reported for spam` / `reported for injection` — moderation specific

### Saulo consultation draft (send before registering anything new)

> Hi Saulo — before AgentScore mainnet launch I'm planning to wire up a small
> set of predicates. Here's what I found in Phase 0 discovery:
>
> - `trusts` → **found, will REUSE** ✅ (term_id: `0x3a73f3b1...`)
> - `opposes` → **found as `Opposes`** (capital O) — wrong lowercase convention.
>   Planning to create canonical lowercase `opposes` and open a PR to the
>   Intuition Ontology repo, same pattern as PR #7 for `resolved to`. Does that
>   make sense, or is there a preferred existing atom I should reuse instead?
> - `has agent skill`, `evaluated by`, `reported for` — AgentScore-specific,
>   will create fresh.
>
> Happy to sync on Discord if easier. Thanks!

### What if my description differs from the existing atom?

**Use the existing atom anyway.** The `description` field on a predicate atom
is just metadata — what matters semantically is the relationship name and the
shared term_id. Document AgentScore's specific usage in our own docs/UI, not on
the predicate atom itself.

The deterministic `term_id` is computed from the JSON-LD content — if you write
a different description, you get a NEW term_id, which means a NEW atom, which
defeats the entire purpose. Reuse the existing one as-is.

---

## Registration UI

Use **https://portal.intuition.systems** (mainnet portal) → **Create Identity**:

For each predicate fill:

| Field | Value |
|-------|-------|
| **Type** | `Thing` (Schema.org) |
| **Name** | (see below — lowercase with spaces) |
| **Description** | (see below — full multi-line text) |
| **Image** | Upload generated icon to IPFS first, then paste `ipfs://<CID>` |
| **URL** | leave empty (or `null`) |

---

## Icon Generation Style Guide

All icons follow the same minimal flat style as `belongs to`, `related to`,
`true`, `false`, `resolved to`:

- **Format:** PNG or JPEG (with .png extension), **MUST BE 1024×1024 SQUARE**
- **Aspect ratio:** Strict 1:1 — portal rejects non-square uploads
- **Style:** Minimal, flat, single dominant color, soft glow/shadow
- **Composition:** Single recognizable symbol, centered, on solid black background
- **Mood:** Web3 / cyberpunk friendly, clean, professional

**Universal prompt prefix** (use for every icon — emphasize SQUARE explicitly):

```
Minimal flat vector icon, 1024x1024 SQUARE aspect ratio, solid black
background, single recognizable symbol centered, soft outer glow, web3
cyberpunk style, no text, professional, clean lines, slight gradient,
dark-mode optimized. CRITICAL: image must be perfectly square 1:1.
Subject:
```

### ⚠️ Common Failure: Portal rejects non-square images

The Intuition Portal does server-side validation requiring **1:1 square aspect
ratio**. ChatGPT/DALL-E sometimes returns 682×1024 (portrait) or 1024×682
(landscape) if the prompt contains words like "tall", "wide", "vertical".

**Symptoms:** Upload preview shows broken image / red X, error message at
submit. The file format itself doesn't matter — JPEG-with-.png-extension works
fine if dimensions are 1024×1024.

**Fix:** If your generated icon is non-square, run it through the conversion
script in `docs/predicate-icons/` to pad it to 1024×1024, OR re-prompt with
explicit "1024x1024 SQUARE" instruction.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CORE — Required for Trust Score Engine
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1. has agent skill ⭐ REQUIRED

**Description:**
```
Declares that an Agent possesses a specific Skill or capability.
Usage: [Agent] — has agent skill — [Skill]. Powers AgentScore Domain
Leaderboards by aggregating skill-tagged agents per knowledge domain.
Stake-weighted: more support increases the agent's score in that skill.
```

**Icon prompt:**
```
[universal prefix] a glowing diamond/gem with an inner spark of light,
amber-gold color (#C8963C), representing skill mastery and capability,
faceted geometric shape.
```

---

### 2. trusts ⭐ REQUIRED

**Description:**
```
Positive trust attestation toward an entity.
Usage: [Person/Agent] — trusts — [Agent]. Stakes on this triple count
as positive signal in the Trust Score formula. Pairs with `opposes`
as a counter-vault for balanced scoring.
```

**Icon prompt:**
```
[universal prefix] a hand giving a thumbs-up encircled by a glowing ring,
emerald-green color (#2ECC71), representing positive trust and confidence,
warm and reassuring.
```

---

### 3. opposes ⭐ REQUIRED

**Description:**
```
Negative attestation against an entity.
Usage: [Person/Agent] — opposes — [Agent]. Counter-vault to `trusts`;
stake here pushes the Trust Score down. Used by AgentScore for the
support-vs-oppose ratio that drives the scoring envelope.
```

**Icon prompt:**
```
[universal prefix] a hand giving a thumbs-down with a red glowing aura,
crimson red color (#EF4444), representing rejection and dissent,
slight outline.
```

---

### 4. evaluated by ⭐ REQUIRED

**Description:**
```
Links an Agent to a community evaluator who reviewed it.
Usage: [Agent] — evaluated by — [Evaluator]. Powers the Evaluator
leaderboard (accuracy-weighted reputation 0.5x–1.5x). Higher-tier
evaluators carry more weight per stake unit.
```

**Icon prompt:**
```
[universal prefix] a magnifying glass over a star, deep blue color
(#38B6FF), representing scrutiny and judgment by experts, analytical.
```

---

### 5. delegated to (optional)

**Description:**
```
One Agent delegates trust authority to another.
Usage: [Agent] — delegated to — [Agent]. Used for agent-to-agent
composability, e.g. an orchestrator delegating subtask trust to
specialist agents.
```

**Icon prompt:**
```
[universal prefix] two interconnected nodes with a directional arrow
between them passing a glowing token, teal cyan color (#2EE6D6),
representing transfer of authority, network/graph aesthetic.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CAPABILITY — Certifications & Qualifications
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 6. is certified by ⭐ REQUIRED

**Description:**
```
Records that an Agent or Skill has been formally certified.
Usage: [Agent/Skill] — is certified by — [Authority]. Consumers should
filter by trusted authority address to ensure the cert is from a
recognized issuer; anyone can write this triple.
```

**Icon prompt:**
```
[universal prefix] an official certificate scroll with a gold seal/medal,
emerald-green color (#2ECC71), representing official authorization and
credibility, ribbon detail.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## RELATIONSHIP — Discovery Between Agents
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 7. works well with ⭐ REQUIRED

**Description:**
```
Confirms two Agents are compatible in a workflow.
Usage: [Agent] — works well with — [Agent]. Drives discovery in the
AgentScore explorer ("agents that work well with X"). Symmetric in
meaning but stored directionally on-chain.
```

**Icon prompt:**
```
[universal prefix] two hands shaking with a soft heart-glow above them,
emerald-green color (#2ECC71), representing compatibility and partnership,
warm friendly aesthetic.
```

---

### 8. is alternative to ⭐ REQUIRED

**Description:**
```
Marks two Agents as serving a similar function.
Usage: [Agent] — is alternative to — [Agent]. Useful for substitute
discovery when an agent is unavailable, deprecated, or simply for
comparison shopping in a domain leaderboard.
```

**Icon prompt:**
```
[universal prefix] two parallel arrows pointing in opposite horizontal
directions (left-right swap), neutral gray-silver color (#B5BDC6),
representing interchangeability, balanced symmetry.
```

---

### 9. depends on (optional)

**Description:**
```
Records a runtime or capability dependency between Agents.
Usage: [Agent] — depends on — [Agent/Skill]. Helps users understand
the trust graph: trusting Agent A may transitively rely on the
reliability of Agent B.
```

**Icon prompt:**
```
[universal prefix] two chain links interlocked, with one anchor weight
hanging below, slate-blue color (#B5BDC6), representing dependency and
reliance, structural integrity feel.
```

---

### 10. enhances (optional)

**Description:**
```
One Agent extends or improves the capabilities of another.
Usage: [Agent] — enhances — [Agent]. Distinct from `depends on` —
the enhancing agent is optional but additive.
```

**Icon prompt:**
```
[universal prefix] a sparkle/sparkles icon adding shine to an upward
arrow, golden color (#C9A84C), representing improvement and elevation,
magical boost feel.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## OPINION — Stakeable Community Sentiment
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 11. is better than (optional)

**Description:**
```
Subjective comparison between two Agents or Skills.
Usage: [Agent] — is better than — [Agent]. Stakeable opinion — the
community votes with tTRUST on which side they support. No global
meaning beyond aggregated stakes.
```

**Icon prompt:**
```
[universal prefix] two ranking podium tiers with one taller, an upward
trending line above, sky-blue color (#38B6FF), representing comparison
and superiority, competitive analytics.
```

---

### 12. works bad with (optional)

**Description:**
```
Confirms two Agents are incompatible or conflict in workflows.
Usage: [Agent] — works bad with — [Agent]. Inverse of `works well
with`; warns integrators of known integration issues.
```

**Icon prompt:**
```
[universal prefix] two crossed swords with a tiny lightning spark at
the intersection, crimson red color (#FF4D4F), representing conflict
and incompatibility, warning aesthetic.
```

---

### 13. endorses (optional)

**Description:**
```
Public endorsement from one entity to another.
Usage: [Person/Agent] — endorses — [Agent/Skill]. Lighter weight than
`is certified by`; appropriate for personal recommendations.
```

**Icon prompt:**
```
[universal prefix] a megaphone with three small star sparks emanating
forward, sky-blue color (#38B6FF), representing public recommendation
and amplification.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ATTESTATION — Identity Verification
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 14. verified by ⭐ REQUIRED

**Description:**
```
Identity or claim verified by an authority.
Usage: [Subject] — verified by — [Verifier]. Used for KYC-style
attestations and Layer-7 sybil defense in the evaluator weighting
algorithm. Filter by trusted verifier address.
```

**Icon prompt:**
```
[universal prefix] a shield with a checkmark inside, deep purple color
(#A78BFA), representing verified identity and protection, authoritative
and secure.
```

---

### 15. vouches for (optional)

**Description:**
```
Personal vouch — softer than certification.
Usage: [Person] — vouches for — [Agent/Person]. Useful for web-of-
trust style reputation; carries the voucher's own reputation
weight when aggregated.
```

**Icon prompt:**
```
[universal prefix] a hand placed over a chest/heart with a small badge,
soft purple color (#A78BFA), representing personal endorsement and
vouching, sincere gesture.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REPORTS — Moderation & Safety
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 16. reported for scam ⭐ REQUIRED

**Description:**
```
Flags an Agent for confirmed or suspected scam behaviour.
Usage: [Reporter] — reported for scam — [Agent]. Aggregated reports
feed into the negative attestation pillar of the Trust Score.
Consumers should weight by reporter reputation to avoid abuse.
```

**Icon prompt:**
```
[universal prefix] a warning triangle with a dollar sign and slash
through it, alert red color (#EF4444), representing fraudulent
financial behaviour, danger aesthetic.
```

---

### 17. reported for spam ⭐ REQUIRED

**Description:**
```
Flags an Agent for spam or low-quality output.
Usage: [Reporter] — reported for spam — [Agent]. Lighter penalty
than `reported for scam`; aggregated as quality signal.
```

**Icon prompt:**
```
[universal prefix] a no-mail symbol — envelope with a slash through it,
warm orange color (#F97316), representing unwanted or noisy content,
moderation context.
```

---

### 18. reported for injection ⭐ REQUIRED

**Description:**
```
Flags an Agent for prompt injection vulnerabilities or unsafe
behaviour. Usage: [Reporter] — reported for injection — [Agent].
Critical safety signal for AI agents; consumers should treat any
unweighted report as a strong negative.
```

**Icon prompt:**
```
[universal prefix] a syringe needle entering a chat bubble with a
warning glow, alert red color (#EF4444), representing prompt injection
and AI safety threats, technical/clinical feel.
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Registration Workflow
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Phase 1 — Generate icons

1. Use ChatGPT (DALL-E 3) / Midjourney / Stable Diffusion with the prompts above
2. Generate one icon per predicate (18 total)
3. Review for visual consistency — they should look like a coherent set
4. Optionally re-generate outliers

### Phase 2 — Upload to IPFS

For each icon:

1. Use **https://app.pinata.cloud** or **https://web3.storage** (free tier)
2. Pin the PNG file
3. Copy the CID — looks like `QmXxxx...` (Qm prefix = CIDv0) or `bafy...` (CIDv1)
4. Format as `ipfs://QmXxxx...` for the Image field

### Phase 3 — Register on portal

Open https://portal.intuition.systems → Create Identity, then for each predicate:

1. **Type:** Thing (Schema.org)
2. **Name:** copy exactly from this doc (lowercase, spaces)
3. **Description:** paste the multi-line description block
4. **Image:** paste `ipfs://<CID>` from Phase 2
5. **URL:** leave blank (defaults to `null`)
6. Click **Create** — sign transaction (~0.001 $TRUST + protocol fee)
7. Copy the resulting `term_id` — paste below in the **TermID Tracker**

### Phase 4 — Update AgentScore code

After registration:

1. Edit `src/lib/predicate-mainnet-ids.ts` (create if missing) with the term_ids
2. The display layer in `predicate-display.ts` already handles the lowercase form
3. Test triple creation: `Agent → has agent skill → Skill` with the new term_id

---

## TermID Tracker

**Legend:**
- ✅ DONE / REUSE — confirmed on mainnet, term_id known
- 🆕 CREATE — needs to be registered fresh (Phases 1–3)
- ⏳ TBD — not yet checked on portal

| # | Name | Status | term_id (mainnet) |
|---|------|--------|-------------------|
| 1 | `has agent skill` | ✅ DONE | check portal |
| 2 | `trusts` | ✅ REUSE | `0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9` |
| 3 | `opposes` | 🆕 CREATE | pending |
| 4 | `evaluated by` | 🆕 CREATE | pending |
| 5 | `reported for` | 🆕 CREATE | pending |

### How to find term_id on the portal

For ✅ REUSE atoms:

1. Open the atom on https://portal.intuition.systems
2. The URL contains the term_id, e.g.
   `portal.intuition.systems/atom/0xabc...123` → term_id is `0xabc...123`
3. Or scroll down to "Atom Details" — `term_id` field is shown explicitly
4. Copy and paste into this tracker

For 🆕 CREATE atoms, term_id appears in the success toast after the
`Create Identity` transaction confirms.

---

## Launch Scope — Minimum Viable Predicates

These are the only predicates needed before AgentScore mainnet goes live.
Everything else is post-launch on-demand.

| # | Name | Status | term_id / Notes |
|---|------|--------|-----------------|
| 1 | `has agent skill` | ✅ DONE | check portal for term_id |
| 2 | `trusts` | ✅ REUSE | `0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9` |
| 3 | `opposes` | 🆕 CREATE (lowercase) | Exists as `Opposes` (capital O) — wrong convention. Create canonical lowercase. |
| 4 | `evaluated by` | 🆕 CREATE | AgentScore-specific evaluator system driver |
| 5 | `reported for` | 🆕 CREATE | One predicate, objects: Scam / Spam / Injection atoms |

**Total new registrations needed: 3** (opposes, evaluated by, reported for)

> **Note:** "Wired up" means recorded in `src/lib/predicate-mainnet-ids.ts` —
> NOT necessarily registered fresh. `trusts` just needs its term_id copied from
> the portal; `has agent skill` is already registered.

---

## Discovery Notes

Results from Phase 0 portal search on mainnet.

### `trusts` — ✅ REUSE

- **term_id:** `0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9`
- **Label:** `trusts` (lowercase ✅)
- **Description:** "Reflects confidence or reliance on another entity's integrity or actions."
- **Verdict:** Generic, well-described, perfect fit. No new registration needed.

### `opposes` — ⚠️ CREATE NEW (lowercase canonical)

- **Found:** `Opposes` (capital O) — `0x5af444aa5692474d28e32b79160a93370030d4d57f77cdb6c613b05354e70612`
- **Problems:**
  1. Capital O breaks lowercase convention used by all Saulo predicates
  2. Description "Oppose means to disagree" lacks counter-vault context and publisher filter warning
- **Verdict:** Create canonical lowercase `opposes` + open PR to Intuition Ontology repo
  (same pattern as PR #7 for `resolved to`). Do NOT reuse the capital-O version.

---

## Corrections from Previous Version

| Previous assumption | What portal discovery found |
|---------------------|-----------------------------|
| `trusts` — likely ✅ (generic) | Confirmed ✅ REUSE — `0x3a73f3...` |
| `opposes` — assume REUSE | Found `Opposes` (wrong case) — create lowercase canonical |
| 3 separate report predicates (`reported for scam/spam/injection`) | Consolidate into one `reported for` predicate, use Scam/Spam/Injection as objects |
