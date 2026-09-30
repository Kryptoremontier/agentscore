/**
 * The "For developers" block's answer: one real MCP call — get_agent_trust for the landing's
 * example agent — trimmed to what a person can read at a glance. Field names are the answer's
 * own (never renamed or invented); only fields are dropped. MCP answers over SSE: the tool's text
 * is JSON in the first "data:" line.
 */

export const MCP_PATH = '/api/mcp/mcp'
export const AGENT_TRUST_TOOL = 'get_agent_trust'

/** The tool's JSON answer out of the MCP transport's body; null when it isn't one. */
export function parseToolAnswer(body: string): Record<string, unknown> | null {
  const line = body.split('\n').find((l) => l.startsWith('data: '))
  try {
    const rpc = JSON.parse(line ? line.slice(6) : body)
    const text = rpc?.result?.content?.[0]?.text
    if (typeof text !== 'string' || rpc?.result?.isError) return null
    const answer = JSON.parse(text)
    return answer && typeof answer === 'object' && answer.agent ? answer : null
  } catch {
    return null
  }
}

type Json = Record<string, unknown>
const pick = (o: unknown, keys: readonly string[]): Json => {
  const src = (o && typeof o === 'object' ? o : {}) as Json
  return Object.fromEntries(keys.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]))
}

/**
 * The trimmed answer: who (name), the tier and what it rests on, what the next rung needs, and the
 * data's age. Scored agents carry the rung under trustAnalysis.tier; ERC-8004 agents their
 * attested counts on the agent itself.
 */
export function trimAgentTrust(answer: Json): Json {
  const out: Json = {
    agent: pick(answer.agent, ['name', 'origin', 'tier', 'trustTier', 'tierBasis', 'attesters', 'tTrustAttested']),
  }
  const rung = (answer.trustAnalysis as Json | undefined)?.tier
  if (rung) out.trustAnalysis = { tier: pick(rung, ['current', 'nextTier', 'requirements']) }
  if (answer.meta) out.meta = pick(answer.meta, ['dataAgeSeconds', 'dataReadAt'])
  return out
}

/** The call, as a reader writes it: get_agent_trust({ agentId: "0x82d8…2c5a" }). */
export function callLine(agentId: string): string {
  const short = agentId.length > 12 ? `${agentId.slice(0, 6)}…${agentId.slice(-4)}` : agentId
  return `${AGENT_TRUST_TOOL}({ agentId: "${short}" })`
}

/** One MCP tools/call to our own endpoint. null = no answer (never an empty one). */
export async function askAgentTrust(agentId: string): Promise<Json | null> {
  try {
    const res = await fetch(MCP_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: AGENT_TRUST_TOOL, arguments: { agentId } } }),
    })
    if (!res.ok) return null
    return parseToolAnswer(await res.text())
  } catch {
    return null
  }
}
