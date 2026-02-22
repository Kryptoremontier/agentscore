'use client'

import { motion } from 'framer-motion'
import { TrendingUp, ThumbsUp, ShieldAlert, ExternalLink, Search } from 'lucide-react'
import Link from 'next/link'
import type { AgentSupport } from '@/types/user'
import { cn } from '@/lib/cn'

interface MySupportedAgentsProps {
  supports: AgentSupport[]
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

export function MySupportedAgents({ supports }: MySupportedAgentsProps) {
  if (!supports || supports.length === 0) {
    return (
      <div className="glass-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
            <TrendingUp className="w-10 h-10 text-emerald-400/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Not Supporting Any Agents</h3>
          <p className="text-slate-400 max-w-md">
            Browse agents and stake tTRUST to support or oppose them. Your positions will appear here.
          </p>
          <Link
            href="/agents"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl font-medium transition-colors"
          >
            <Search className="w-4 h-4" />
            Explore Agents
          </Link>
        </div>
      </div>
    )
  }

  const forPositions = supports.filter(s => s.side === 'for')
  const againstPositions = supports.filter(s => s.side === 'against')

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold font-mono">{supports.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Positions</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">{forPositions.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Supporting</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-rose-400">{againstPositions.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Opposing</div>
        </div>
      </div>

      {/* Positions */}
      {supports.map((pos, i) => (
        <motion.div
          key={`${pos.agentTermId}-${pos.side}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Link href={`/agents?open=${encodeURIComponent(pos.agentTermId)}`}>
            <div className="glass-card p-5 hover:bg-white/[0.06] transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                  pos.side === 'for'
                    ? 'bg-emerald-500/15'
                    : 'bg-rose-500/15'
                )}>
                  {pos.side === 'for'
                    ? <ThumbsUp className="w-5 h-5 text-emerald-400" />
                    : <ShieldAlert className="w-5 h-5 text-rose-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{pos.agentEmoji || '🤖'}</span>
                    <h4 className="font-semibold truncate">{agentDisplayName(pos.agentLabel)}</h4>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      pos.side === 'for'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    )}>
                      {pos.side === 'for' ? 'SUPPORT' : 'OPPOSE'}
                    </span>
                    <span className="text-xs text-slate-500">{timeAgo(pos.updatedAt)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={cn(
                    'text-sm font-bold font-mono',
                    pos.side === 'for' ? 'text-emerald-400' : 'text-rose-400'
                  )}>
                    {formatShares(pos.shares)}
                  </div>
                  <p className="text-[10px] text-slate-500">tTRUST shares</p>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
