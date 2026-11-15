/**
 * 03 / Agents ask first (Etap 8b): why, in two lines, and a real should_i_trust call with the answer
 * the gate gave — rendered on the server when the page was built or regenerated (lib/landing-data.ts,
 * the REST and MCP gate's own function), never hand-typed. The JSON is the answer as returned, its
 * meta.dataAgeSeconds included; the caption counts the age again in the browser.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { STORY_SECTIONS, GATE_HEADING, GATE_WHY, GATE_DEVELOPERS, GATE_UNREAD, GATE_CAPTION, GATE_NONE } from '@/lib/people-copy'
import type { LandingData } from '@/lib/landing-data'
import type { GatePolicy } from '@/lib/trust-gate'
import { DataAge } from '@/components/shared/DataAge'
import { StorySection } from './story-parts'

/** The call as a reader writes it: should_i_trust({ agentId: "0x82d8…2c5a", minPeople: 1, area: "…" }). */
export function gateCallLine(agentId: string, policy: GatePolicy): string {
  const short = agentId.length > 12 ? `${agentId.slice(0, 6)}…${agentId.slice(-4)}` : agentId
  const args = Object.entries(policy).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  return `should_i_trust({ agentId: "${short}", ${args} })`
}

export function GateExample({ gate }: { gate: LandingData['gate'] }) {
  return (
    <StorySection id="agents-ask-first" section={STORY_SECTIONS.gate} heading={GATE_HEADING} className="bg-[#0D0F11]/80">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 items-start">
        <div>
          {GATE_WHY.map((line) => (
            <p key={line} className="text-lg sm:text-xl text-[#B5BDC6] leading-relaxed">{line}</p>
          ))}
          <Link href="/docs#api" className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-[#ffc35a]">
            {GATE_DEVELOPERS}
            <ArrowRight aria-hidden className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        <div className="min-w-0" data-testid="gate-example" data-state={gate.status}>
          {gate.status === 'ok' ? (
            <>
              <pre className="rounded-2xl border border-white/10 bg-[#0B0D10]/90 p-4 sm:p-5 font-mono text-[11px] sm:text-xs leading-relaxed text-[#B5BDC6] whitespace-pre-wrap break-words">
                <span className="text-accent">{gateCallLine(gate.value.agentId, gate.value.policy)}</span>
                {'\n'}
                <span className="text-[#7A838D]">{'// →'}</span>
                {'\n'}
                {JSON.stringify(gate.value.answer, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-[#7A838D]">
                {GATE_CAPTION} <DataAge readAt={gate.value.answer.meta.dataReadAt} />
              </p>
            </>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-[#0B0D10]/90 p-5 text-sm text-[#B5BDC6]">{gate.status === 'none' ? GATE_NONE : GATE_UNREAD}</p>
          )}
        </div>
      </div>
    </StorySection>
  )
}
