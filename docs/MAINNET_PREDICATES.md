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
Negative attestation against an entity. Signals disagreement or opposition
toward a subject. Counter-signal to `trusts` — stake on this triple reduces
the subject's aggregate trust score in stake-weighted scoring systems.
Anyone can write this triple; consumers should filter by trusted publisher.
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
Records that an entity was reviewed or assessed by an evaluator.
Usage: [Subject] — evaluated by — [Evaluator]. Links a subject to the
party responsible for its quality or reliability assessment. Consumers
may weight evaluations by evaluator reputation.
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

### 16. reported for ⭐ REQUIRED

> **Mainnet consolidation:** replaces the 3 testnet predicates
> (`reported_for_scam`, `reported_for_spam`, `reported_for_injection`).
> One generic predicate + dedicated Object atoms per category — Saulo's
> recommendation. New categories can be added later (e.g. `Impersonation`,
> `Plagiarism`) without registering new predicates.

**Description (generic — registered as-is on portal):**
```
Flags an entity for a specific category of concern or misconduct.
Usage: [Reporter] — reported for — [Object], where Object is an atom
describing the issue type (e.g. Scam, Spam, Injection). Anyone can write
this triple; consumers should weight reports by reporter reputation
to prevent abuse.
```

**Icon prompt:**
```
[universal prefix] a warning triangle with an exclamation mark inside,
flat amber-to-red gradient (#F59E0B → #EF4444), representing a generic
caution or report flag, professional moderation icon, balanced symmetry.
```

**Required Object atoms (register separately, type: Thing):**

| Object | Description (generic) | Icon prompt |
|--------|----------------------|-------------|
| `Scam` | Fraudulent behaviour or attempt to deceive others for financial or personal gain. | `[universal prefix] a dollar sign with a slash through it inside a warning triangle, alert red (#EF4444), representing fraudulent intent.` |
| `Spam` | Repetitive, low-quality, or unsolicited content that adds no value. | `[universal prefix] an envelope with a slash through it, warm orange (#F97316), representing unwanted noise or junk content.` |
| `Injection` | Prompt injection, jailbreak attempt, or other adversarial input designed to manipulate AI behaviour. | `[universal prefix] a syringe needle entering a chat bubble with a faint warning glow, alert red (#EF4444), representing prompt injection and AI safety threats.` |

> **Note:** Register the predicate first, then the 3 Object atoms.
> Each Object becomes the rightmost term in triples like
> `Agent — reported for — Scam`.

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
| 3 | `opposes` | ✅ DONE | `0x3ce0f03b579b0b3d2dcbfbbfb7adb0dd00ab2cf3393ab7201518fabae6dc05f7` |
| 4 | `evaluated by` | ✅ DONE | `0xb769bc51460e2dc29927c825f743238174c02901603a0c9604dd2e8ea40f8226` |
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
| 3 | `opposes` | ✅ DONE | `0x3ce0f03b579b0b3d2dcbfbbfb7adb0dd00ab2cf3393ab7201518fabae6dc05f7` |
| 4 | `evaluated by` | ✅ DONE | `0xb769bc51460e2dc29927c825f743238174c02901603a0c9604dd2e8ea40f8226` |
| 5 | `reported for` | 🆕 CREATE | One predicate, objects: Scam / Spam / Injection atoms |

**Total new registrations needed: 1** (reported for)

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

### `opposes` — ✅ DONE

- **Registered:** `0x3ce0f03b579b0b3d2dcbfbbfb7adb0dd00ab2cf3393ab7201518fabae6dc05f7`
- **Old version:** `Opposes` (capital O) — `0x5af444aa5692474d28e32b79160a93370030d4d57f77cdb6c613b05354e70612`
- **Why fresh registration:**
  1. Capital O broke lowercase convention used by all Saulo predicates
  2. Old description "Oppose means to disagree" lacked counter-vault context and publisher filter warning
- **Next:** Open PR to Intuition Ontology repo to make this the recommended lowercase canonical
  (same pattern as PR #7 for `resolved to`).

**Registration description (generic — no app-specific references):**
```
Negative attestation against an entity. Signals disagreement or opposition
toward a subject. Counter-signal to `trusts` — stake on this triple reduces
the subject's aggregate trust score in stake-weighted scoring systems.
Anyone can write this triple; consumers should filter by trusted publisher.
```

### `evaluated by` — ✅ DONE

- **Registered:** `0xb769bc51460e2dc29927c825f743238174c02901603a0c9604dd2e8ea40f8226`
- **Old version:** `was evaluated by` (id: `0xadcd017236b0574ea39c507cc6802820fea5a5251cc03d66d53260c3c7d7bd81`) — Saulo confirmed "was" is unnecessary and noisy, zero stakes.
- **Status:** Saulo explicitly recommended creating this clean version. Will be the canonical going forward.

**Registration description (generic — no app-specific references):**
```
Records that an entity was reviewed or assessed by an evaluator.
Usage: [Subject] — evaluated by — [Evaluator]. Links a subject to the
party responsible for its quality or reliability assessment. Consumers
may weight evaluations by evaluator reputation.
```

### `reported for` — 🆕 CREATE

- **Found:** No alternative on portal.
- **Verdict:** Create fresh. Saulo: *"if anyone wants to create similar ones they would use yours since you were first."*

**Registration description (generic — no app-specific references):**
```
Flags an entity for a specific category of concern or misconduct.
Usage: [Reporter] — reported for — [Object], where Object is an atom
describing the issue type (e.g. Scam, Spam, Injection). Anyone can write
this triple; consumers should weight reports by reporter reputation
to prevent abuse.
```

---

## Corrections from Previous Version

| Previous assumption | What portal discovery found |
|---------------------|-----------------------------|
| `trusts` — likely ✅ (generic) | Confirmed ✅ REUSE — `0x3a73f3...` |
| `opposes` — assume REUSE | Found `Opposes` (wrong case) — create lowercase canonical |
| 3 separate report predicates (`reported for scam/spam/injection`) | Consolidate into one `reported for` predicate, use Scam/Spam/Injection as objects |
