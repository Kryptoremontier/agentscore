'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, CheckCircle, ArrowRight, Shield, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { RegisterAgentForm } from '@/components/agents/RegisterAgentForm'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/GlassCard'

export default function RegisterPage() {
  const [success, setSuccess] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)

  const handleSuccess = (id: string) => {
    setAgentId(id)
    setSuccess(true)
  }

  if (success && agentId) {
    const shortId = `${agentId.slice(0, 10)}...${agentId.slice(-8)}`

    return (
      <PageBackground image="diagonal" opacity={0.3}>
        <div className="pt-28 pb-16">
          <div className="container max-w-xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              {/* Success Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-trust-good/20 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-trust-good" />
              </motion.div>

              <h1 className="text-3xl font-bold mb-2">Agent Registered!</h1>
              <p className="text-text-secondary mb-8">
                Successfully created on the Intuition Protocol.
              </p>

              {/* Agent ID card */}
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 mb-8 text-left">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-[#6b7280] mb-1.5">Atom ID</p>
                    <p className="font-mono text-sm text-emerald-400 break-all leading-relaxed">{agentId}</p>
                  </div>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-xs text-[#6b7280] mb-1">Status</p>
                      <p className="text-sm font-medium text-trust-good">Active</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6b7280] mb-1">Initial Score</p>
                      <p className="text-sm font-mono font-medium">50</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6b7280] mb-1">Network</p>
                      <p className="text-sm font-medium text-primary">Testnet</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center mb-10">
                <Link href={`/agents?open=${encodeURIComponent(agentId)}`}>
                  <Button size="lg" className="glow-blue">
                    View Agent
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/agents">
                  <Button size="lg" variant="outline">
                    Browse Agents
                  </Button>
                </Link>
              </div>

              {/* Next Steps */}
              <div className="text-left">
                <h2 className="text-lg font-semibold mb-4 text-[#8b949e]">Next Steps</h2>
                <div className="space-y-3">
                  {[
                    { icon: Shield, color: 'text-primary', title: 'Build Trust', desc: 'Encourage users to Support your agent with tTRUST stakes' },
                    { icon: Users, color: 'text-accent-cyan', title: 'Engage Community', desc: 'Grow your agent\'s reputation through attestations' },
                    { icon: TrendingUp, color: 'text-trust-good', title: 'Monitor Score', desc: 'Track trust score, stakers and activity in Explorer' },
                  ].map((step) => (
                    <div key={step.title} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-4 py-3 border border-white/5">
                      <step.icon className={`w-4 h-4 ${step.color} flex-shrink-0`} />
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{step.title}</span>
                        <span className="text-xs text-[#6b7280] ml-2">{step.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </PageBackground>
    )
  }

  return (
    <PageBackground image="diagonal" opacity={0.3}>
      <div className="pt-24 pb-16">
        <div className="container">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent-cyan mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Register Your AI Agent</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Create an on-chain identity for your agent and join the trust network.
            Build reputation through community attestations.
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          <GlassCard className="text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Build Trust</h3>
            <p className="text-sm text-text-secondary">
              Earn reputation through positive attestations from users
            </p>
          </GlassCard>

          <GlassCard className="text-center">
            <div className="w-12 h-12 rounded-lg bg-accent-cyan/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-accent-cyan" />
            </div>
            <h3 className="font-semibold mb-2">Get Discovered</h3>
            <p className="text-sm text-text-secondary">
              Appear in agent explorer and reach more users
            </p>
          </GlassCard>

          <GlassCard className="text-center">
            <div className="w-12 h-12 rounded-lg bg-trust-good/20 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-trust-good" />
            </div>
            <h3 className="font-semibold mb-2">Track Performance</h3>
            <p className="text-sm text-text-secondary">
              Monitor your trust score and user feedback
            </p>
          </GlassCard>
        </motion.div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <RegisterAgentForm onSuccess={handleSuccess} />
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-16 text-center"
        >
          <p className="text-text-secondary">
            Have questions?{' '}
            <Link href="/docs" className="text-primary hover:text-primary-hover">
              Check our documentation
            </Link>
            {' '}or{' '}
            <Link href="/agents" className="text-primary hover:text-primary-hover">
              browse existing agents
            </Link>
          </p>
        </motion.div>
        </div>
      </div>
    </PageBackground>
  )
}