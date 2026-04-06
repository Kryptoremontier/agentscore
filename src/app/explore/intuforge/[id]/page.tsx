import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Github, Globe, Twitter, MessageSquare, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MOCK_PROJECTS, PROJECT_STAGE_COLORS, PROJECT_STAGE_DOT_COLORS } from '@/lib/forge/constants'
import { PROJECT_STAGE_LABELS } from '@/lib/forge/types'
import type { ForgeProject } from '@/lib/forge/types'
import { fetchForgeProjectById } from '@/lib/forge/data'
import { CategoryPill } from '@/components/intuforge/CategoryPill'
import { ForgeBadge } from '@/components/intuforge/ForgeBadge'
import { ForgeTrustTimeline } from '@/components/intuforge/ForgeTrustTimeline'
import { ForgeStakeButtons } from '@/components/intuforge/ForgeStakeButtons'
import { ProjectShareButtons } from '@/components/intuforge/ProjectShareButtons'
import { TrustSparkline } from '@/components/TrustSparkline'

async function getProject(id: string): Promise<ForgeProject | null> {
  // Try real on-chain data first
  if (id.startsWith('0x')) {
    const chainProject = await fetchForgeProjectById(id)
    if (chainProject) return chainProject
  }
  // Fall back to mock data (for demo projects and indexer lag)
  return MOCK_PROJECTS.find(p => p.id === id || p.atomId === id) ?? null
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

export async function generateMetadata({ params }: { params: { id: string } }) {
  const project = await getProject(params.id)
  if (!project) return {}
  return {
    title: `${project.name} | IntuForge`,
    description: project.tagline,
  }
}

export default async function ProjectProfilePage({ params, searchParams }: { params: { id: string }; searchParams: { new?: string } }) {
  const project = await getProject(params.id)

  // Newly registered project — indexer may not have caught up yet
  if (!project && params.id.startsWith('0x')) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-4">
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

  const color = scoreColor(project.finalScore)
  const stageColor = PROJECT_STAGE_DOT_COLORS[project.stage]
  const isRealProject = project.id.startsWith('0x')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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

          {/* Trust Timeline */}
          <div
            className="rounded-xl border border-white/[0.07] p-5"
            style={{ background: 'rgba(255,255,255,0.015)' }}
          >
            <ForgeTrustTimeline
              projectId={project.id}
              projectName={project.name}
              createdAt={project.registeredAt}
              currentScore={project.finalScore}
              currentTier="unverified"
              isA2AReady={project.hasMCPServer || project.hasAPI}
            />
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-4">

          {/* Trust Score Card */}
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
              {project.sparklineData.length >= 2 && (
                <TrustSparkline datapoints={project.sparklineData} color={color} width={72} height={28} />
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
            <ForgeStakeButtons
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
                { label: 'Total Staked',  value: `${project.totalStaked.toFixed(2)} tTRUST` },
                { label: 'Stakers',       value: project.stakerCount.toString() },
                { label: 'Evaluators',    value: project.evaluatorCount.toString() },
                { label: 'Registered',    value: formatDate(project.registeredAt) },
                { label: 'Completeness',  value: `${project.completeness}%` },
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
