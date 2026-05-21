# AgentScore — AI Coding Discipline

> Self-audit checklist for AI coding agents (Claude/Cursor) working on AgentScore.
> Distilled from [Andrej Karpathy's LLM coding principles](https://github.com/forrestchang/andrej-karpathy-skills)
> with concrete behavior changes for this codebase.
>
> **Source skill:** `.claude/skills/coding-discipline/SKILL.md` (auto-loaded)
> **Original reference:** `.claude/skills/coding-discipline/REFERENCE.md` (verbatim)

---

## The 4 Principles (TL;DR)

1. **Think Before Coding** — Don't assume. Don't hide confusion. Surface tradeoffs.
2. **Simplicity First** — Minimum code that solves the problem. Nothing speculative.
3. **Surgical Changes** — Touch only what you must. Clean up only your own mess.
4. **Goal-Driven Execution** — Define success criteria. Loop until verified.

---

## Concrete Behavior Changes

### 1. Think Before Coding

**STOP doing:**
- Generating multiple speculative variants before knowing the actual error
  (e.g. 4 icon variants without first asking *"what's the error message?"*)
- Assuming "user probably wants X" when 2+ interpretations exist
- Silent implementation of one option without showing the tradeoff

**START doing:**
- Before any non-trivial change → state assumption explicitly:
  *"Assumption: X. If different, stop me."*
- 2+ approaches → use `AskQuestion` with concrete options, not monologue
- Unclear request → STOP, name what's confusing, ask

**Reference:** Caught a re-do in this session by checking if files already
existed instead of silently regenerating.

---

### 2. Simplicity First

**STOP doing:**
- Files >300 lines for logic (per workspace user-rules)
- Configurability "for the future" not requested
- Classes/abstractions when a function suffices
- Defensive `try/catch` around code that can't fail

**START doing:**
- Before writing 200+ lines → ask *"can this be 50?"* — if yes, refactor first
- Default: one function, not class. One file, not five.
- Trust the language — no `try/catch` on `Math.round()`

**Reference:** Icon-fix script was 30 lines of PowerShell, not a Node CLI tool.
`predicate-display.ts` is 50 lines (map + 1 function), not a formatter hierarchy.

---

### 3. Surgical Changes

**STOP doing:**
- "While I'm here, let me also refactor X"
- Reformatting imports / renaming variables during a bug-fix
- Removing pre-existing dead code without asking
- Changing existing patterns to "better" ones without consultation
  (already in workspace user-rules: *"Do not change drastically the patterns
  before trying to iterate on existing patterns"*)

**START doing:**
- The trace test: for each line in diff — *"does this directly serve the
  user's request?"* — if no, revert
- See dead code during a fix → mention it ("note: lines 45-50 appear unused,
  remove?"), don't delete
- Match existing style even when you'd do it differently

**Reference:** Update to `skills/README.md` for new skill = 3 surgical edits
(tree, selection guide, status table). Did NOT touch root `CLAUDE.md` even
though merging Karpathy's principles there would have been tempting.

---

### 4. Goal-Driven Execution

**STOP doing:**
- Tasks like "improve scoring" — without explicit success criteria
- Jumping to implementation when "done" is undefined
- Relying on "user will tell me when it works"

**START doing:**
- Convert every task to verifiable: *"X" → "test that reproduces X /
  `npm test` passes / measurement Y < Z"*
- Multi-step → state plan via `TodoWrite` with verification per step
- Canonical "done" check for AgentScore: `npm test && npm run type-check`

**Reference (anti-pattern that occurred):** Generated 4 icon variants without
defining success criteria. Should have been *"verify by getting specific error
message, then ONE targeted fix"*. Buckshot approach instead of surgical.

---

## Veto Trigger

Use the phrase **"Karpathy check"** to halt the agent when these red flags appear:

| Red flag | Principle violated |
|----------|--------------------|
| Starting to write code without stating an assumption | #1 |
| Diff has >50 lines for a "small change" | #2 or #3 |
| Touching files the user didn't mention | #3 |
| Saying "should work" instead of "here's the test that verifies" | #4 |
| Skipping `AskQuestion` when 2+ paths exist | #1 |

---

## Verification — How to Know It's Working

After 5 tasks with `coding-discipline` loaded:

| Metric | Target |
|--------|--------|
| Average diff length per "atomic task" | drops ~30% |
| "While I'm here" changes in commit messages | 0 |
| Clarifying questions before code vs. after error | shift from 0/3 → 3/0 |
| Response starts with "Assumption: X" when task is ambiguous | yes |
| User comments "exactly what I asked for" at review | more often |

---

## Self-Audit Questions (run BEFORE submitting changes)

1. **Think:** Did I state my assumptions or pick silently?
2. **Simple:** Would a senior engineer call this overcomplicated?
3. **Surgical:** Does every changed line trace to the user's request?
4. **Verify:** Can I demonstrate "done" without asking the user?

If any answer is uncomfortable — pause and address before shipping.

---

## How This Connects to Other AgentScore Docs

```
CLAUDE.md (root)                    ← AgentScore architectural rules
   │                                   (scoring formulas, gas budgets, etc.)
   ▼
.claude/skills/                     ← Domain-specific expertise
   ├── coding-discipline/SKILL.md   ← THIS — meta-rules for HOW to behave
   ├── agentscore-scoring/SKILL.md
   ├── agentscore-onchain/SKILL.md
   └── ...
   ▼
docs/                               ← Human-facing documentation
   ├── CODING_DISCIPLINE.md         ← THIS file (mirror for human review)
   ├── PREDICATE_INTEGRATION_GUIDE.md   # external builders — term_ids + GraphQL
   └── PREDICATE_REGISTRATION_WORKFLOW.md  # internal — portal registration
```

The skill auto-loads for AI agents; this `docs/` file makes the same content
visible during human code review and onboarding.
