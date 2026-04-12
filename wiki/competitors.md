# Vital Agent Registry

> Official Intuition agent registry by Vitalsine85+Claude.

**Repo:** github.com/0xIntuition/vital-agent-registry | **Network:** Base L2

---

## What It Has
- 29 REST API routes
- 12 MCP tools
- ERC-8004 support
- A2A agent cards (generated on-the-fly from graph data)
- D3 graph visualization
- 7 data scrapers
- 744+ tests

## Our Differentiators vs Vital

| Feature | Vital | AgentScore |
|---------|-------|-----------|
| Anti-manipulation | None | 6 layers |
| Evaluator system | None | Accuracy-weighted (unique) |
| Contextual scoring | None | Per-skill, per-domain |
| Domain leaderboards | None | /domains page |
| Reputation half-life | None | 90-day decay |
| Trust Timeline | None | Explainable history |
| Launchpad | None | IntuForge |
| Prediction market | None | SENSE |

---

# Sofia MCP Trust Server

> EigenTrust computation on Intuition graph.

**Endpoint:** mcp-trust.intuition.box/mcp | **Data:** 16K+ addresses

## Tools
- compute_eigentrust — global PageRank-style trust
- compute_agentrank — agent-specific ranking
- compute_composite_score — multi-factor score
- compute_personalized_trust — trust between two wallets
- find_trust_paths — how trust flows (Billy → Zet → Luda)
- simulate_sybil_attack — test sybil resistance

## Integration Plan (Phase 2C)

Consume their graph traversal, add our quality layer:
- Query personalized_trust → overlay with evaluator weights
- Query trust_paths → visualize in Trust Path Explorer
- "Path through Sage evaluator is worth more than path through random staker"

Promoted by [[luda]] on forum.

---

# Billions "Know Your Agent" (KYA)

> DID-based agent identity with ZK proofs.

**Focus:** Enterprise (HSBC, Sony Bank, Deutsche Bank)

## What They Do
- Decentralized Identifiers (DID) for agents
- ZK proofs for ownership (human-anchored without doxxing)
- Public attestation registry
- Agent JS SDK for identity management

## Relationship to Us
**They do IDENTITY. We do REPUTATION.** Complementary, not competitive.
- Their card says "who am I" → our card says "how trusted am I"
- Future integration: "Agent has Billions DID → verified badge on AgentScore"
- Phase 3+ consideration, not now

---

# ERC-8004

> Trustless Agents standard — on-chain agent identity.

Agent identity + reputation registries on Ethereum/Base. AgentScore as reputation provider:
- Bridge Intuition trust scores to ERC-8004 Identity Registry
- Phase 4 roadmap item

Flagged by Wieedze in community. Vital Registry supports it.

---

# SkillGraph

> Intuition's upcoming feature — autonomous agent skill evaluation.

From official blog "From Prompts to Programmable Trust":
> "SkillGraph is set to launch later this month, introducing autonomous agent skill evaluation on top of the Intuition Knowledge Graph."

## What We Know
- Autonomous = agents evaluate agents (not just humans)
- On top of Knowledge Graph = uses existing atoms/triples
- "Later this month" (written late March 2026)
- No public repo yet

## Impact on Us
- If it's domain leaderboards at protocol level → our Domains become frontend
- If it's agent-to-agent evaluation → our Phase 3 Proof of Performance
- Monitor closely. May be complementary, may overlap.

## Related
- [[agentscore]] — our domains feature
- [[roadmap]] — Phase 3 Proof of Performance
