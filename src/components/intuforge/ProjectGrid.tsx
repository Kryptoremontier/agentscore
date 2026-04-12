'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ForgeCategory, ProjectStage, FORGE_CATEGORIES, PROJECT_STAGE_LABELS } from '@/lib/forge/types'
import type { ForgeProject } from '@/lib/forge/types'
import { ProjectCard } from './ProjectCard'
import { mapLegacyCategory } from './CategoryPill'

type SortMode = 'trustScore' | 'newest' | 'mostStaked' | 'mostStakers'

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

export function ProjectGrid({ projects }: ProjectGridProps) {
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<ForgeCategory[]>([])
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null)
  const [sort, setSort] = useState<SortMode>('trustScore')

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
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
              style={active
                ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.20)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <span>{cat.icon}</span>
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
        </div>
      </div>

      {/* Grid */}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              rank={sort === 'trustScore' && selectedCategories.length === 0 && !selectedStage && !search ? i + 1 : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
