'use client'

import { useState, useCallback } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { debounce } from '@/lib/performance'
import type { AgentPlatform, TrustLevel } from '@/types/agent'

interface SearchFiltersProps {
  onSearchChange: (search: string) => void
  onFiltersChange: (filters: FilterState) => void
}

export interface FilterState {
  platforms: AgentPlatform[]
  trustLevels: TrustLevel[]
  verified: boolean | null
  sortBy: 'trust_score' | 'created_at' | 'attestations' | 'stake'
  sortOrder: 'asc' | 'desc'
}

const platformOptions: { value: AgentPlatform; label: string }[] = [
  { value: 'moltbook', label: 'Moltbook' },
  { value: 'openclaw', label: 'OpenClaw' },
  { value: 'farcaster', label: 'Farcaster' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'custom', label: 'Custom' },
]

const trustLevelOptions: { value: TrustLevel; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'text-trust-excellent' },
  { value: 'good', label: 'Good', color: 'text-trust-good' },
  { value: 'moderate', label: 'Moderate', color: 'text-trust-moderate' },
  { value: 'low', label: 'Low', color: 'text-trust-low' },
  { value: 'critical', label: 'Critical', color: 'text-trust-critical' },
]

const sortOptions = [
  { value: 'trust_score', label: 'Trust Score' },
  { value: 'created_at', label: 'Recently Added' },
  { value: 'attestations', label: 'Most Attestations' },
  { value: 'stake', label: 'Highest Stake' },
]

export function SearchFilters({ onSearchChange, onFiltersChange }: SearchFiltersProps) {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    platforms: [],
    trustLevels: [],
    verified: null,
    sortBy: 'trust_score',
    sortOrder: 'desc',
  })

  // Create debounced search handler
  const debouncedSearchChange = useCallback(
    debounce((value: string) => {
      onSearchChange(value)
    }, 300),
    [onSearchChange]
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    debouncedSearchChange(value)
  }

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    onFiltersChange(updated)
  }

  const togglePlatform = (platform: AgentPlatform) => {
    const platforms = filters.platforms.includes(platform)
      ? filters.platforms.filter(p => p !== platform)
      : [...filters.platforms, platform]
    handleFilterChange({ platforms })
  }

  const toggleTrustLevel = (level: TrustLevel) => {
    const trustLevels = filters.trustLevels.includes(level)
      ? filters.trustLevels.filter(l => l !== level)
      : [...filters.trustLevels, level]
    handleFilterChange({ trustLevels })
  }

  const activeFilterCount =
    filters.platforms.length +
    filters.trustLevels.length +
    (filters.verified !== null ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search agents by name..."
            className="w-full pl-10 pr-4 py-2.5 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="relative"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass rounded-xl p-6 space-y-6">
          {/* Sort */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Sort By</h3>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleFilterChange({ sortBy: option.value as any })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    filters.sortBy === option.value
                      ? 'bg-primary text-white'
                      : 'glass hover:bg-white/10'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Platform</h3>
            <div className="flex flex-wrap gap-2">
              {platformOptions.map(platform => (
                <Badge
                  key={platform.value}
                  variant={filters.platforms.includes(platform.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => togglePlatform(platform.value)}
                >
                  {platform.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Trust Levels */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Trust Level</h3>
            <div className="flex flex-wrap gap-2">
              {trustLevelOptions.map(level => (
                <Badge
                  key={level.value}
                  variant={filters.trustLevels.includes(level.value) ? 'default' : 'outline'}
                  className={cn('cursor-pointer', level.color)}
                  onClick={() => toggleTrustLevel(level.value)}
                >
                  {level.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Verification Status */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Verification</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filters.verified === true ? 'default' : 'outline'}
                onClick={() => handleFilterChange({
                  verified: filters.verified === true ? null : true
                })}
              >
                Verified Only
              </Button>
              <Button
                size="sm"
                variant={filters.verified === false ? 'default' : 'outline'}
                onClick={() => handleFilterChange({
                  verified: filters.verified === false ? null : false
                })}
              >
                Unverified Only
              </Button>
            </div>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({
                  platforms: [],
                  trustLevels: [],
                  verified: null,
                  sortBy: 'trust_score',
                  sortOrder: 'desc',
                })
                onFiltersChange({
                  platforms: [],
                  trustLevels: [],
                  verified: null,
                  sortBy: 'trust_score',
                  sortOrder: 'desc',
                })
              }}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}