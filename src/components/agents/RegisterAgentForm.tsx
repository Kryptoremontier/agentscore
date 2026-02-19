'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Wallet, Shield, Info, Check, ChevronRight, Sparkles
} from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { cn } from '@/lib/cn'
import type { AgentPlatform, VerificationLevel } from '@/types/agent'

interface RegisterAgentFormProps {
  onSuccess?: (agentId: string) => void
}

const platforms: { value: AgentPlatform; label: string; description: string }[] = [
  { value: 'moltbook', label: 'Moltbook', description: 'AI agent marketplace' },
  { value: 'openclaw', label: 'OpenClaw', description: 'Open source AI agents' },
  { value: 'farcaster', label: 'Farcaster', description: 'Decentralized social' },
  { value: 'twitter', label: 'Twitter', description: 'X platform bots' },
  { value: 'custom', label: 'Custom', description: 'Self-hosted or other' },
]

const steps = [
  { id: 'basic', label: 'Basic Info', icon: FileText },
  { id: 'platform', label: 'Platform', icon: Shield },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'review', label: 'Review', icon: Check },
]

export function RegisterAgentForm({ onSuccess }: RegisterAgentFormProps) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [atomId, setAtomId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '',
    platform: '' as AgentPlatform,
    walletAddress: '',
    verificationLevel: 'none' as VerificationLevel,
    tags: [] as string[],
    website: '',
    documentation: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateStep = () => {
    const newErrors: Record<string, string> = {}

    switch (currentStep) {
      case 0: // Basic Info
        if (!formData["name"]) newErrors["name"] = 'Agent name is required'
        if (formData["name"] && formData["name"].length < 3) newErrors["name"] = 'Name must be at least 3 characters'
        if (!formData["description"]) newErrors["description"] = 'Description is required'
        if (formData["description"] && formData["description"].length < 20) newErrors["description"] = 'Description must be at least 20 characters'
        break
      case 1: // Platform
        if (!formData["platform"]) newErrors["platform"] = 'Please select a platform'
        break
      case 2: // Wallet
        if (formData["walletAddress"] && !formData["walletAddress"].match(/^0x[a-fA-F0-9]{40}$/)) {
          newErrors["walletAddress"] = 'Invalid wallet address'
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    if (!validateStep()) return
    if (!walletClient || !publicClient || !isConnected) {
      setError('Please connect your wallet first')
      return
    }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const { createWriteConfig, createAgentAtom } = await import('@/lib/intuition')
      const config = createWriteConfig(walletClient, publicClient)

      const result = await createAgentAtom(config, {
        name: formData.name,
        description: formData.description,
        category: formData.platform || 'general',
        website: formData.website || undefined,
        tags: formData.tags,
      })

      setTxHash(result.transactionHash)
      setAtomId(result.state.termId)

      // Pass the atom ID (termId) to parent
      onSuccess?.(result.state.termId)

    } catch (e: any) {
      setError(e.message || 'Failed to register agent')
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-4">Tell us about your agent</h3>

            {/* Avatar */}
            <div className="flex items-center gap-6 mb-6">
              <AgentAvatar
                avatar={formData["avatar"]}
                name={formData["name"] || 'Agent'}
                size="xl"
                editable
                onAvatarChange={async (avatarUrl) => {
                  setFormData({ ...formData, avatar: avatarUrl })
                }}
              />
              <div className="flex-1">
                <p className="font-medium mb-1">Agent Avatar</p>
                <p className="text-sm text-text-muted">
                  Click on the avatar to upload an image. Recommended size: 512x512px
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Agent Name <span className="text-trust-critical">*</span>
              </label>
              <input
                type="text"
                value={formData["name"]}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., CodeHelper AI"
                className={cn(
                  "w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none",
                  errors["name"] && "ring-2 ring-trust-critical"
                )}
              />
              {errors["name"] && (
                <p className="text-sm text-trust-critical">{errors["name"]}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Description <span className="text-trust-critical">*</span>
              </label>
              <textarea
                value={formData["description"]}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what your agent does, its capabilities, and use cases..."
                className={cn(
                  "w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none resize-none",
                  errors["description"] && "ring-2 ring-trust-critical"
                )}
                rows={4}
              />
              {errors["description"] && (
                <p className="text-sm text-trust-critical">{errors["description"]}</p>
              )}
              <p className="text-xs text-text-muted">
                {formData["description"].length}/500 characters
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Tags (select up to 3)
              </label>
              <div className="flex flex-wrap gap-2">
                {['Coding', 'Research', 'Trading', 'Art', 'Writing', 'Gaming', 'Education', 'Assistant'].map(tag => (
                  <Badge
                    key={tag}
                    variant={formData["tags"].includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (formData["tags"].includes(tag)) {
                        setFormData({
                          ...formData,
                          tags: formData["tags"].filter(t => t !== tag)
                        })
                      } else if (formData["tags"].length < 3) {
                        setFormData({
                          ...formData,
                          tags: [...formData["tags"], tag]
                        })
                      }
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )

      case 1: // Platform
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-4">Where is your agent hosted?</h3>

            <div className="grid gap-3">
              {platforms.map(platform => (
                <button
                  key={platform.value}
                  onClick={() => setFormData({ ...formData, platform: platform.value })}
                  className={cn(
                    'glass rounded-lg p-4 text-left transition-all',
                    formData["platform"] === platform.value ? 'ring-2 ring-primary' : 'hover:bg-white/10'
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="block">
                      <span className="font-medium block">{platform.label}</span>
                      <span className="text-sm text-text-secondary block">{platform.description}</span>
                    </span>
                    {formData["platform"] === platform.value && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </span>
                </button>
              ))}
            </div>
            {errors["platform"] && (
              <p className="text-sm text-trust-critical">{errors["platform"]}</p>
            )}

            {/* Additional Links */}
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Website / Landing Page (optional)
                </label>
                <input
                  type="url"
                  value={formData["website"]}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://your-agent-website.com"
                  className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Documentation (optional)
                </label>
                <input
                  type="url"
                  value={formData["documentation"]}
                  onChange={(e) => setFormData({ ...formData, documentation: e.target.value })}
                  placeholder="https://docs.your-agent.com"
                  className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </motion.div>
        )

      case 2: // Wallet
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-4">Connect agent wallet (optional)</h3>

            <div className="glass rounded-lg p-4 mb-6 flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p>Connecting a wallet enables:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Higher verification level</li>
                  <li>Direct attestation rewards</li>
                  <li>On-chain identity verification</li>
                </ul>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Agent Wallet Address
              </label>
              <input
                type="text"
                value={formData["walletAddress"]}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                placeholder="0x..."
                className={cn(
                  "w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none font-mono",
                  errors["walletAddress"] && "ring-2 ring-trust-critical"
                )}
              />
              {errors["walletAddress"] && (
                <p className="text-sm text-trust-critical">{errors["walletAddress"]}</p>
              )}
            </div>

            {/* Verification Options */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Verification Options</p>

              <button className="w-full glass rounded-lg p-4 text-left hover:bg-white/10 transition-all">
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-trust-good" />
                    <span className="flex flex-col">
                      <span className="font-medium">Sign Message</span>
                      <span className="text-sm text-text-secondary">Prove wallet ownership</span>
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-text-muted" />
                </span>
              </button>

              <button className="w-full glass rounded-lg p-4 text-left hover:bg-white/10 transition-all opacity-50 cursor-not-allowed">
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-trust-excellent" />
                    <span className="flex flex-col">
                      <span className="font-medium">KYC Verification</span>
                      <span className="text-sm text-text-secondary">Coming soon</span>
                    </span>
                  </span>
                  <Badge variant="outline" size="sm">Soon</Badge>
                </span>
              </button>
            </div>
          </motion.div>
        )

      case 3: // Review
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-4">Review your agent details</h3>

            <div className="space-y-4">
              {/* Avatar Preview */}
              {formData["avatar"] && (
                <div className="glass rounded-lg p-4 flex items-center gap-4">
                  <AgentAvatar
                    avatar={formData["avatar"]}
                    name={formData["name"]}
                    size="lg"
                  />
                  <div>
                    <h4 className="font-medium">Agent Avatar</h4>
                    <p className="text-sm text-text-muted">Avatar uploaded</p>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="glass rounded-lg p-4">
                <h4 className="font-medium mb-3 text-text-secondary">Basic Information</h4>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-text-muted">Name</dt>
                    <dd className="font-medium">{formData["name"]}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-text-muted">Platform</dt>
                    <dd className="font-medium">{formData["platform"]}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-text-muted">Tags</dt>
                    <dd>
                      <div className="flex gap-1">
                        {formData["tags"].map(tag => (
                          <Badge key={tag} variant="outline" size="sm">{tag}</Badge>
                        ))}
                      </div>
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Description */}
              <div className="glass rounded-lg p-4">
                <h4 className="font-medium mb-3 text-text-secondary">Description</h4>
                <p className="text-sm">{formData["description"]}</p>
              </div>

              {/* Wallet */}
              {formData["walletAddress"] && (
                <div className="glass rounded-lg p-4">
                  <h4 className="font-medium mb-3 text-text-secondary">Wallet</h4>
                  <p className="font-mono text-sm">{formData["walletAddress"]}</p>
                </div>
              )}

              {/* Registration Fee */}
              <div className="glass rounded-lg p-4 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Registration Fee</p>
                    <p className="text-sm text-text-muted">One-time Atom creation</p>
                  </div>
                  <p className="text-2xl font-bold font-mono">0.01 tTRUST</p>
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" />
                <p className="text-sm text-text-secondary">
                  I confirm that this agent complies with AgentScore guidelines and I understand
                  that malicious agents may be delisted and stakes slashed.
                </p>
              </div>
            </div>
          </motion.div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index === currentStep
          const isComplete = index < currentStep

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isActive && 'bg-primary text-white',
                  isComplete && 'bg-trust-good text-white',
                  !isActive && !isComplete && 'glass'
                )}>
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={cn(
                  'ml-3 text-sm font-medium hidden sm:inline',
                  isActive && 'text-text-primary',
                  !isActive && 'text-text-muted'
                )}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  'flex-1 h-px mx-4',
                  isComplete ? 'bg-trust-good' : 'bg-border'
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Form Content */}
      <div className="glass rounded-xl p-8">
        {/* Wallet Connection Warning */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 font-semibold">⚠️ Connect your wallet to register agents</p>
            <p className="text-sm text-text-secondary mt-1">
              Make sure you're on Intuition Testnet (Chain ID: 13579)
            </p>
          </div>
        )}

        {/* Success State */}
        {txHash && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 font-bold">✅ Agent registered on-chain!</p>
            <p className="text-sm text-text-secondary mt-1">Redirecting to explorer...</p>

            {atomId && (
              <div className="bg-[#111318] border border-[#1e2028] rounded-lg p-3 mt-3">
                <p className="text-xs text-[#6b7280] mb-1">Atom ID</p>
                <code className="text-[#10b981] text-xs font-mono break-all block leading-relaxed">
                  {atomId}
                </code>
              </div>
            )}

            <a
              href={`https://testnet.explorer.intuition.systems/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-cyan hover:underline mt-2 block"
            >
              View transaction →
            </a>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 font-bold">❌ Error:</p>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {renderStepContent()}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={loading}
            >
              Back
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isConnected || loading}
              className="flex-1 glow-blue"
            >
              {!isConnected ? (
                '🔌 Connect Wallet First'
              ) : loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ⏳ Registering on-chain...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  🚀 Register Agent
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}