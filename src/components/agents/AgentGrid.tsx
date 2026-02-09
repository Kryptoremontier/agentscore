'use client'

import { motion } from 'framer-motion'
import { AgentCard } from '@/components/agents/AgentCard'
import type { Agent } from '@/types/agent'

interface AgentGridProps {
  agents: Agent[]
  loading?: boolean
}

export function AgentGrid({ agents, loading = false }: AgentGridProps) {
  if (loading) {
    return <AgentGridSkeleton />
  }

  if (agents.length === 0) {
    return null // Empty state will be handled by parent
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {agents.map((agent, index) => (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <AgentCard agent={agent} />
        </motion.div>
      ))}
    </div>
  )
}

function AgentGridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="glass rounded-xl p-5 space-y-4">
          {/* Header Skeleton */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 shimmer" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-white/10 rounded shimmer" />
                <div className="h-4 w-20 bg-white/10 rounded shimmer" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 shimmer" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="h-4 w-16 bg-white/10 rounded shimmer" />
              <div className="h-5 w-24 bg-white/10 rounded shimmer" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-16 bg-white/10 rounded shimmer" />
              <div className="h-5 w-20 bg-white/10 rounded shimmer" />
            </div>
          </div>

          {/* Actions Skeleton */}
          <div className="flex gap-2">
            <div className="h-9 flex-1 bg-white/10 rounded shimmer" />
            <div className="h-9 w-20 bg-white/10 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}