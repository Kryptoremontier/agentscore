'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, ArrowUpDown, LayoutGrid, List, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { ForgeCategory, ProjectStage, FORGE_CATEGORIES, PROJECT_STAGE_LABELS } from '@/lib/forge/types'
import type { ForgeProject } from '@/lib/forge/types'
import { ProjectCard } from './ProjectCard'
import { mapLegacyCategory, CATEGORY_ICON_MAP, CATEGORY_HEX, CategoryPill, CategoryIconSquare } from './CategoryPill'

type SortMode  = 'trustScore' | 'newest' | 'mostStaked' | 'mostStakers'
type ViewMode  = 'grid' | 'list'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'trustScore',   label: 'Trust Score' },
  { value: 'newest',       label: 'Newest' },
  { value: 'mostStaked',   label: 'Most Staked' },
  { value: 'mostStakers',  label: 'Most Stakers' },
]

const ALL_STAGES = Object.values(ProjectStage)

// Short labels for filter pills so they fit in one scrollable row
const CATEGORY_SHORT_LABELS: Partial<Record<ForgeCategory, string>> = {
  [ForgeCategory.AI_AGENTS]:          'AI',
  [ForgeCategory.TRUST_REPUTATION]:   'Trust',
  [ForgeCategory.DEFI]:               'DeFi',
  [ForgeCategory.SOCIAL]:             'Social',
  [ForgeCategory.IDENTITY]:           'ID',
  [ForgeCategory.DATA_ANALYTICS]:     'Data',
  [ForgeCategory.DEVELOPER_TOOLS]:    'Dev',
  [ForgeCategory.INFRASTRUCTURE]:     'Infra',
  [ForgeCategory.PREDICTION_MARKETS]: 'Predict',
  [ForgeCategory.GOVERNANCE]:         'Gov',
  [ForgeCategory.GAMING_NFT]:         'Gaming',
  [ForgeCategory.OTHER]:              'Other',
}

interface ProjectGridProps {
  projects: ForgeProject[]
}

function scoreColor(score: number): string {
  if (score >= 80) return '#C8963C'
  if (score >= 60) return '#2EE6D6'
  if (score >= 40) return '#A78BFA'
  if (score >= 20) return '#F59E0B'
  return '#EF4444'
}

function MomentumIcon({ m }: { m: string }) {
  if (m === 'up')   return <TrendingUp   className="w-3 h-3" style={{ color: '#2ECC71' }} />
  if (m === 'down') return <TrendingDown className="w-3 h-3" style={{ color: '#EF4444' }} />
  return <Minus className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<ForgeCategory[]>([])
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null)
  const [sort, setSort] = useState<SortMode>('trustScore')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const toggleCategory = useCallback((cat: ForgeCategory) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }, [])

  const filteredProjects = useMemo(() => {
    let result = [...projects]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q)
      )
    }

    if (selectedCategories.length > 0) {
      result = result.filter(p =>
        selectedCategories.includes(mapLegacyCategory(p.category) as ForgeCategory)
      )
    }

    // Stage filter
    if (selectedStage) {
      result = result.filter(p => p.stage === selectedStage)
    }

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case 'trustScore':   return b.finalScore - a.finalScore
        case 'newest':       return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
        case 'mostStaked':   return b.totalStaked - a.totalStaked
        case 'mostStakers':  return b.stakerCount - a.stakerCount
      }
    })

    return result
  }, [projects, search, selectedCategories, selectedStage, sort])

  return (
    <div className="space-y-4">
      {/* Category filter pills — horizontal scroll on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          onClick={() => setSelectedCategories([])}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
          style={selectedCategories.length === 0
            ? { background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.30)', color: '#C8963C' }
            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
          }
        >
          All
        </button>
        {FORGE_CATEGORIES.map(cat => {
          const active = selectedCategories.includes(cat.id)
          const Icon   = CATEGORY_ICON_MAP[cat.icon]
          const hex    = CATEGORY_HEX[cat.color]
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
              style={active
                ? { background: hex.bg, border: `1px solid ${hex.border}`, color: hex.text }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              {Icon && <Icon className="w-3 h-3" style={{ color: active ? hex.text : 'rgba(255,255,255,0.3)' }} />}
              {CATEGORY_SHORT_LABELS[cat.id] ?? cat.label}
            </button>
          )
        })}
      </div>

      {/* Stage pills + sort + search */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedStage(null)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={selectedStage === null
              ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }
            }
          >
            All Stages
          </button>
          {ALL_STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => setSelectedStage(prev => prev === stage ? null : stage)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={selectedStage === stage
                ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }
              }
            >
              {PROJECT_STAGE_LABELS[stage]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div
            className="flex items-center gap-1 rounded-lg px-1 py-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ArrowUpDown className="w-3 h-3 ml-1" style={{ color: 'rgba(255,255,255,0.3)' }} />
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setSort(o.value)}
                className="px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                style={sort === o.value
                  ? { background: 'rgba(200,150,60,0.12)', color: '#C8963C' }
                  : { color: 'rgba(255,255,255,0.35)' }
                }
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none transition-colors w-36 sm:w-48"
              style={{
                background: '#12151A',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.8)',
              }}
            />
          </div>

          {/* View mode toggle */}
          <div
            className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              style={viewMode === 'grid' ? {
                background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.08))',
                border: '1px solid rgba(200,150,60,0.35)',
                color: '#C8963C',
              } : { border: '1px solid transparent', color: '#7A838D' }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              style={viewMode === 'list' ? {
                background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.08))',
                border: '1px solid rgba(200,150,60,0.35)',
                color: '#C8963C',
              } : { border: '1px solid transparent', color: '#7A838D' }}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filteredProjects.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-white/30 text-sm">No projects found.</p>
          <p className="text-white/20 text-xs mt-1">Be the first to list your project on IntuForge!</p>
          <a
            href="/explore/intuforge/register"
            className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'rgba(200,150,60,0.1)',
              border: '1px solid rgba(200,150,60,0.2)',
              color: '#C8963C',
            }}
          >
            Register Project →
          </a>
        </div>

      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              rank={sort === 'trustScore' && selectedCategories.length === 0 && !selectedStage && !search ? i + 1 : undefined}
            />
          ))}
        </div>

      ) : (
        /* ── LIST VIEW ── */
        <div className="flex flex-col gap-1.5">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            <span className="w-8" />
            <span>Project</span>
            <span className="hidden sm:block w-28 text-right">Category</span>
            <span className="text-right w-16">Staked</span>
            <span className="text-right w-14">Stakers</span>
            <span className="text-right w-12">Score</span>
          </div>

          {filteredProjects.map((project, i) => {
            const color = scoreColor(project.finalScore)
            const isRankVisible = sort === 'trustScore' && selectedCategories.length === 0 && !selectedStage && !search
            return (
              <div
                key={project.id}
                onClick={() => router.push(`/explore/intuforge/${project.atomId}`)}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-150"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background    = 'rgba(200,150,60,0.05)'
                  ;(e.currentTarget as HTMLElement).style.borderColor   = 'rgba(200,150,60,0.15)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background    = 'rgba(255,255,255,0.02)'
                  ;(e.currentTarget as HTMLElement).style.borderColor   = 'rgba(255,255,255,0.05)'
                }}
              >
                {/* Icon square with optional rank number */}
                <div className="relative w-8 h-8 shrink-0">
                  <CategoryIconSquare category={project.category} size={32} iconClass="w-3.5 h-3.5" />
                  {isRankVisible && i < 3 && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: '#C8963C', color: '#000' }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Name + tagline */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-tight">{project.name}</p>
                  <p className="text-[11px] truncate leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {project.tagline}
                  </p>
                </div>

                {/* Category pill */}
                <div className="hidden sm:flex w-28 justify-end">
                  <CategoryPill category={project.category} size="sm" />
                </div>

                {/* Staked */}
                <span className="text-xs text-right w-16 whitespace-nowrap" style={{ color: '#B5BDC6' }}>
                  {project.totalStaked > 0 ? `${project.totalStaked.toFixed(2)}` : '—'}
                </span>

                {/* Stakers */}
                <span className="text-xs text-right w-14 whitespace-nowrap" style={{ color: '#B5BDC6' }}>
                  {project.stakerCount}
                </span>

                {/* Score + momentum */}
                <div className="flex items-center justify-end gap-1 w-12">
                  <span className="text-sm font-bold font-mono" style={{ color }}>{project.finalScore}</span>
                  <MomentumIcon m={project.momentum} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
