'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AgentCard } from '@/components/agents/AgentCard'
import type { Agent } from '@/types/agent'

interface AgentGridOptimizedProps {
  agents: Agent[]
  loading?: boolean
}

const BATCH_SIZE = 12 // Load 12 agents at a time

export function AgentGridOptimized({ agents, loading = false }: AgentGridOptimizedProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loadMoreRef.current || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < agents.length) {
          // Load more agents when user scrolls near the bottom
          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, agents.length))
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [agents.length, visibleCount, loading])

  if (loading) {
    return <AgentGridSkeleton />
  }

  if (agents.length === 0) {
    return null
  }

  const visibleAgents = agents.slice(0, visibleCount)

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleAgents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index < BATCH_SIZE ? index * 0.05 : 0,
              duration: 0.3
            }}
          >
            <AgentCard agent={agent} />
          </motion.div>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {visibleCount < agents.length && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center" suppressHydrationWarning>
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
          </div>
        </div>
      )}
    </>
  )
}

function AgentGridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="glass rounded-xl p-5 space-y-4 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-white/10 rounded" />
                <div className="h-4 w-20 bg-white/10 rounded" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="h-4 w-16 bg-white/10 rounded" />
              <div className="h-5 w-24 bg-white/10 rounded" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-16 bg-white/10 rounded" />
              <div className="h-5 w-20 bg-white/10 rounded" />
            </div>
          </div>

          {/* Actions Skeleton */}
          <div className="flex gap-2">
            <div className="h-9 flex-1 bg-white/10 rounded" />
            <div className="h-9 w-20 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}