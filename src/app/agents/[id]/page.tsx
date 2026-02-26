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
import { agentIdToAtomId } from '@/lib/utils'
import type { Agent } from '@/types/agent'

// Mock data - replace with real data fetching
const getMockAgent = (id: string): Agent => ({
  id,
  atomId: agentIdToAtomId(id), // Use consistent hash function
  name: `CodeHelper AI ${id}`,
  description: 'An advanced AI assistant specialized in helping developers write better code, debug issues, and learn new programming concepts. Supports multiple programming languages and frameworks.',
  platform: 'mcp',
  walletAddress: '0x1234567890123456789012345678901234567890',
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  verificationLevel: 'wallet',
  owner: {
    address: '0x1234567890123456789012345678901234567890',
    name: 'AI Developer',
    expertLevel: 'expert' as const,
  },
  trustScore: 85,
  positiveStake: BigInt(250000 * 1e18),
  negativeStake: BigInt(15000 * 1e18),
  attestationCount: 342,
  reportCount: 5,
  stakerCount: 127,
})

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params['id'] as string
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<Agent | null>(null)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setAgent(getMockAgent(agentId))
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
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

  if (!agent) {
    return (
      <PageBackground image="hero" opacity={0.35}>
        <div className="pt-24 pb-16">
          <div className="container">
            <p>Agent not found</p>
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