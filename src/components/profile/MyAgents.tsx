'use client'

import { motion } from 'framer-motion'
import { Shield, Users, TrendingUp, ExternalLink, Plus } from 'lucide-react'
import Link from 'next/link'
import type { RegisteredAgent } from '@/types/user'
import { cn } from '@/lib/cn'

interface MyAgentsProps {
  agents: RegisteredAgent[]
}

function formatShares(raw: string): string {
  const val = Number(BigInt(raw || '0')) / 1e18
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  if (val >= 1) return val.toFixed(2)
  if (val > 0) return val.toFixed(4)
  return '0'
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function agentDisplayName(label: string): string {
  return label.replace(/^Agent:\s*/i, '')
}

export function MyAgents({ agents }: MyAgentsProps) {
  if (!agents || agents.length === 0) {
    return (
      <div className="glass-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Shield className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Agents Yet</h3>
          <p className="text-slate-400 max-w-md">
            You haven't registered any agents yet. Register your first agent to start building trust and reputation.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Agent
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-400">{agents.length} agent{agents.length > 1 ? 's' : ''} registered</p>
        <Link
          href="/register"
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Register New
        </Link>
      </div>

      {agents.map((agent, i) => (
        <motion.div
          key={agent.termId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link href={`/agents?open=${encodeURIComponent(agent.termId)}`}>
            <div className="glass-card p-5 hover:bg-white/[0.06] transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent-cyan/30 flex items-center justify-center text-xl shrink-0">
                  {agent.emoji || '🤖'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold truncate">{agentDisplayName(agent.label)}</h4>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registered {timeAgo(agent.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-right shrink-0">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {agent.stakers}
                    </div>
                    <p className="text-[10px] text-slate-500">stakers</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {formatShares(agent.totalStaked)}
                    </div>
                    <p className="text-[10px] text-slate-500">tTRUST</p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
