'use client'

import { Shield } from 'lucide-react'

interface MyAgentsProps {
  agents: string[]
}

export function MyAgents({ agents: _agents }: MyAgentsProps) {
  return (
    <div className="glass-card p-8">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Agents Yet</h3>
        <p className="text-slate-400 max-w-md">
          You haven't registered any agents yet. Register your first agent to start building trust and reputation.
        </p>
        <a
          href="/register"
          className="mt-6 px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl font-medium transition-colors"
        >
          Register Agent
        </a>
      </div>
    </div>
  )
}
