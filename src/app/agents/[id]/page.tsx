'use client'

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
import { Button } from '@/components/ui/button'
import { PageHeaderSkeleton, LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { Agent } from '@/types/agent'
import type { AgentDetailApiItem } from '@/lib/api-data'

// Convert API response to Agent type
function apiToAgent(apiAgent: AgentDetailApiItem): Agent {
  return {
    id: apiAgent.id,
    atomId: apiAgent.id,
    name: apiAgent.name,
    description: '', // Will be populated from agent card data if available
    platform: 'intuition',
    walletAddress: '0x0000000000000000000000000000000000000000',
    createdAt: new Date(apiAgent.createdAt),
    verificationLevel: 'wallet',
    owner: {
      address: '0x0000000000000000000000000000000000000000',
      name: 'Agent Owner',
      expertLevel: 'intermediate' as const,
    },
    trustScore: Math.round(apiAgent.score.objectScore ?? apiAgent.score.trustScore),
    positiveStake: BigInt(Math.round(apiAgent.supportStake * 1e18)),
    negativeStake: BigInt(Math.round(apiAgent.opposeStake * 1e18)),
    attestationCount: 0,
    reportCount: 0,
    stakerCount: apiAgent.stakerCount,
  }
}

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params['id'] as string
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAgent() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/v1/agents/${agentId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Agent not found')
          }
          throw new Error('Failed to load agent')
        }

        const data = await response.json()
        
        if (cancelled) return

        if (data.success && data.data) {
          setAgent(apiToAgent(data.data))
        } else {
          throw new Error('Invalid response format')
        }
      } catch (err) {
        if (cancelled) return
        console.error('Error fetching agent:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAgent()

    return () => {
      cancelled = true
    }
  }, [agentId])

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    // TODO: Show toast notification
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

  return (
    <PageBackground image="hero" opacity={0.35}>
      <div className="pt-24 pb-16">
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

        {/* Content */}
        <div className="space-y-6">
          {/* Header */}
          <AgentHeader agent={agent} />

          {/* Trust Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TrustButton agentId={agent.id} />
          </motion.div>

          {/* Stats */}
          <AgentStats agent={agent} />

          {/* Tabs */}
          <AgentTabs agent={agent} />
        </div>

        {/* Related Agents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16"
        >
          <h2 className="text-2xl font-bold mb-6">Similar Agents</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* TODO: Add related agent cards */}
            <div className="glass rounded-xl p-6 text-center text-text-muted">
              Coming soon...
            </div>
            <div className="glass rounded-xl p-6 text-center text-text-muted">
              Coming soon...
            </div>
            <div className="glass rounded-xl p-6 text-center text-text-muted">
              Coming soon...
            </div>
          </div>
        </motion.div>
        </div>
      </div>
    </PageBackground>
  )
}