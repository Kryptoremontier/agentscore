'use client'

import { TrendingUp } from 'lucide-react'
import type { AgentSupport } from '@/types/user'

interface MySupportedAgentsProps {
  supports: AgentSupport[]
}

export function MySupportedAgents({ supports: _supports }: MySupportedAgentsProps) {
  return (
    <div className="glass-card p-8">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Not Supporting Any Agents</h3>
        <p className="text-slate-400 max-w-md">
          Browse agents and stake $TRUST to support them and earn rewards from their success.
        </p>
        <a
          href="/agents"
          className="mt-6 px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl font-medium transition-colors"
        >
          Explore Agents
        </a>
      </div>
    </div>
  )
}
