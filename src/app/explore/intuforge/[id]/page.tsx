import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Github, Globe, Twitter, MessageSquare, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PROJECT_STAGE_COLORS, PROJECT_STAGE_DOT_COLORS } from '@/lib/forge/constants'
import { PROJECT_STAGE_LABELS } from '@/lib/forge/types'
import type { ForgeProject } from '@/lib/forge/types'
import { fetchForgeProjectById } from '@/lib/forge/data'
import { buildForgeTimeline } from '@/lib/forge/timeline'
import { buildSparkline } from '@/lib/forge/scoring'
import { fetchTimelineData } from '@/lib/timeline-data'
import { calculateTier, getAgentAgeDays } from '@/lib/trust-tiers'
import { fetchStakerPositions } from '@/lib/evaluator-data'
import { calculateEvaluatorScore } from '@/lib/evaluator-score'
import type { EvaluatorProfile } from '@/lib/evaluator-score'
import { CategoryPill } from '@/components/intuforge/CategoryPill'
import { ForgeBadge } from '@/components/intuforge/ForgeBadge'
import { ForgeTrustTimeline } from '@/components/intuforge/ForgeTrustTimeline'
import { ForgeStakeSection } from '@/components/intuforge/ForgeStakeSection'
import { ProjectShareButtons } from '@/components/intuforge/ProjectShareButtons'
import { TrustSparkline } from '@/components/TrustSparkline'
import { TrustTierBadge } from '@/components/agents/TrustTierBadge'

async function getProject(id: string): Promise<ForgeProject | null> {
  if (!id.startsWith('0x')) return null
  return fetchForgeProjectById(id)
}

function scoreColor(score: number): string {
  if (score >= 80) return '#C8963C'
  if (score >= 60) return '#2EE6D6'
  if (score >= 40) return '#8B5CF6'
  if (score >= 20) return '#F59E0B'
  return '#ef4444'
}

function MomentumIcon({ momentum }: { momentum: 'up' | 'down' | 'stable' }) {
  if (momentum === 'up') return <TrendingUp className="w-5 h-5 inline ml-2" style={{ color: '#2ECC71' }} />
  if (momentum === 'down') return <TrendingDown className="w-5 h-5 inline ml-2" style={{ color: '#EF4444' }} />
  return <Minus className="w-5 h-5 inline ml-2" style={{ color: 'rgba(255,255,255,0.3)' }} />
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const EVALUATOR_TIER_EMOJI: Record<string, string> = {
  sage:     '🧙',
  oracle:   '🔮',
  analyst:  '📊',
  scout:    '🌿',
  newcomer: '🌱',
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const project = await getProject(params.id)
  if (!project) return {}
  return {
    title: `${project.name} | IntuForge`,
    description: project.tagline,
  }
}

export default async function ProjectProfilePage({ params, searchParams: _searchParams }: { params: { id: string }; searchParams: { new?: string } }) {
  // Fix 6: fetch project + timeline data in parallel
  const [project, timelineRaw] = await Promise.all([
    getProject(params.id),
    fetchTimelineData(params.id).catch(() => null),
  ])

  // Newly registered project — indexer may not have caught up yet
  if (!project && params.id.startsWith('0x')) {
    return (
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <div
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(200,150,60,0.08)', border: '1px solid rgba(200,150,60,0.2)', color: '#C8963C' }}
        >
          Project registered on-chain — syncing with indexer (~30s). Please refresh.
        </div>
        <p className="text-xs text-white/25">Atom ID: {params.id}</p>
        <Link href="/explore/intuforge" className="text-xs text-white/40 hover:text-white/60 transition-colors">
          ← Back to IntuForge
        </Link>
      </div>
    )
  }

  if (!project) notFound()

  // Fix 5: calculate real tier
  const daysActive  = getAgentAgeDays(project.registeredAt)
  const totalStake  = project.totalStaked + project.opposeStaked
  const supportRatio = totalStake > 0
    ? (project.totalStaked / totalStake) * 100
    : 50
  const tierCfg    = calculateTier(project.stakerCount, project.totalStaked, supportRatio, daysActive)
  const currentTier = tierCfg.tier

  // Fix 3: evaluator profiles for top stakers (up to 10, parallel)
  const stakerAddresses = (project.supportPositions ?? [])
    .slice(0, 10)
    .map(p => p.address)
    .filter(Boolean)

  const evaluatorProfileMap = new Map<string, EvaluatorProfile>()
  if (stakerAddresses.length > 0) {
    const results = await Promise.allSettled(
      stakerAddresses.map(async addr => {
        const positions = await fetchStakerPositions(addr)
        return { addr: addr.toLowerCase(), profile: calculateEvaluatorScore(addr, positions) }
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        evaluatorProfileMap.set(r.value.addr, r.value.profile)
      }
    }
  }

  // Evaluator weights as serializable entries for ForgeTrustTimeline (Fix 3)
  const evaluatorWeightsEntries: [string, number][] = Array.from(evaluatorProfileMap.entries())
    .map(([addr, p]) => [addr, p.evaluatorWeight])

  // Fix 6: map timeline signals for ForgeTrustTimeline
  const agentSignals = (timelineRaw?.stakingEvents ?? []).map(s => ({
    id:            s.id,
    delta:         s.deltaWei,
    account_id:    s.accountId ?? '',
    term_id:       s.side === 'oppose' ? (project.counterTermId ?? '') : project.atomId,
    created_at:    s.timestamp,
    deposit_id:    s.type === 'deposit' ? s.id : null,
    redemption_id: s.type === 'redeem'  ? s.id : null,
  }))

  // Fix 9: sparkline from timeline score history (when we have events)
  let sparklineData = project.sparklineData
  if (agentSignals.length > 0) {
    try {
      const builtTimeline = buildForgeTimeline({
        agentId:       project.atomId,
        agentName:     project.name,
        createdAt:     project.registeredAt,
        currentScore:  project.finalScore,
        currentTier,
        stakingEvents: timelineRaw?.stakingEvents ?? [],
        skillEvents:   timelineRaw?.skillEvents   ?? [],
        profileCompleteness: { isA2AReady: project.hasMCPServer || project.hasAPI },
      })
      if (builtTimeline.scoreHistory.length >= 2) {
        sparklineData = buildSparkline(builtTimeline.scoreHistory.map(p => p.score))
      }
    } catch { /* non-critical */ }
  }

  const color      = scoreColor(project.finalScore)
  const stageColor = PROJECT_STAGE_DOT_COLORS[project.stage]
  const isRealProject = project.id.startsWith('0x')

  // Fix 8: support vs oppose ratio
  const hasStakes    = totalStake > 0
  const supportPct   = hasStakes ? Math.round((project.totalStaked / totalStake) * 100) : 0
  const opposePct    = 100 - supportPct

  // All stakers combined + sorted by size
  const allStakers = [
    ...(project.supportPositions ?? []).map(p => ({ ...p, side: 'support' as const })),
    ...(project.opposePositions  ?? []).map(p => ({ ...p, side: 'oppose'  as const })),
  ].sort((a, b) => {
    try { return Number(BigInt(b.sharesWei) - BigInt(a.sharesWei)) } catch { return 0 }
  }).slice(0, 12)

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-white/30 mb-6">
        <Link href="/explore/intuforge" className="hover:text-white/60 transition-colors">IntuForge</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white/50">{project.name}</span>
      </nav>

      {/* 70/30 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">

        {/* LEFT — main content */}
        <div className="space-y-6 min-w-0">

          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor }} />
                <span className={`text-xs font-medium ${PROJECT_STAGE_COLORS[project.stage]}`}>
                  {PROJECT_STAGE_LABELS[project.stage]}
                </span>
              </div>
              <CategoryPill category={project.category} size="sm" />
              {/* Fix 5: tier badge */}
              <TrustTierBadge tier={tierCfg} size="sm" />
            </div>

            {/* Links row */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {project.github && (
                <a
                  href={project.github.startsWith('http') ? project.github : `https://${project.github}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <Github className="w-3.5 h-3.5" /> GitHub ↗
                </a>
              )}
              {project.website && (
                <a
                  href={project.website}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" /> Website ↗
                </a>
              )}
              {project.twitter && (
                <a
                  href={`https://twitter.com/${project.twitter.replace('@', '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <Twitter className="w-3.5 h-3.5" /> Twitter ↗
                </a>
              )}
              {project.discord && (
                <a
                  href={project.discord.startsWith('http') ? project.discord : `https://${project.discord}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Discord ↗
                </a>
              )}
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Live Demo ↗
                </a>
              )}
            </div>
          </div>

          {/* Tagline */}
          <p className="text-base font-medium text-white/70 leading-relaxed border-l-2 border-amber-500/30 pl-4">
            {project.tagline}
          </p>

          {/* Description */}
          <p className="text-sm text-white/50 leading-relaxed">{project.description}</p>

          {/* Tech Stack */}
          {(project.techStack || []).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/20 mb-2">Tech Stack</p>
              <div className="flex flex-wrap gap-1.5">
                {(project.techStack || []).map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs text-white/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Team */}
          {!project.isAnonymous && project.teamSize && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/20 mb-1">Team</p>
              <p className="text-sm text-white/50">{project.teamSize} member{project.teamSize !== 1 ? 's' : ''}</p>
            </div>
          )}
          {project.isAnonymous && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/20 mb-1">Team</p>
              <p className="text-sm text-white/40 italic">Anonymous</p>
            </div>
          )}

          {/* Integrations */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/20 mb-2">Integrations</p>
            <div className="flex flex-wrap gap-2">
              {project.usesFeeProxy && (
                <span className="px-2 py-1 rounded-md border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400/70">
                  FeeProxy ✓
                </span>
              )}
              {project.hasMCPServer && (
                <span className="px-2 py-1 rounded-md border border-cyan-500/20 bg-cyan-500/5 text-xs text-cyan-400/70">
                  MCP Server ✓
                </span>
              )}
              {project.hasAPI && (
                <span className="px-2 py-1 rounded-md border border-purple-500/20 bg-purple-500/5 text-xs text-purple-400/70">
                  REST API ✓
                </span>
              )}
              {project.isOpenSource && (
                <span className="px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400/70">
                  Open Source ✓
                </span>
              )}
              {!project.usesFeeProxy && !project.hasMCPServer && !project.hasAPI && !project.isOpenSource && (
                <span className="text-xs text-white/20 italic">No integrations declared</span>
              )}
            </div>
          </div>

          {/* Fix 7: Staker list */}
          {allStakers.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/20 mb-3">Backers</p>
              <div className="space-y-1">
                {allStakers.map(staker => {
                  const shares  = (() => { try { return BigInt(staker.sharesWei) } catch { return 0n } })()
                  const tTRUST  = Number(shares) / 1e18
                  const profile = evaluatorProfileMap.get(staker.address.toLowerCase())
                  const emoji   = profile && profile.evaluatorTier !== 'newcomer'
                    ? EVALUATOR_TIER_EMOJI[profile.evaluatorTier]
                    : null

                  return (
                    <div
                      key={staker.address + staker.side}
                      className="flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <span className="font-mono text-white/35 flex-1 min-w-0 truncate">
                        {truncateAddress(staker.address)}
                      </span>
                      {emoji && (
                        <span className="flex-shrink-0 text-[11px]" title={`${profile?.evaluatorTier} evaluator`}>
                          {emoji}
                        </span>
                      )}
                      <span className="text-white/30 flex-shrink-0 tabular-nums">
                        {tTRUST.toFixed(3)}
                      </span>
                      <span
                        className="flex-shrink-0 text-[10px] font-medium"
                        style={{ color: staker.side === 'support' ? 'rgba(46,204,113,0.7)' : 'rgba(239,68,68,0.6)' }}
                      >
                        {staker.side === 'support' ? 'For' : 'Against'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Trust Timeline — Fix 6: real signals + tier + evaluator weights */}
          <div
            className="rounded-xl border border-white/[0.07] p-5"
            style={{ background: 'rgba(255,255,255,0.015)' }}
          >
            <ForgeTrustTimeline
              projectId={project.id}
              projectName={project.name}
              createdAt={project.registeredAt}
              currentScore={project.finalScore}
              currentTier={currentTier}
              counterTermId={project.counterTermId ?? undefined}
              agentSignals={agentSignals}
              evaluatorWeightsEntries={evaluatorWeightsEntries}
              isA2AReady={project.hasMCPServer || project.hasAPI}
            />
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-4">

          {/* Trust Score Card — Fix 9: real sparkline */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Trust Score</p>
                <span className="text-4xl font-bold tabular-nums" style={{ color }}>
                  {project.finalScore}
                </span>
                <MomentumIcon momentum={project.momentum} />
              </div>
              {sparklineData.length >= 2 && (
                <TrustSparkline datapoints={sparklineData} color={color} width={72} height={28} />
              )}
            </div>

            {/* Score bar */}
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${project.finalScore}%`, background: color }}
              />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-white/30 mb-0.5">Trust</p>
                <p className="font-mono font-semibold text-white/70">{project.trustScore}</p>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-white/30 mb-0.5">Composite</p>
                <p className="font-mono font-semibold text-white/70">{project.compositeScore}</p>
              </div>
            </div>
          </div>

          {/* Stake buttons — real FeeProxy if on-chain project, disabled for mock */}
          {isRealProject ? (
            <ForgeStakeSection
              atomId={project.atomId}
              counterTermId={project.counterTermId}
              projectName={project.name}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled
                className="py-2.5 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(46,230,214,0.08)', border: '1px solid rgba(46,230,214,0.2)', color: '#2EE6D6' }}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Back
              </button>
              <button
                disabled
                className="py-2.5 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' }}
              >
                <TrendingDown className="w-3.5 h-3.5" /> Oppose
              </button>
            </div>
          )}

          {/* Stats */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-white/25">Stats</p>
            <div className="space-y-2">
              {[
                { label: 'Support Staked', value: `${project.totalStaked.toFixed(3)} tTRUST` },
                { label: 'Oppose Staked',  value: `${project.opposeStaked.toFixed(3)} tTRUST` },
                { label: 'Stakers',        value: project.stakerCount.toString() },
                { label: 'Days Active',    value: daysActive.toString() },
                { label: 'Registered',     value: formatDate(project.registeredAt) },
                { label: 'Completeness',   value: `${project.completeness}%` },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-white/30">{item.label}</span>
                  <span className="text-white/60 font-medium">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Completeness bar */}
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${project.completeness}%`, background: 'rgba(200,150,60,0.5)' }}
              />
            </div>
          </div>

          {/* Fix 8: Support vs Oppose ratio bar */}
          {hasStakes && (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-white/25">Signal Ratio</p>
              <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
                <div
                  className="h-full transition-all"
                  style={{ width: `${supportPct}%`, background: 'rgba(46,204,113,0.6)' }}
                />
                <div
                  className="h-full flex-1"
                  style={{ background: opposePct > 0 ? 'rgba(239,68,68,0.4)' : 'transparent' }}
                />
              </div>
              <div className="flex justify-between text-[10px]">
                <span style={{ color: 'rgba(46,204,113,0.7)' }}>{supportPct}% For</span>
                <span style={{ color: 'rgba(239,68,68,0.6)' }}>{opposePct}% Against</span>
              </div>
            </div>
          )}

          {/* Registered by */}
          <div
            className="rounded-xl border p-3"
            style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <p className="text-xs text-white/25 mb-1">Registered by</p>
            <p className="text-xs font-mono text-white/40">{truncateAddress(project.registrantAddress)}</p>
            <p className="text-[10px] text-white/20 mt-0.5">{formatDate(project.registeredAt)}</p>
          </div>

          {/* ForgeBadge */}
          <ForgeBadge trustScore={project.finalScore} size="md" />

          {/* Share */}
          <ProjectShareButtons projectName={project.name} finalScore={project.finalScore} />
        </div>
      </div>
    </div>
  )
}
