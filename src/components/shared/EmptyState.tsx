'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Search, UserPlus, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  type: 'no-results' | 'no-agents' | 'filtered'
  onClearFilters?: () => void
}

export function EmptyState({ type, onClearFilters }: EmptyStateProps) {
  const configs = {
    'no-results': {
      icon: Search,
      title: 'No agents found',
      description: 'Try adjusting your search terms or filters',
      action: onClearFilters && (
        <Button onClick={onClearFilters} variant="outline">
          Clear Filters
        </Button>
      ),
    },
    'no-agents': {
      icon: UserPlus,
      title: 'No agents yet',
      description: 'Be the first to register an AI agent on AgentScore',
      action: (
        <Link href="/register">
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Register First Agent
          </Button>
        </Link>
      ),
    },
    'filtered': {
      icon: Filter,
      title: 'No agents match filters',
      description: 'Try removing some filters to see more results',
      action: onClearFilters && (
        <Button onClick={onClearFilters} variant="outline">
          Clear All Filters
        </Button>
      ),
    },
  }

  const config = configs[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      {/* Icon */}
      <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-6">
        <config.icon className="w-10 h-10 text-text-muted" />
      </div>

      {/* Text */}
      <h3 className="text-2xl font-semibold mb-2">{config.title}</h3>
      <p className="text-text-secondary mb-8 max-w-md">{config.description}</p>

      {/* Action */}
      {config.action}

      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>
    </motion.div>
  )
}