/**
 * Writes the trust gate's examples into SKILL.md from src/lib/gate-example.ts (captured by
 * scripts/capture-gate-example.ts) — the main answer and one answer per id form (Etap 9), never
 * hand-typed. Run from the repo root, after a capture:
 *   node --experimental-strip-types scripts/write-skill-gate.ts
 * gate-example.test.ts checks SKILL.md carries exactly these.
 */
import { readFileSync, writeFileSync } from 'node:fs'
// A computed path: node strips the types at run time; the type-check doesn't follow it.
const modulePath = new URL('../src/lib/gate-example.ts', import.meta.url).href
const { EXAMPLE_GATE, GATE_ID_EXAMPLES } = (await import(modulePath)) as typeof import('../src/lib/gate-example')
const SITE = 'https://agentscore-gilt.vercel.app'
let s = readFileSync('SKILL.md', 'utf8')
// 1. the main example's JSON block
const a = s.indexOf('Real response (Captain Dackie):')
const b = s.indexOf('- `data.decision` is `allow`')
if (a < 0 || b < 0) throw new Error('anchors')
s = s.slice(0, a) + 'Real response (Captain Dackie):\n\n```json\n' + JSON.stringify(EXAMPLE_GATE.answer, null, 2) + '\n```\n\n' + s.slice(b)
// 2. the any-id section, after the gate's bullet list
const START = '### Any id'
const END = '## The full trust breakdown'
const section = [
  '### Any id',
  '',
  '`:id` (and `agentId` over MCP) is the agent\'s Intuition term id, its ERC-8004 id (`8453:1380` or the CAIP form), the wallet that registered it, or its exact name — percent-encode it in the path. `data.agentId` is the term id the decision is about. If more than one agent fits, the answer is `unknown` with `data.candidates` (ask again with one term id) — never a guess between them.',
  '',
  'One real response per id form (`data` only):',
  '',
  ...GATE_ID_EXAMPLES.flatMap((ex) => [
    `**${ex.form}**`,
    '',
    '```bash',
    `curl "${SITE}${ex.request}"`,
    '```',
    '',
    '```json',
    JSON.stringify(ex.data),
    '```',
    '',
  ]),
  `A ~20-line client to paste (fetch only, no dependencies; \`unknown\` and an unreachable AgentScore are both a no): [examples/trust-gate.ts](https://github.com/Kryptoremontier/agentscore/blob/main/examples/trust-gate.ts)`,
  '',
  '',
].join('\n')
const i = s.indexOf(START)
const j = s.indexOf(END)
if (j < 0) throw new Error('end anchor')
s = (i >= 0 ? s.slice(0, i) : s.slice(0, j)) + section + s.slice(j)
writeFileSync('SKILL.md', s)
console.log('SKILL.md updated')
