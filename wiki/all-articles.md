# Programmable Trust (Official Intuition Blog)

> "From Prompts to Programmable Trust" — THE narrative we align with.

---

## Key Quotes & Our Mapping

| Blog says | We have |
|-----------|---------|
| "Trust gap — agents need to evaluate trust" | AgentScore scoring engine |
| "Hardcoded allowlists = brittle" | Open registry with bonding curves |
| "Reputation APIs = centralized SPOF" | Decentralized, on-chain, permissionless |
| "How much TRUST staked, who staked, what's their reputation" | evaluatorWeight based on track record |
| "Agents that verify before they transact" | Trust API + MCP for programmatic queries |
| "SkillGraph launching later this month" | Monitor — potential overlap with Domains |

## Strategic Use

Use "programmable trust" as framing in all communications. We are building exactly what this blog describes.

---

# Open Sourcerers (Billy Manifesto)

> "The future belongs to people who don't need permission."

---

## Key Points
- Open source builders > enterprise compliance departments
- Regulations = "tax on capability"
- "OpenClaws in YOLO mode" — references OpenClaw movement
- Billy betting on builders with freedom

## Relevance
We ARE the "sourcerer" he describes — solo builder, open source, shipping without permission. AgentScore + IntuForge + SENSE built by one person with LLM tools.

---

# Karpathy LLM Wiki (Viral — 11.7M views)

> LLM-maintained persistent knowledge bases.

**Posted:** April 2, 2026 | **Views:** 11.7M | **Gist:** gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

---

## Core Concept
- Raw sources → LLM compiles → persistent wiki (markdown)
- Wiki compounds with every input (not re-derived per query)
- Obsidian as "IDE", LLM as "programmer", wiki as "codebase"
- Three layers: raw sources, wiki, schema

## Our Angle

**"Karpathy builds a wiki for himself. Intuition builds a wiki for the internet."**

Same insight: persistent, compounding knowledge > ephemeral queries.
Difference: economic skin in the game. Every claim stakeable. Every curator builds track record.

## Quote Tweet Draft (ready)
"Karpathy builds a wiki for himself. @0xIntuition builds a wiki for the internet. Same insight: persistent, compounding knowledge > ephemeral queries. The difference? Economic skin in the game..."

Nano Banana graphic prompt ready (NanoBanana_Prompt_Karpathy_Tweet.md).

---

# Luda Forum Posts (3 articles)

## "Trust Isn't a Score, It's a Graph"
- Trust propagates through network (EigenTrust)
- Not all trust paths are equal (strong vs weak connections)
- Our reply: accuracy-weighted staking as quality layer on trust paths

## "Reputation Should Have a Half-Life"
- Old signals should lose influence
- We have: 90-day half-life in composite trust, freshness ×1.5 for <7 days

## "Reputation Should Be Queryable"
- Contextual queries, not global scores
- Domain leaderboards, predicate filtering, agent lenses
- We have: Agent Domains, Trust API lens endpoint, MCP trust_query tool
- "Trust lens" = our domain filter + evaluator weight filter

## "Why a Single Trust Score Doesn't Work"
- Validates our contextual trust scoring approach
- Per-skill, per-domain scores needed

## Cold Start Question
"How do you stop early bad actors from shaping initial weights?"
Our answer: confidence anchoring (50 neutral), 1.0x default weight, soft gate, min stake threshold.
