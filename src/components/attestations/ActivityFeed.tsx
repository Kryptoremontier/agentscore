'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle,
  UserPlus, Shield, Activity, Clock
} from 'lucide-react'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { cn } from '@/lib/cn'

interface ActivityFeedProps {
  agentId: string
}

type ActivityType =
  | 'trust_added'
  | 'distrust_added'
  | 'report_filed'
  | 'verification_achieved'
  | 'stake_increased'
  | 'agent_created'

interface Activity {
  id: string
  type: ActivityType
  actor: {
    address: string
    name?: string
  }
  amount?: bigint
  description: string
  timestamp: Date
}

const activityConfig: Record<ActivityType, {
  icon: any
  color: string
  bgColor: string
}> = {
  trust_added: {
    icon: ThumbsUp,
    color: 'text-trust-good',
    bgColor: 'bg-trust-good/10',
  },
  distrust_added: {
    icon: ThumbsDown,
    color: 'text-trust-critical',
    bgColor: 'bg-trust-critical/10',
  },
  report_filed: {
    icon: AlertTriangle,
    color: 'text-trust-low',
    bgColor: 'bg-trust-low/10',
  },
  verification_achieved: {
    icon: CheckCircle,
    color: 'text-trust-excellent',
    bgColor: 'bg-trust-excellent/10',
  },
  stake_increased: {
    icon: Shield,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  agent_created: {
    icon: UserPlus,
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/10',
  },
}

// Mock data generator
const generateMockActivities = (_agentId: string): Activity[] => {
  const types: ActivityType[] = [
    'trust_added', 'distrust_added', 'report_filed',
    'verification_achieved', 'stake_increased'
  ]

  const activities: Activity[] = [
    {
      id: 'activity-0',
      type: 'agent_created',
      actor: {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Agent Creator',
      },
      description: 'Agent was registered on the platform',
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    },
  ]

  // Generate random activities - reduced from 15 to 8 for better performance
  for (let i = 1; i < 8; i++) {
    const type = types[Math.floor(Math.random() * types.length)] as ActivityType
    activities.push({
      id: `activity-${i}`,
      type,
      actor: {
        address: `0x${Math.floor(Math.random() * 1e16).toString(16).padStart(40, '0')}`,
        name: Math.random() > 0.5 ? `User ${i}` : undefined,
      },
      amount: ['trust_added', 'distrust_added', 'stake_increased'].includes(type)
        ? BigInt(Math.floor(Math.random() * 1000) * 1e18)
        : undefined,
      description: getActivityDescription(type),
      timestamp: new Date(Date.now() - Math.random() * 29 * 24 * 60 * 60 * 1000),
    })
  }

  // Sort by timestamp descending
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

function getActivityDescription(type: ActivityType): string {
  switch (type) {
    case 'trust_added':
      return 'Added trust attestation'
    case 'distrust_added':
      return 'Added distrust attestation'
    case 'report_filed':
      return 'Filed a report'
    case 'verification_achieved':
      return 'Verification level upgraded'
    case 'stake_increased':
      return 'Increased stake position'
    default:
      return 'Activity recorded'
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return date.toLocaleDateString()
}

export function ActivityFeed({ agentId }: ActivityFeedProps) {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])

  // Load data only when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setActivities(generateMockActivities(agentId))
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [agentId])

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton variant="rectangular" height={80} count={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-8 bottom-0 w-px bg-border" />

        {/* Activities */}
        <div className="space-y-6">
          {activities.map((activity, index) => {
            const config = activityConfig[activity.type]
            const Icon = config.icon

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative flex gap-4"
              >
                {/* Icon */}
                <div className={cn(
                  'relative z-10 flex h-12 w-12 items-center justify-center rounded-full',
                  config.bgColor,
                  'ring-4 ring-background'
                )}>
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="glass rounded-lg p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <p className="font-medium">
                          {activity.actor.name || formatAddress(activity.actor.address)}
                        </p>
                        <p className="text-sm text-text-muted">
                          {activity.description}
                        </p>
                      </div>
                      <span className="text-sm text-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>

                    {/* Amount */}
                    {activity.amount && (
                      <p className="text-sm font-mono text-text-secondary">
                        Amount: {(Number(activity.amount) / 1e18).toFixed(2)} $TRUST
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* End marker */}
        <div className="relative flex gap-4 mt-6">
          <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-4 ring-background">
            <Activity className="w-5 h-5 text-text-muted" />
          </div>
          <div className="flex-1 pt-3">
            <p className="text-sm text-text-muted">Beginning of activity</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}