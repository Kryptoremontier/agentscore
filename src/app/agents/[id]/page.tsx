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
import { AgentStats } from '@/components/agents/AgentStats'
import { AgentTabs } from '@/components/agents/AgentTabs'
import { TrustButton } from '@/components/trust/TrustButton'
import { AttestButton } from '@/components/attest/AttestButton'
import { AttestStickyBar } from '@/components/attest/AttestStickyBar'
import { AttestedDomains } from '@/components/profile/AttestedDomains'
import { DeclaredDomains } from '@/components/profile/DeclaredDomains'
import { ReportsSection } from '@/components/profile/ReportsSection'
import { AttestersAndBackers } from '@/components/profile/AttestersAndBackers'
import { Button } from '@/components/ui/button'
import { PageHeaderSkeleton, LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { parseAgentCard } from '@/lib/agent-card'
import {
  resolveProfileAtom,
  fetchAgentProfileVector,
  fetchAgentBackers,
  summarizeAttesters,
  type AgentProfileVector,
  type Backer,
  type ProfileAtom,
} from '@/lib/agent-profile'
import type { CohortAgent } from '@/lib/cohort-reader'
import type { Agent } from '@/types/agent'
import type { AgentDetailApiItem } from '@/lib/api-data'

// Convert API response to Agent type. attestationCount/reportCount are
// overwritten from the canonical profile vector once it resolves.
function apiToAgent(apiAgent: AgentDetailApiItem): Agent {
  const card = parseAgentCard(apiAgent.rawLabel)
  return {
    id: apiAgent.id,
    atomId: BigInt(apiAgent.id),
    name: apiAgent.name,
    description: card.description || '',
    platform: 'intuition',
    walletAddress: '0x0000000000000000000000000000000000000000',
    createdAt: new Date(apiAgent.createdAt),
    verificationLevel: 'wallet',
    owner: {
      address: '0x0000000000000000000000000000000000000000',
      name: 'Agent Owner',
      expertLevel: 'contributor' as const,
    },
    trustScore: Math.round(apiAgent.score.objectScore ?? apiAgent.score.trustScore),
    positiveStake: BigInt(Math.round(apiAgent.supportStake * 1e18)),
    negativeStake: BigInt(Math.round(apiAgent.opposeStake * 1e18)),
    attestationCount: 0,
    reportCount: 0,
    stakerCount: apiAgent.stakerCount,
  }
}

const EMPTY_VECTOR: AgentProfileVector = { attested: [], reports: [] }

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params['id'] as string
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [legacySkillClaimCount, setLegacySkillClaimCount] = useState(0)
  const [minimalAtom, setMinimalAtom] = useState<ProfileAtom | null>(null)
  const [cohortMatch, setCohortMatch] = useState<CohortAgent | null>(null)
  const [error, setError] = useState<string | null>(null)
  // ETAP 3 canonical profile vector — shared by every tier.
  const [vector, setVector] = useState<AgentProfileVector>(EMPTY_VECTOR)
  const [backers, setBackers] = useState<Backer[]>([])
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setProfileLoading(true)
      setError(null)
      setAgent(null)
      setMinimalAtom(null)
      setCohortMatch(null)
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
          // Cohort membership only matters for the DECLARED chips.
          const { fetchCohortAgents } = await import('@/lib/cohort-reader')
          const cohort = await fetchCohortAgents()
          if (cancelled) return
          setCohortMatch(cohort.find(c => c.termId === agentId) ?? null)
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
      setAgent(prev => prev ? { ...prev, attestationCount: v.attested.length, reportCount: v.reports.length } : prev)
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

  const attesters = summarizeAttesters(vector.attested)

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
                </div>
                <p className="text-text-muted text-sm">
                  {cohortMatch
                    ? 'Real agent from the ERC-8004 registry cohort — self-declared, not scored by AgentScore.'
                    : 'Not in the scored AgentScore corpus — shown because it has on-chain claims. No score is computed for it.'}
                </p>
                {cohortMatch && (
                  <p className="text-xs text-text-muted font-mono break-all opacity-60 mt-1">{cohortMatch.caipIdentity}</p>
                )}
              </div>

              {/* ATTESTED > DECLARED > REPORTS (thesis §5 hierarchy) */}
              <AttestedDomains entries={vector.attested} loading={profileLoading} agentId={agentId} agentName={name} />
              <DeclaredDomains declaredDomains={cohortMatch?.declaredDomains} />
              <ReportsSection reports={vector.reports} loading={profileLoading} />

              <AttestersAndBackers attesters={attesters} backers={backers} loading={profileLoading} className="pt-2" />

              {vector.attested.length > 0 && (
                <AttestButton agentId={agentId} agentName={name} variant="hero" />
              )}
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

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Flag className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Header — Attest is THE primary action, mounted next to the name */}
          <AgentHeader
            agent={agent}
            action={<AttestButton agentId={agent.id} agentName={agent.name} variant="hero" />}
          />

          {/* ETAP 3 — profile hierarchy (thesis §5): ATTESTED (headline) >
              DECLARED (cohort only) > REPORTS (collapsed) > score context below.
              Zero attestations renders AttestEmptyState (thesis §6). */}
          <AttestedDomains entries={vector.attested} loading={profileLoading} agentId={agent.id} agentName={agent.name} />
          <DeclaredDomains declaredDomains={cohortMatch?.declaredDomains} />
          <ReportsSection reports={vector.reports} loading={profileLoading} />

          {/* Secondary actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TrustButton agentId={agent.id} />
          </motion.div>

          {/* Score context — below the canonical sections */}
          <AgentStats agent={agent} />

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
