/**
 * Demo: OPEN CLAW chooses who to pay (Etap 7). `npm run demo:gate`
 *
 * OPEN CLAW has a task and two real candidates from the live testnet corpus. Before paying either
 * it asks AgentScore's MCP tool `should_i_trust` under its own policy, prints both answers with
 * their reasons and data age, then shows the payment step. No payment is ever made.
 *
 * Why `minPeople: 1` and not the default `{ minTier: "trusted" }`: Trusted needs at least two
 * independent people vouching, and today no agent on testnet has that — the honest current state,
 * not a bug. Under the default both candidates are denied (`npm run demo:gate -- --default`).
 *
 * AGENTSCORE_URL (default the production deployment) picks the AgentScore server.
 * Self-contained (fetch only) so plain `node` runs it.
 */

const BASE = (process.env.AGENTSCORE_URL ?? 'https://agentscore-gilt.vercel.app').replace(/\/$/, '')
const INDEXER = process.env.NEXT_PUBLIC_INTUITION_GRAPHQL_URL ?? 'https://testnet.intuition.sh/v1/graphql'
const TASK = 'Summarise the latest Intuition testnet activity'
const AREA = 'Crypto / Onchain'
const POLICY = process.argv.includes('--default') ? {} : { minPeople: 1, area: AREA }

// Real agents, read from the live corpus on 2026-10-18: one with a person vouching in the area, one with none.
const CANDIDATES = [
  { name: 'Captain Dackie', id: '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb' },
  { name: 'AgentNews', id: '0x330d423bea2a5eda264ea2a4eef3a5bdefba690de0023ac390936e7c3f17426c' },
]

type Gate = {
  decision: 'allow' | 'deny' | 'unknown'
  reason: string
  areas: { area: string; people: number; tTrust: string }[] | null
  meta: { dataAgeSeconds: number; dataReadAt: string }
}

/** One MCP tools/call over HTTP — what any agent framework sends. */
async function shouldITrust(agentId: string): Promise<Gate> {
  try {
    const res = await fetch(`${BASE}/api/mcp/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'should_i_trust', arguments: { agentId, ...POLICY } } }),
    })
    const raw = await res.text()
    const line = raw.split('\n').find((l) => l.startsWith('data:'))
    const rpc = JSON.parse(line ? line.slice(5) : raw)
    const text = rpc?.result?.content?.[0]?.text
    if (!res.ok || rpc?.result?.isError || typeof text !== 'string') throw new Error(text ?? rpc?.error?.message ?? `HTTP ${res.status}`)
    return JSON.parse(text)
  } catch (err) {
    // Fail closed, like the gate itself: no answer is not a yes.
    const why = err instanceof Error ? err.message : String(err)
    return { decision: 'unknown', reason: `No answer from AgentScore (${why}) — not a yes.`, areas: null, meta: { dataAgeSeconds: 0, dataReadAt: '' } }
  }
}

/** What Intuition holds about paying this agent: a declared x402 link and its listed URL. Never invented. */
async function paymentFacts(agentId: string): Promise<{ x402Links: string[]; url: string | null } | null> {
  try {
    const res = await fetch(INDEXER, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query Pay($id: String!) { atoms(where: { term_id: { _eq: $id } }) { value { thing { url } }
          as_subject_triples(where: { object: { label: { _ilike: "x402" } } }) { predicate { label } } } }`,
        variables: { id: agentId },
      }),
    })
    const atom = (await res.json())?.data?.atoms?.[0]
    if (!atom) return null
    const links: string[] = atom.as_subject_triples.map((t: { predicate: { label: string } }) => `${t.predicate.label} → x402`)
    return { x402Links: [...new Set(links)], url: atom.value?.thing?.url ?? null }
  } catch {
    return null
  }
}

const age = (s: number) => (s < 60 ? `${s} s old` : s < 3600 ? `${Math.floor(s / 60)} min old` : `${Math.floor(s / 3600)} h old`)
const say = (line = '') => console.log(line)

async function main() {
  say('AgentScore trust gate — demo')
  say(`OPEN CLAW has a task: "${TASK}"`)
  say(`Two agents offer to do it. Before paying, OPEN CLAW asks AgentScore: should I trust this agent?`)
  say(`Policy (OPEN CLAW's own): ${JSON.stringify(POLICY)}`)
  say(`Asking ${BASE}/api/mcp/mcp → should_i_trust`)
  say()

  const answers = []
  for (const c of CANDIDATES) {
    const gate = await shouldITrust(c.id)
    answers.push({ ...c, gate })
    say(`${c.name}`)
    say(`  decision  ${gate.decision.toUpperCase()}`)
    say(`  reason    ${gate.reason}`)
    if (gate.areas?.length) say(`  vouched   ${gate.areas.map((a) => `${a.area}: ${a.people} ${a.people === 1 ? 'person' : 'people'}, ${a.tTrust} tTRUST`).join(' · ')}`)
    if (gate.meta.dataReadAt) say(`  data      ${age(gate.meta.dataAgeSeconds)} (read ${gate.meta.dataReadAt})`)
    say()
  }

  say('Payment step — simulated: nothing is paid and no request is sent.')
  for (const { name, id, gate } of answers) {
    if (gate.decision !== 'allow') {
      say(`  ${name}: Refused: ${gate.reason}`)
      continue
    }
    const pay = await paymentFacts(id)
    say(`  ${name}: allowed.`)
    if (!pay) {
      say(`    Couldn't read how to pay it from Intuition right now, so there is nothing to send.`)
      continue
    }
    if (pay.x402Links.length) say(`    It says it takes x402 payments (on Intuition: ${pay.x402Links.map((l) => `"${l}"`).join(', ')}).`)
    say(`    But Intuition holds no x402 endpoint for it${pay.url ? ` — its only listed link is ${pay.url}` : ''}.`)
    say(`    The request OPEN CLAW would send, once ${name} publishes one:`)
    say(`      POST <${name}'s x402 endpoint — not published, so none is invented>`)
    say(`      Content-Type: application/json`)
    say(`      ${JSON.stringify({ task: TASK })}`)
    say(`    x402: the agent answers 402 Payment Required with its price; OPEN CLAW pays and resends with an X-PAYMENT header.`)
  }
}

// Exported so a test can await the run (src/lib/__tests__/demo-trust-gate.test.ts).
export const run = main()
