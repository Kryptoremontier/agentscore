/**
 * The trust gate takes any id (Etap 9) — REST `GET /api/v1/agents/:id/gate` and MCP
 * `should_i_trust` both answer through `trustGateFor`. The id is resolved with the resolver
 * /check uses (lib/check-agent.ts): an Intuition term id, an ERC-8004 id (`8453:1380` or the CAIP
 * form), the wallet that registered the agent, or an exact name.
 *
 * - A term id is read directly, exactly as before this etap (lib/api-data.ts getGateSubject).
 * - Anything else is resolved first. One agent → the same read, the same decision.
 * - More than one agent fits → `unknown`, naming the candidates (`candidates`). Never a guess
 *   between them: a payer must not be sent to the wrong "Luda".
 * - Nothing fits → today's `deny`, "Not found …". A failed lookup → `unknown`.
 *
 * No new scoring and no new decision: `decideTrustGate` still makes every allow / deny. The
 * answer only gains `agentId` (which agent the answer is about) and, when ambiguous, `candidates`.
 */

import { getGateSubject } from './api-data'
import { resolveGateId } from './check-data'
import { parseCheckQuery } from './check-agent'
import { currentFreshness } from './server-cache'
import {
  decideTrustGate, gateAmbiguousReason, GATE_LOOKUP_UNREAD, type GateAnswer, type GateCandidate, type GatePolicy,
} from './trust-gate'

async function answerFor(termId: string, policy: GatePolicy): Promise<GateAnswer> {
  const subject = await getGateSubject(termId)
  const { dataAgeSeconds, dataReadAt } = currentFreshness()
  return { ...decideTrustGate(subject, policy, { dataAgeSeconds, dataReadAt }), agentId: subject.status === 'found' ? termId : null }
}

export async function trustGateFor(rawId: string, policy: GatePolicy): Promise<GateAnswer> {
  const raw = rawId.trim()
  const q = parseCheckQuery(raw)
  if (q.kind === 'termId') return answerFor(q.termId, policy)
  // Not an id form the resolver knows a second reading for (empty never reaches here: the route refuses it).
  const resolution = q.kind === 'empty' ? { status: 'not-found' as const } : await resolveGateId(raw)
  if (resolution.status === 'found') return answerFor(resolution.id, policy)

  const { dataAgeSeconds, dataReadAt } = currentFreshness()
  const meta = { dataAgeSeconds, dataReadAt }
  if (resolution.status === 'choose') {
    const candidates: GateCandidate[] = resolution.candidates.map((c) => ({ id: c.id, name: c.name, origin: c.origin, peopleVouching: c.people }))
    return {
      decision: 'unknown', reason: gateAmbiguousReason(raw, candidates, resolution.more),
      tier: null, peopleVouching: null, areas: null, policy, meta, agentId: null, candidates,
    }
  }
  if (resolution.status === 'unread') {
    return { decision: 'unknown', reason: GATE_LOOKUP_UNREAD, tier: null, peopleVouching: null, areas: null, policy, meta, agentId: null }
  }
  // Nothing fits: today's answer for an id that is no agent.
  return { ...decideTrustGate({ status: 'not-found' }, policy, meta), agentId: null }
}
