'use client'

import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { FileText, Shield, Activity } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { Agent } from '@/types/agent'

// Lazy load heavy tab content
const AttestationList = lazy(() =>
  import('@/components/attestations/AttestationList').then(mod => ({
    default: mod.AttestationList
  }))
)

const ActivityFeed = lazy(() =>
  import('@/components/attestations/ActivityFeed').then(mod => ({
    default: mod.ActivityFeed
  }))
)

interface AgentTabsProps {
  agent: Agent
}

export function AgentTabs({ agent }: AgentTabsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full lg:w-auto">
          <TabsTrigger value="overview" className="flex-1 lg:flex-initial">
            <FileText className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attestations" className="flex-1 lg:flex-initial">
            <Shield className="w-4 h-4 mr-2" />
            Attestations
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 lg:flex-initial">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* About Section */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">About This Agent</h3>
            <div className="space-y-4 text-text-secondary">
              <p>
                {agent.description || 'No description provided for this agent.'}
              </p>

              <div className="grid sm:grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm text-text-muted mb-1">Platform</p>
                  <p className="font-medium text-text-primary capitalize">{agent.platform}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Verification Level</p>
                  <p className="font-medium text-text-primary capitalize">{agent.verificationLevel}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">First Seen</p>
                  <p className="font-medium text-text-primary">
                    {agent.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Last Active</p>
                  <p className="font-medium text-text-primary">2 hours ago</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">Tags & Categories</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm">
                AI Agent
              </span>
              <span className="px-3 py-1.5 rounded-full bg-accent-cyan/20 text-accent-cyan text-sm">
                Coding Assistant
              </span>
              <span className="px-3 py-1.5 rounded-full bg-accent-purple/20 text-accent-purple text-sm">
                Open Source
              </span>
            </div>
          </div>

          {/* Capabilities Section */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">Capabilities</h3>
            <ul className="space-y-2 text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-trust-good mt-1">✓</span>
                <span>Code generation and debugging assistance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-trust-good mt-1">✓</span>
                <span>Multiple programming language support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-trust-good mt-1">✓</span>
                <span>API integration and documentation</span>
              </li>
            </ul>
          </div>
        </TabsContent>

        {/* Attestations Tab */}
        <TabsContent value="attestations">
          <Suspense fallback={<LoadingSkeleton className="min-h-[400px]" />}>
            <AttestationList agentId={agent.id} />
          </Suspense>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Suspense fallback={<LoadingSkeleton className="min-h-[400px]" />}>
            <ActivityFeed agentId={agent.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}