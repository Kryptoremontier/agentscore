'use client'

/**
 * The /agents status line (Etap 6): "272 agents, live" — or "…, updated 3 min ago" when what is
 * shown is our last complete read (lib/agents-page-types.ts feedFreshnessLabel). The corpus
 * breakdown and the hidden-fixtures count moved into the line's popover (a button — the line
 * itself): still there, never silently dropped (lib/agent-list.ts agentListHeaderSegments, the
 * same corpus counts the origin tabs read). Loading → "— agents"; a list that couldn't be read
 * says which.
 */

import {
  agentListHeaderSegments, corpusTotals, LIVE_FEED_LABEL,
  type AgentScoreCorpusCounts, type CohortCorpusCounts,
} from '@/lib/agent-list'
import {
  AGENTS_LIVE, AGENTS_STATUS_LOADING, AGENTS_STATUS_DETAILS, agentsStatus, agentsStatusMissing, hiddenNote,
} from '@/lib/people-copy'
import { InfoPopover } from '@/components/shared/Explainer'

export interface AgentsStatusInput {
  agentScore: AgentScoreCorpusCounts
  cohort: CohortCorpusCounts
  /** feedFreshnessLabel(parts, AGENTS_LIVE): AGENTS_LIVE when fresh, "Updated N min ago" when not; null = nothing read. */
  freshness: string | null
}

/** The line's text. */
export function agentsStatusText(i: AgentsStatusInput): string {
  const t = corpusTotals(i)
  const a = i.agentScore.status
  const c = i.cohort.status
  if (a === 'error' && c !== 'error') return agentsStatusMissing(t.erc8004, 'AgentScore')
  if (c === 'error' && a !== 'error') return agentsStatusMissing(t.agentscore, 'ERC-8004')
  if (t.all == null) return AGENTS_STATUS_LOADING
  return agentsStatus(t.all, i.freshness ?? AGENTS_LIVE)
}

/** The popover's lines: the corpus breakdown (no "live feed" jargon), then what is hidden. */
export function agentsStatusDetails(i: AgentsStatusInput): string[] {
  const segs = agentListHeaderSegments({ agentScore: i.agentScore, cohort: i.cohort, freshness: i.freshness })
    .filter((s) => s !== LIVE_FEED_LABEL && s !== AGENTS_LIVE)
  const junk = i.agentScore.status === 'ok' ? i.agentScore.junk : 0
  return [segs.join(' · '), ...(junk > 0 ? [hiddenNote(junk)] : [])]
}

export function AgentsStatusLine(i: AgentsStatusInput) {
  const t = corpusTotals(i)
  const fresh = i.freshness == null ? undefined : i.freshness === AGENTS_LIVE ? 'live' : 'stale'
  return (
    <div
      className="flex items-center gap-2 mt-4"
      data-testid="agents-status"
      data-total={t.all ?? undefined}
      data-agentscore={t.agentscore ?? undefined}
      data-erc8004={t.erc8004 ?? undefined}
      data-hidden={i.agentScore.status === 'ok' ? i.agentScore.junk : undefined}
      data-fresh={fresh}
    >
      <div className="w-2 h-2 rounded-full bg-[#C8963C] animate-pulse" />
      <InfoPopover
        label={AGENTS_STATUS_DETAILS}
        nameFromContent
        button={agentsStatusText(i)}
        testId="agents-status-button"
        buttonClassName="text-xs text-[#7A838D] underline decoration-dotted decoration-[#7A838D]/60 underline-offset-4 hover:text-[#B5BDC6] cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 rounded"
      >
        {agentsStatusDetails(i).map((line) => <p key={line} className="[&+p]:mt-1.5">{line}</p>)}
      </InfoPopover>
    </div>
  )
}
