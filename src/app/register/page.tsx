'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, CheckCircle, ArrowRight, Shield, Users, TrendingUp, Bot, Zap } from 'lucide-react'
import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'
import { RegisterAgentForm } from '@/components/agents/RegisterAgentForm'
import { RegisterSkillForm } from '@/components/skills/RegisterSkillForm'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/GlassCard'
import { cn } from '@/lib/cn'

type RegisterTab = 'agent' | 'skill'

export default function RegisterPage() {
  const [success, setSuccess] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<RegisterTab>('agent')

  const handleSuccess = (id: string) => {
    setAgentId(id)
    setSuccess(true)
  }

  if (success && agentId) {
    const shortId = `${agentId.slice(0, 10)}...${agentId.slice(-8)}`
    const isSkill = activeTab === 'skill'

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

              <h1 className="text-3xl font-bold mb-2">{isSkill ? 'Skill Registered!' : 'Agent Registered!'}</h1>
              <p className="text-text-secondary mb-8">
                Successfully created on the Intuition Protocol.
              </p>

              {/* ID card */}
              <div
                className="rounded-2xl p-5 mb-8 text-left"
                style={{ background: 'linear-gradient(145deg,#16191E,#1B1F26)', border: '1px solid rgba(200,150,60,0.18)' }}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-[#7A838D] mb-1.5 uppercase tracking-wider font-medium">Atom ID</p>
                    <p className="font-mono text-sm text-[#2ECC71] break-all leading-relaxed">{agentId}</p>
                  </div>
                  <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  <div className="flex gap-8">
                    <div>
                      <p className="text-xs text-[#7A838D] mb-1 uppercase tracking-wider font-medium">Status</p>
                      <p className="text-sm font-semibold text-[#2ECC71]">Active</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7A838D] mb-1 uppercase tracking-wider font-medium">Score</p>
                      <p className="text-sm font-mono font-semibold text-white">50</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7A838D] mb-1 uppercase tracking-wider font-medium">Network</p>
                      <p className="text-sm font-semibold text-[#C8963C]">Intuition Testnet</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center mb-10">
                <Link href={isSkill ? `/skills?open=${encodeURIComponent(agentId)}` : `/agents?open=${encodeURIComponent(agentId)}`}>
                  <Button size="lg">
                    {isSkill ? 'View Skill' : 'View Agent'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href={isSkill ? '/skills' : '/agents'}>
                  <Button size="lg" variant="outline">
                    {isSkill ? 'Browse Skills' : 'Browse Agents'}
                  </Button>
                </Link>
              </div>

              {/* Next Steps */}
              <div className="text-left">
                <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-[#7A838D]">Next Steps</h2>
                <div className="space-y-2.5">
                  {[
                    { icon: Shield, hex: '#C8963C', rgb: '200,150,60', title: 'Build Trust', desc: `Encourage users to Support your ${isSkill ? 'skill' : 'agent'} with tTRUST stakes` },
                    { icon: Users, hex: '#2EE6D6', rgb: '46,230,214', title: 'Engage Community', desc: 'Grow your reputation through attestations' },
                    { icon: TrendingUp, hex: '#2ECC71', rgb: '46,204,113', title: 'Monitor Score', desc: 'Track trust score, stakers and activity in Explorer' },
                  ].map((step) => (
                    <div
                      key={step.title}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: `rgba(${step.rgb},0.05)`, border: `1px solid rgba(${step.rgb},0.12)` }}
                    >
                      <step.icon className="w-4 h-4 flex-shrink-0" style={{ color: step.hex }} />
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-white">{step.title}</span>
                        <span className="text-xs text-[#7A838D] ml-2">{step.desc}</span>
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
          className="text-center mb-10"
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.06))',
              border: '1px solid rgba(200,150,60,0.35)',
              boxShadow: '0 0 32px rgba(200,150,60,0.2), 0 0 12px rgba(200,150,60,0.12)',
            }}
          >
            <Sparkles className="w-8 h-8" style={{ color: '#C8963C', filter: 'drop-shadow(0 0 8px rgba(200,150,60,0.8))' }} />
          </div>
          <h1 className="text-4xl font-bold mb-4">Register on AgentScore</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Create an on-chain identity and join the trust network.
            Build reputation through community attestations.
          </p>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex justify-center mb-10"
        >
          <div
            className="flex gap-1.5 p-1.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button
              onClick={() => setActiveTab('agent')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={activeTab === 'agent' ? {
                background: 'linear-gradient(135deg, rgba(200,150,60,0.18), rgba(200,150,60,0.08))',
                border: '1px solid rgba(200,150,60,0.4)',
                color: '#E8B84B',
                boxShadow: '0 0 16px rgba(200,150,60,0.12)',
              } : {
                border: '1px solid transparent',
                color: '#7A838D',
              }}
            >
              <Bot className="w-4 h-4" style={{ color: activeTab === 'agent' ? '#C8963C' : '#7A838D' }} />
              Agent
            </button>
            <button
              onClick={() => setActiveTab('skill')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={activeTab === 'skill' ? {
                background: 'linear-gradient(135deg, rgba(46,230,214,0.15), rgba(46,230,214,0.06))',
                border: '1px solid rgba(46,230,214,0.35)',
                color: '#2EE6D6',
                boxShadow: '0 0 16px rgba(46,230,214,0.1)',
              } : {
                border: '1px solid transparent',
                color: '#7A838D',
              }}
            >
              <Zap className="w-4 h-4" style={{ color: activeTab === 'skill' ? '#2EE6D6' : '#7A838D' }} />
              Skill
            </button>
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {[
            {
              icon: Shield,
              title: 'Build Trust',
              desc: 'Earn reputation through positive attestations from users',
              rgb: '200,150,60',
              hex: '#C8963C',
            },
            {
              icon: Users,
              title: 'Get Discovered',
              desc: activeTab === 'agent'
                ? 'Appear in agent explorer and reach more users'
                : 'Appear in skills registry and reach developers',
              rgb: '46,230,214',
              hex: '#2EE6D6',
            },
            {
              icon: TrendingUp,
              title: 'Track Performance',
              desc: 'Monitor your trust score and user feedback in real time',
              rgb: '46,204,113',
              hex: '#2ECC71',
            },
          ].map(({ icon: Icon, title, desc, rgb, hex }) => (
            <div
              key={title}
              className="text-center p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'linear-gradient(145deg, #16191E, #1B1F26)',
                border: `1px solid rgba(${rgb},0.15)`,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: `rgba(${rgb},0.1)`,
                  border: `1px solid rgba(${rgb},0.25)`,
                  boxShadow: `0 0 20px rgba(${rgb},0.15)`,
                }}
              >
                <Icon className="w-6 h-6" style={{ color: hex, filter: `drop-shadow(0 0 6px rgba(${rgb},0.6))` }} />
              </div>
              <h3 className="font-semibold mb-2 text-white">{title}</h3>
              <p className="text-sm text-[#6B7480]">{desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {activeTab === 'agent' ? (
            <RegisterAgentForm onSuccess={handleSuccess} />
          ) : (
            <RegisterSkillForm onSuccess={handleSuccess} />
          )}
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
            {' '}or browse{' '}
            <Link href="/agents" className="text-primary hover:text-primary-hover">
              agents
            </Link>
            {' '}and{' '}
            <Link href="/skills" className="text-primary hover:text-primary-hover">
              skills
            </Link>
          </p>
        </motion.div>
        </div>
      </div>
    </PageBackground>
  )
}
