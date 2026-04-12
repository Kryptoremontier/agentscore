# SENSE

> Prediction market as knowledge graph on Intuition Protocol

**Status:** Week 2 ✅ | **Repo:** github.com/Kryptoremontier/SENSE | **Live:** sense-nine-jet.vercel.app

---

## What It Is

Community-driven prediction market where predictions are atoms on Intuition knowledge graph. Experts earn reputation through accurate predictions — same concept as AgentScore evaluator system.

## Progress

| Week | Status | What was built |
|------|--------|---------------|
| 1 | ✅ | Blockchain infra (wagmi, providers, wallet, Intuition testnet) |
| 2 | ✅ | Staking via FeeProxy, createPredictionAtom, GraphQL hooks, prediction detail page, AddClaimWizard |
| 3 | 🔧 | Knowledge Map connected to GraphQL (next) |

## Expert Scoring

Same concept as AgentScore evaluator:
```
Expert who predicted correctly 10 times → 1.5x weight
Expert who predicted incorrectly 10 times → 0.5x weight
Track record = influence on future predictions
```

## Connection to AgentScore + IntuForge

AgentScore = "who is trusted NOW"
SENSE = "what will happen NEXT"

Together: "ChatGPT is #1 in code generation NOW (AgentScore). 65% of experts predict Claude takes over by Q3 (SENSE)."

IntuForge connection: "Will this project ship by Q3?" → SENSE prediction on IntuForge project.

## Technical

- Separate SenseFeeProxy planned (not shared with AgentScore)
- Reusable patterns documented in AgentScore_Reusable_Logic_Playbook.md
- Intuition agent-skills installed

## Related

- [[agentscore]] — evaluator concept source
- [[intuforge]] — future SENSE integration
- [[roadmap]] — SENSE phases
