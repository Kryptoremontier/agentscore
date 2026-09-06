'use client'

/**
 * AgentTabs — /agents/[id] tab strip. ETAP 3: the Attestations tab now
 * renders REAL attesters (canonical unit) and backers (own-vault positions)
 * instead of the former generateMockAttestations fixture; the Overview tab
 * no longer hardcodes tags/capabilities/"last active" copy (thesis §6/§9 —
 * no fabricated profile content).
 */

import { motion } from 'framer-motion'
import { FileText, Shield } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AttestersAndBackers } from '@/components/profile/AttestersAndBackers'
import type { Agent } from '@/types/agent'
import type { AttesterSummary, Backer } from '@/lib/agent-profile'

// The former Activity tab rendered generateMockActivities (fabricated
// wallets/amounts/timestamps) — retired. The /agents modal's Activity tab
// reads real signals; a real feed here is a separate task.

interface AgentTabsProps {
  agent: Agent
  attesters: AttesterSummary[]
  backers: Backer[]
  profileLoading: boolean
  /** Count of pre-canonical skill claims (hasAgentSkill / isTrustedFor) — surfaced, not hidden. */
  legacySkillClaimCount?: number
}

export function AgentTabs({ agent, attesters, backers, profileLoading, legacySkillClaimCount = 0 }: AgentTabsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Tabs defaultValue="attestations" className="w-full">
        <TabsList className="w-full lg:w-auto">
          <TabsTrigger value="attestations" className="flex-1 lg:flex-initial">
            <Shield className="w-4 h-4 mr-2" />
            Attesters &amp; Backers
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 lg:flex-initial">
            <FileText className="w-4 h-4 mr-2" />
            About
          </TabsTrigger>
        </TabsList>

        {/* Attesters (canonical) + Backers (own vault) — separate claims, separate lists */}
        <TabsContent value="attestations">
          <div className="glass rounded-xl p-6">
            <AttestersAndBackers attesters={attesters} backers={backers} loading={profileLoading} />
          </div>
        </TabsContent>

        {/* About — only what is actually known about the atom */}
        <TabsContent value="overview" className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">About This Agent</h3>
            <div className="space-y-4 text-text-secondary">
              <p>{agent.description || 'No description provided for this agent.'}</p>
              <div className="grid sm:grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm text-text-muted mb-1">Platform</p>
                  <p className="font-medium text-text-primary capitalize">{agent.platform}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">First Seen</p>
                  <p className="font-medium text-text-primary">{agent.createdAt.toLocaleDateString()}</p>
                </div>
              </div>
              {legacySkillClaimCount > 0 && (
                <p className="text-xs text-text-muted pt-2 border-t border-white/10">
                  {legacySkillClaimCount} legacy skill claim{legacySkillClaimCount !== 1 ? 's' : ''} on-chain
                  (pre-canonical <code className="font-mono">hasAgentSkill</code> predicate, free-text objects) — counted here, not shown as attestations.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
