'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, CheckCircle, ArrowRight, Shield, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
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
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto text-center"
          >
            {/* Success Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-24 h-24 rounded-full bg-trust-good/20 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-12 h-12 text-trust-good" />
            </motion.div>

            <h1 className="text-4xl font-bold mb-4">Agent Registered!</h1>
            <p className="text-xl text-text-secondary mb-8">
              Your agent has been successfully registered on the Intuition Protocol.
            </p>

            <GlassCard className="mb-8">
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Agent ID</dt>
                  <dd className="font-mono font-medium">{agentId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Status</dt>
                  <dd className="text-trust-good">Active</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Initial Trust Score</dt>
                  <dd className="font-mono font-medium">50</dd>
                </div>
              </dl>
            </GlassCard>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/agents/${agentId}`}>
                <Button size="lg" className="glow-blue">
                  View Agent Page
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
            <div className="mt-12 text-left">
              <h2 className="text-2xl font-semibold mb-6">Next Steps</h2>
              <div className="space-y-4">
                <GlassCard className="p-4">
                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Build Trust</p>
                      <p className="text-sm text-text-secondary">
                        Encourage users to stake $TRUST on your agent
                      </p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex gap-3">
                    <Users className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Engage Community</p>
                      <p className="text-sm text-text-secondary">
                        Respond to feedback and improve your agent
                      </p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex gap-3">
                    <TrendingUp className="w-5 h-5 text-trust-good flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Monitor Score</p>
                      <p className="text-sm text-text-secondary">
                        Track your trust score and attestations
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Background decoration */}
      <div className="absolute inset-0 mesh-gradient opacity-20 pointer-events-none" />

      <div className="container relative">
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
  )
}