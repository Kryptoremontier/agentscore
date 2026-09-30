'use client'

/**
 * /agents/[id] — the route surface of the agent profile (the /agents modal
 * is the other; both mount the same ETAP 3 profile components).
 *
 * Three tiers, resolved with ONE indexer round-trip first (resolveProfileAtom):
 *   scored      atom is in the AgentScore corpus → scored API → full layout
 *   non-scored  atom exists on-chain (ERC-8004 cohort, an attested human
 *               like Luda, …) → honest minimal profile, no fabricated score
 *   not found   atom does not exist
 * The scored API is only called when the pre-check says it will 200 — the
 * 404-then-fallback console noise from 2c is gone (Task 4).
 */

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Share, Flag } from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { AgentHeader } from '@/components/agents/AgentHeader'
import { AgentTabs } from '@/components/agents/AgentTabs'
import { BackThisAgentSection } from '@/components/profile/BackThisAgentSection'
import { ProfileStatRow } from '@/components/profile/ProfileStatRow'
import { AgentDetails } from '@/components/profile/AgentDetails'
import { ScoreParts, type ScorePartsView } from '@/components/profile/ScoreParts'
import { BackingScore } from '@/components/agents/BackingScore'
import { NO_STAKE_TOOLTIP } from '@/lib/score-basis'
import { ERC8004_ABOUT, NOT_SCORED_TIP } from '@/lib/people-copy'
import { fetchAgentModalData } from '@/lib/agents-page-client'
import { MODAL_HEADER_PARTS, type AgentModalPayload } from '@/lib/agents-page-types'
import { AttestStickyBar } from '@/components/attest/AttestStickyBar'
import { AttestedDomains } from '@/components/profile/AttestedDomains'
import { DeclaredDomains } from '@/components/profile/DeclaredDomains'
import { ReportsSection } from '@/components/profile/ReportsSection'
import { AttestersAndBackers } from '@/components/profile/AttestersAndBackers'
import { Button } from '@/components/ui/button'
import { PageHeaderSkeleton, LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { apiToAgent } from '@/lib/profile-agent'
import {
  resolveProfileAtom,
  fetchAgentProfileVector,
  fetchAgentBackers,
  summarizeAttesters,
  statRowView,
  backersFromPositions,
  type AgentProfileVector,
  type Backer,
  type ProfileAtom,
} from '@/lib/agent-profile'
import type { CohortAgent } from '@/lib/cohort-reader'
import { calculateAgentTier } from '@/lib/agent-tier'
import { AgentTierChip } from '@/components/agents/AgentTierChip'
import type { Agent } from '@/types/agent'
import type { AgentDetailApiItem } from '@/lib/api-data'

const EMPTY_VECTOR: AgentProfileVector = { attested: [], reports: [] }

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params['id'] as string
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [legacySkillClaimCount, setLegacySkillClaimCount] = useState(0)
  const [minimalAtom, setMinimalAtom] = useState<ProfileAtom | null>(null)
  const [cohortMatch, setCohortMatch] = useState<CohortAgent | null>(null)
  // The ERC-8004 identity read failed: unknown — never shown as "not a cohort agent".
  const [cohortFailed, setCohortFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // ETAP 3 canonical profile vector — shared by every tier.
  const [vector, setVector] = useState<AgentProfileVector>(EMPTY_VECTOR)
  const [backers, setBackers] = useState<Backer[] | null>([])
  const [profileLoading, setProfileLoading] = useState(true)
  // The modal's own answer for this agent (vault positions, signals, reports — cached, our API):
  // the header's stat row reads exactly what the /agents modal reads (Etap 5a). null = not answered
  // yet, or unreachable / not a listed agent — its parts then render "—".
  const [modalData, setModalData] = useState<Partial<AgentModalPayload> | null>(null)
  useEffect(() => {
    let cancelled = false
    setModalData(null)
    // The header's parts only: they never wait on the modal's slow ones (skill triples).
    fetchAgentModalData(agentId, MODAL_HEADER_PARTS).then((d) => { if (!cancelled) setModalData(d) })
    return () => { cancelled = true }
  }, [agentId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setProfileLoading(true)
      setError(null)
      setAgent(null)
      setMinimalAtom(null)
      setCohortMatch(null)
      setCohortFailed(false)
      setVector(EMPTY_VECTOR)
      setBackers([])

      // Profile vector + backers are needed by every tier — start immediately.
      const vectorPromise = fetchAgentProfileVector(agentId)
      const backersPromise = fetchAgentBackers(agentId)

      try {
        const { inScope, atom } = await resolveProfileAtom(agentId)
        if (cancelled) return

        if (inScope) {
          const response = await fetch(`/api/v1/agents/${agentId}`)
          if (!response.ok) throw new Error(response.status === 404 ? 'Agent not found' : 'Failed to load agent')
          const data = await response.json()
          if (cancelled) return
          if (!(data.success && data.data)) throw new Error('Invalid response format')
          const api = data.data as AgentDetailApiItem
          setAgent(apiToAgent(api))
          setLegacySkillClaimCount(api.skillBreakdown?.length ?? 0)
        } else if (atom) {
          setMinimalAtom(atom)
          // ONE agent's ERC-8004 identity + declarations (lib/cohort-reader.ts fetchCohortAgent) —
          // not the whole cohort (~15 requests) to find one row. The same lookup REST/MCP use.
          const { fetchCohortAgent } = await import('@/lib/cohort-reader')
          try {
            const match = await fetchCohortAgent(agentId)
            if (cancelled) return
            setCohortMatch(match)
          } catch {
            if (cancelled) return
            setCohortFailed(true)
          }
        } else {
          throw new Error('Agent not found')
        }
      } catch (err) {
        if (cancelled) return
        console.error('Error fetching agent:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        if (!cancelled) setLoading(false)
      }

      const [v, b] = await Promise.all([vectorPromise, backersPromise])
      if (cancelled) return
      setVector(v)
      setBackers(b)
      setProfileLoading(false)
      setAgent(prev => prev ? { ...prev, attestationCount: v.attested?.length ?? null, reportCount: v.reports?.length ?? null } : prev)
    }

    load()
    return () => { cancelled = true }
  }, [agentId])

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  if (loading) {
    return (
      <PageBackground image="hero" opacity={0.35}>
        <div className="pt-24 pb-16">
          <div className="container">
            <PageHeaderSkeleton />
            <div className="space-y-6 mt-8">
              <LoadingSkeleton variant="rectangular" height={200} />
              <LoadingSkeleton variant="rectangular" height={300} />
              <LoadingSkeleton variant="rectangular" height={400} />
            </div>
          </div>
        </div>
      </PageBackground>
    )
  }

  // null = the attestation read failed: the Attesters list says so instead of "no one".
  const attesters = vector.attested ? summarizeAttesters(vector.attested) : null
  // The header's stat row — the modal's derivation (lib/agent-profile.ts statRowView) over the same
  // parts: the agent's attestations, and the modal answer's reports, vault positions and signals.
  const vault = modalData?.vault?.status === 'ok' ? modalData.vault.value : null
  const statRow = statRowView({
    attested: profileLoading ? null : vector.attested,
    reportCount: modalData?.reports?.status === 'ok' ? modalData.reports.value.length : null,
    backers: vault ? backersFromPositions(vault.positions, agentId, vault.trustTriple?.counterTermId ?? null) : null,
    signals: modalData?.signals?.status === 'ok' ? modalData.signals.value.totalCount : null,
  })
  // The agent tier — attestations only (thesis §6). null while loading or if the read failed.
  const agentTier = attesters ? calculateAgentTier(attesters) : null

  // ── Non-scored tier: cohort agent, attested human, any real atom outside the scored corpus ──
  if (!agent && minimalAtom) {
    const name = minimalAtom.label
    return (
      <PageBackground image="hero" opacity={0.35}>
        <div className="pt-24 pb-40 md:pb-16">
          <div className="container max-w-2xl">
            <Link href="/agents" className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors mb-8">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Explorer
            </Link>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">{name}</h1>
                  {cohortMatch && <span className="text-xs text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded-full">ERC-8004</span>}
                  <AgentTierChip tier={agentTier} loading={profileLoading} />
                </div>
                <p className="text-text-muted text-sm">
                  {cohortMatch
                    ? ERC8004_ABOUT
                    : cohortFailed
                      ? 'Not in the scored AgentScore corpus. Couldn’t read its ERC-8004 identity right now — this is not a “no”.'
                      : 'Not in the scored AgentScore corpus — shown because it has on-chain claims. No score is computed for it.'}
                </p>
              </div>

              <ProfileStatRow view={statRow} backing={<BackingScore variant="line" value={null} tip={NOT_SCORED_TIP} />} />

              {/* ATTESTED > DECLARED > REPORTS (thesis §5 hierarchy) */}
              <AttestedDomains entries={vector.attested} loading={profileLoading} agentId={agentId} agentName={name} />
              <DeclaredDomains declaredDomains={cohortFailed ? null : cohortMatch?.declaredDomains} />
              <ReportsSection reports={vector.reports} loading={profileLoading} />

              {/* A cohort agent has an atom vault the /agents modal can back (it lists the cohort). */}
              {cohortMatch && <BackWithTTrust agentId={agentId} />}

              {/* Atom ID and the ERC-8004 id — collapsed; not the story a person reads first (Etap 5b). */}
              <AgentDetails termId={agentId} caipIdentity={cohortMatch?.caipIdentity} />

              <AttestersAndBackers attesters={attesters} backers={backers} loading={profileLoading} className="pt-2" />
            </motion.div>
          </div>
        </div>
        <AttestStickyBar agentId={agentId} agentName={name} />
      </PageBackground>
    )
  }

  if (error || !agent) {
    return (
      <PageBackground image="hero" opacity={0.35}>
        <div className="pt-24 pb-16">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-8 text-center max-w-md mx-auto"
            >
              <div className="mb-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Flag className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
                <p className="text-text-muted mb-6">
                  {error || 'The agent you are looking for could not be found. It may not exist yet or the data is still being indexed.'}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link href="/agents">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Explorer
                  </Link>
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </PageBackground>
    )
  }

  // ── Scored tier ──
  // The one backing score (Etap 5b): the card's and the modal's number — the envelope's trustScore
  // (support vs oppose on the atom vault) — only when it is a measurement (scoreBasis 'measured').
  const backingScore = agent.scoreParts?.measured ? Math.round(agent.scoreParts.trustScore) : null
  return (
    <PageBackground image="hero" opacity={0.35}>
      {/* pb-40 on mobile clears the sticky attest bar + bottom nav */}
      <div className="pt-24 pb-40 md:pb-16">
        <div className="container">
        {/* Breadcrumb & Actions */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <Link
            href="/agents"
            className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Explorer
          </Link>

          {/* Share only — the inert flag button is gone (Etap 5b): reports are filed from the
              /agents modal's report flow. */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Copy this page's link">
              <Share className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Header. The page's one attest CTA lives in the Attested section (desktop) or the
              sticky bar (phone) — Etap 5a: one CTA per page, not one per section. */}
          <AgentHeader
            agent={agent}
            tier={agentTier}
            tierLoading={profileLoading}
            stats={<ProfileStatRow view={statRow} backing={<BackingScore variant="line" value={backingScore} tip={NO_STAKE_TOOLTIP} />} />}
          />

          {/* ETAP 3 — profile hierarchy (thesis §5): ATTESTED (headline) >
              DECLARED (cohort only) > REPORTS (collapsed) > score context below.
              Zero attestations renders AttestEmptyState (thesis §6). */}
          <AttestedDomains entries={vector.attested} loading={profileLoading} agentId={agent.id} agentName={agent.name} />
          <DeclaredDomains declaredDomains={cohortMatch?.declaredDomains} />
          <ReportsSection reports={vector.reports} loading={profileLoading} />

          {/* Backing — secondary, collapsed, the modal's section and copy (Etap 5a). The old gold
              "Trust Agent" / "Report Issue" pair here never transacted (a 2 s timeout, then closed). */}
          <BackWithTTrust agentId={agent.id} />

          {/* Details — collapsed: the Atom ID and the backing score's parts (Etap 5b). The old
              "Trust Score" card and its Stake Breakdown live here now, as the modal's do. */}
          <AgentDetails termId={agent.id}>
            <ScoreParts view={scorePartsOf(agent)} />
          </AgentDetails>

          <AgentTabs
            agent={agent}
            attesters={attesters}
            backers={backers}
            profileLoading={profileLoading}
            legacySkillClaimCount={legacySkillClaimCount}
          />
        </div>
        </div>
      </div>

      {/* Mobile: Attest always in viewport, above the bottom nav */}
      <AttestStickyBar agentId={agent.id} agentName={agent.name} />
    </PageBackground>
  )
}

/**
 * The profile's "Back this agent": the modal's collapsed section and copy, with one secondary
 * action — the /agents modal's Buy/Sell panel (the one backing flow; `back=1` opens it expanded).
 */
function BackWithTTrust({ agentId }: { agentId: string }) {
  return (
    <BackThisAgentSection>
      <Link
        href={`/agents?open=${agentId}&back=1`}
        className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-[#171A1D] border border-[#C8963C]/25 text-[#C8963C] hover:bg-[#C8963C]/10"
        data-testid="back-with-ttrust"
      >
        Back with tTRUST
      </Link>
      <p className="text-[#7A838D] text-[11px] mt-2">Opens this agent&apos;s Buy / Sell panel.</p>
    </BackThisAgentSection>
  )
}

/** The REST detail's envelope as the Details' rows — "—" throughout unless it is a measurement. */
function scorePartsOf(agent: Agent): ScorePartsView {
  const p = agent.scoreParts
  const m = p?.measured === true
  const total = agent.positiveStake + agent.negativeStake
  return {
    trustScore: m ? p!.trustScore : null,
    composite: m ? p!.qualityScore : null,
    hybrid: m ? p!.objectScore : null,
    supportWei: agent.positiveStake,
    opposeWei: agent.negativeStake,
    supportPct: m && total > 0n ? Number((agent.positiveStake * 1000n) / total) / 10 : null,
  }
}
