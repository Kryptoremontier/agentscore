// AgentScore trust gate: ask before you pay or delegate to another agent. No dependencies.
// Your policy decides; "unknown" (or AgentScore unreachable) is a no.
type Policy = { minTier: 'trusted' | 'verified' } | { minPeople: number; area?: string }
type Gate = { decision: 'allow' | 'deny' | 'unknown'; reason: string; peopleVouching: number | null; meta?: { dataAgeSeconds: number } }

export async function trustGate(agentId: string, policy: Policy = { minTier: 'trusted' },
  base = 'https://agentscore-gilt.vercel.app'): Promise<Gate> {
  const query = new URLSearchParams(Object.entries(policy).map(([k, v]) => [k, String(v)]))
  try {
    const res = await fetch(`${base}/api/v1/agents/${encodeURIComponent(agentId)}/gate?${query}`)
    const body = await res.json()
    if (res.ok && body?.data?.decision) return body.data
    return { decision: 'unknown', reason: body?.error ?? `AgentScore answered HTTP ${res.status}`, peopleVouching: null }
  } catch (err) {
    return { decision: 'unknown', reason: `AgentScore unreachable: ${err instanceof Error ? err.message : err}`, peopleVouching: null }
  }
}

// const ok = await trustGate(agentId, { minPeople: 1, area: 'Crypto / Onchain' })
// if (ok.decision !== 'allow') return refuse(ok.reason)
