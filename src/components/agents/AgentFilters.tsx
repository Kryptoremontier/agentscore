'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, X, Check,
  Code, PenTool, BarChart, TrendingUp, MessageCircle,
  Gamepad, Wallet, Image, Headphones, MoreHorizontal,
  Search as SearchIcon
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { AGENT_CATEGORIES, type AgentCategory, type AgentFilters } from '@/types/agent'
import { Slider } from '@/components/ui/slider'

interface AgentFiltersProps {
  filters: AgentFilters
  onChange: (filters: AgentFilters) => void
  totalResults: number
}

const categoryIcons: Record<AgentCategory, React.ComponentType<{ className?: string }>> = {
  coding: Code,
  writing: PenTool,
  data: BarChart,
  trading: TrendingUp,
  social: MessageCircle,
  gaming: Gamepad,
  defi: Wallet,
  nft: Image,
  research: SearchIcon,
  customer_service: Headphones,
  other: MoreHorizontal,
}

export function AgentFilters({ filters, onChange, totalResults }: AgentFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)

  const updateFilter = <K extends keyof AgentFilters>(key: K, value: AgentFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleCategory = (category: AgentCategory) => {
    const current = filters.categories
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category]
    updateFilter('categories', updated)
  }

  const clearFilters = () => {
    onChange({
      search: '',
      categories: [],
      trustRange: [0, 100],
      verifiedOnly: false,
      sortBy: 'trust',
      sortOrder: 'desc',
    })
  }

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.trustRange[0] > 0 ||
    filters.trustRange[1] < 100 ||
    filters.verifiedOnly

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search agents by name, description, or address..."
            className={cn(
              'w-full pl-12 pr-4 py-3 rounded-xl',
              'bg-white/5 border border-white/10',
              'focus:outline-none focus:border-primary focus:bg-white/10',
              'transition-all duration-200'
            )}
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl',
            'border transition-all duration-200',
            showFilters || hasActiveFilters
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          )}
        >
          <Filter className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-primary text-xs flex items-center justify-center">
              {filters.categories.length + (filters.verifiedOnly ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-6 space-y-6">

              {/* Categories */}
              <div>
                <label className="text-sm font-medium text-slate-400 mb-3 block">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(AGENT_CATEGORIES) as [AgentCategory, typeof AGENT_CATEGORIES[AgentCategory]][]).map(
                    ([key, { label }]) => {
                      const Icon = categoryIcons[key]
                      const isActive = filters.categories.includes(key)
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                            'border transition-all duration-200',
                            isActive
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                          {isActive && <Check className="w-3 h-3" />}
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              {/* Trust Score Range */}
              <div>
                <label className="text-sm font-medium text-slate-400 mb-3 block">
                  Trust Score: {filters.trustRange[0]} - {filters.trustRange[1]}
                </label>
                <div className="px-2">
                  <Slider
                    value={filters.trustRange}
                    onValueChange={(value) => updateFilter('trustRange', value as [number, number])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>0 (Critical)</span>
                  <span>50 (Moderate)</span>
                  <span>100 (Excellent)</span>
                </div>
              </div>

              {/* Verified Only Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">
                  Verified agents only
                </label>
                <button
                  onClick={() => updateFilter('verifiedOnly', !filters.verifiedOnly)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors duration-200 relative',
                    filters.verifiedOnly ? 'bg-primary' : 'bg-white/10'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white transition-transform duration-200 absolute top-0.5',
                      filters.verifiedOnly ? 'translate-x-6' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-400">Sort by:</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value as AgentFilters['sortBy'])}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="trust">Trust Score</option>
                  <option value="staked">Total Staked</option>
                  <option value="newest">Newest</option>
                  <option value="attestations">Attestations</option>
                </select>

                <button
                  onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {filters.sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="text-sm text-slate-400">
        Showing <span className="text-white font-medium">{totalResults}</span> agents
        {hasActiveFilters && ' (filtered)'}
      </div>
    </div>
  )
}
