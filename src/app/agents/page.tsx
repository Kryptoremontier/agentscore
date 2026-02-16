'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { AgentFilters } from '@/components/agents/AgentFilters'
import { AgentGridOptimized } from '@/components/agents/AgentGridOptimized'
import { Pagination } from '@/components/agents/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeaderSkeleton } from '@/components/shared/LoadingSkeleton'
import type { Agent, AgentFilters as AgentFiltersType } from '@/types/agent'
import { createMockAtom, atomToAgent } from '@/lib/intuition-adapter'

// Temporary mock data using Intuition structure
// TODO: Replace with real Intuition API calls
const generateMockAgentsFromIntuition = (count: number): Agent[] => {
  return Array.from({ length: count }, (_, i) => {
    const mockAtom = createMockAtom(i + 1)
    return atomToAgent(mockAtom)
  })
}

const ITEMS_PER_PAGE = 12

export default function AgentsPage() {
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<AgentFiltersType>({
    search: '',
    categories: [],
    trustRange: [0, 100],
    verifiedOnly: false,
    sortBy: 'trust',
    sortOrder: 'desc',
  })
  const [currentPage, setCurrentPage] = useState(1)

  // TODO: Replace with real Intuition data
  // const { agents, isLoading: isLoadingAgents, error } = useAgents()

  // Using mock data with Intuition structure for now
  const allAgents = useMemo(() => generateMockAgentsFromIntuition(50), [])

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = [...allAgents]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(agent =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.description?.toLowerCase().includes(searchLower) ||
        agent.walletAddress?.toLowerCase().includes(searchLower)
      )
    }

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter(agent =>
        agent.category && filters.categories.includes(agent.category)
      )
    }

    // Trust range filter
    result = result.filter(agent =>
      agent.trustScore >= filters.trustRange[0] &&
      agent.trustScore <= filters.trustRange[1]
    )

    // Verification filter
    if (filters.verifiedOnly) {
      result = result.filter(agent => agent.verificationLevel !== 'none')
    }

    // Sort
    result.sort((a, b) => {
      let compareValue = 0

      switch (filters.sortBy) {
        case 'trust':
          compareValue = a.trustScore - b.trustScore
          break
        case 'newest':
          compareValue = a.createdAt.getTime() - b.createdAt.getTime()
          break
        case 'attestations':
          compareValue = a.attestationCount - b.attestationCount
          break
        case 'staked':
          compareValue = Number(a.positiveStake - a.negativeStake) -
                        Number(b.positiveStake - b.negativeStake)
          break
      }

      return filters.sortOrder === 'asc' ? compareValue : -compareValue
    })

    return result
  }, [allAgents, filters])

  // Pagination
  const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE)
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleClearFilters = () => {
    setFilters({
      search: '',
      categories: [],
      trustRange: [0, 100],
      verifiedOnly: false,
      sortBy: 'trust',
      sortOrder: 'desc',
    })
  }

  const hasActiveFilters =
    filters.search ||
    filters.categories.length > 0 ||
    filters.trustRange[0] > 0 ||
    filters.trustRange[1] < 100 ||
    filters.verifiedOnly

  return (
    <PageBackground image="hero" opacity={0.4}>
      <div className="pt-24 pb-16">
        <div className="container">
        {/* Page Header */}
        {loading ? (
          <PageHeaderSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent-cyan">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold">Agent Explorer</h1>
            </div>
            <p className="text-xl text-text-secondary max-w-2xl">
              Discover and verify AI agents across the ecosystem. Check trust scores
              before interaction.
            </p>
          </motion.div>
        )}

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-6 mb-8 text-sm text-text-muted"
        >
          <span>
            <span className="font-semibold text-text-primary">
              {filteredAgents.length}
            </span>{' '}
            agents found
          </span>
          {hasActiveFilters && (
            <>
              <span className="text-border">|</span>
              <button
                onClick={handleClearFilters}
                className="text-primary hover:text-primary-hover transition-colors"
              >
                Clear all filters
              </button>
            </>
          )}
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <AgentFilters
            filters={filters}
            onChange={setFilters}
            totalResults={filteredAgents.length}
          />
        </motion.div>

        {/* Content */}
        {!loading && filteredAgents.length === 0 ? (
          <EmptyState
            type={hasActiveFilters ? 'filtered' : 'no-agents'}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
        ) : (
          <>
            {/* Agent Grid */}
            <AgentGridOptimized agents={paginatedAgents} loading={loading} />

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className="mt-12"
                />
              </motion.div>
            )}
          </>
        )}
        </div>
      </div>
    </PageBackground>
  )
}