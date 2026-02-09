'use client'

import { useState, useMemo, useEffect } from 'react'
import { Filter, TrendingUp, TrendingDown } from 'lucide-react'
import { AttestationCard } from './AttestationCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Attestation, AttestationPredicate } from '@/types/attestation'
import type { ExpertLevel } from '@/types/user'

interface AttestationListProps {
  agentId: string
}

// Mock data generator
const generateMockAttestations = (agentId: string, count: number): Attestation[] => {
  const predicates: AttestationPredicate[] = [
    'trusts', 'distrusts', 'reported_for_scam', 'reported_for_spam',
    'reported_for_injection', 'verified_by', 'vouches_for'
  ]
  const expertLevels = ['newcomer', 'contributor', 'expert', 'master', 'legend'] as const

  return Array.from({ length: count }, (_, i) => ({
    id: `attestation-${i}`,
    tripleId: BigInt(i),
    subject: {
      id: agentId,
      name: `Agent ${agentId}`,
      type: 'agent' as const,
    },
    predicate: predicates[Math.floor(Math.random() * predicates.length)] as AttestationPredicate,
    object: {
      id: `object-${i}`,
      label: (['trustworthy', 'scammer', 'verified developer', 'high quality'][i % 4] || 'unknown'),
    },
    staker: {
      address: `0x${Math.floor(Math.random() * 1e16).toString(16).padStart(40, '0')}` as `0x${string}`,
      name: Math.random() > 0.5 ? `User ${i}` : undefined,
      expertLevel: expertLevels[Math.floor(Math.random() * expertLevels.length)] as ExpertLevel,
    },
    stakeAmount: BigInt(Math.floor(Math.random() * 1000) * 1e18),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    transactionHash: `0x${Math.floor(Math.random() * 1e16).toString(16).padStart(64, '0')}` as `0x${string}`,
  }))
}

type FilterType = 'all' | 'positive' | 'negative' | 'reports'

export function AttestationList({ agentId }: AttestationListProps) {
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [attestations, setAttestations] = useState<Attestation[]>([])

  // Load data only when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setAttestations(generateMockAttestations(agentId, 10)) // Reduced from 20 to 10
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [agentId])

  // Filter attestations
  const filteredAttestations = useMemo(() => {
    switch (filter) {
      case 'positive':
        return attestations.filter(a =>
          ['trusts', 'verified_by', 'vouches_for'].includes(a.predicate)
        )
      case 'negative':
        return attestations.filter(a =>
          ['distrusts'].includes(a.predicate)
        )
      case 'reports':
        return attestations.filter(a =>
          a.predicate.startsWith('reported_')
        )
      default:
        return attestations
    }
  }, [attestations, filter])

  // Calculate stats
  const stats = useMemo(() => {
    const positive = attestations.filter(a =>
      ['trusts', 'verified_by', 'vouches_for'].includes(a.predicate)
    )
    const negative = attestations.filter(a =>
      ['distrusts'].includes(a.predicate)
    )
    const reports = attestations.filter(a =>
      a.predicate.startsWith('reported_')
    )

    return {
      total: attestations.length,
      positive: positive.length,
      negative: negative.length,
      reports: reports.length,
    }
  }, [attestations])

  const filterOptions: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'positive', label: 'Positive', count: stats.positive },
    { value: 'negative', label: 'Negative', count: stats.negative },
    { value: 'reports', label: 'Reports', count: stats.reports },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton variant="rectangular" height={60} />
        <LoadingSkeleton variant="rectangular" height={100} count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold font-mono">{stats.total}</p>
            <p className="text-sm text-text-muted">Total</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold font-mono text-trust-good">{stats.positive}</p>
            <p className="text-sm text-text-muted">Positive</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold font-mono text-trust-critical">{stats.negative}</p>
            <p className="text-sm text-text-muted">Negative</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold font-mono text-trust-low">{stats.reports}</p>
            <p className="text-sm text-text-muted">Reports</p>
          </div>
        </div>

        {/* Sentiment Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-trust-good" />
              Positive Sentiment
            </span>
            <span className="flex items-center gap-1">
              Negative Sentiment
              <TrendingDown className="w-4 h-4 text-trust-critical" />
            </span>
          </div>
          <div className="h-4 bg-white/5 rounded-full overflow-hidden" suppressHydrationWarning>
            <div
              className="h-full bg-gradient-to-r from-trust-good to-trust-excellent"
              style={{
                width: `${stats.total > 0 ? (stats.positive / stats.total) * 100 : 50}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="w-5 h-5 text-text-muted" />
        <div className="flex gap-2">
          {filterOptions.map(option => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <Badge variant="secondary" size="sm" className="ml-2">
                {option.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Attestations List */}
      {filteredAttestations.length === 0 ? (
        <EmptyState type="no-results" />
      ) : (
        <div className="space-y-4">
          {filteredAttestations.map((attestation, index) => (
            <AttestationCard
              key={attestation.id}
              attestation={attestation}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  )
}