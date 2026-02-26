'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Wallet, Shield, Info, Check, ChevronRight, Sparkles, Loader2
} from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { PlatformIcon } from '@/components/agents/PlatformIcon'
import { cn } from '@/lib/cn'
import { createWriteConfig, createAgentAtom } from '@/lib/intuition'
import type { AgentPlatform, VerificationLevel } from '@/types/agent'

interface RegisterAgentFormProps {
  onSuccess?: (agentId: string) => void
}

type PlatformCategory = 'all' | 'trending' | 'web3' | 'social'

interface PlatformDef {
  value: AgentPlatform
  label: string
  description: string
  tag?: string
  tagColor?: string
  category: PlatformCategory[]
}

const PLATFORMS: PlatformDef[] = [
  { value: 'mcp', label: 'MCP Server', description: 'Model Context Protocol', tag: 'trending', tagColor: '#00ff88', category: ['trending'] },
  { value: 'openai-gpts', label: 'OpenAI GPTs', description: 'GPT Store & Actions', category: [] },
  { value: 'openclaw', label: 'OpenClaw', description: 'Open source AI agents', tag: 'trending', tagColor: '#00ff88', category: ['trending'] },
  { value: 'langchain', label: 'LangGraph Cloud', description: 'LangChain deployments', category: [] },
  { value: 'huggingface', label: 'Hugging Face', description: 'Spaces & Inference API', category: [] },
  { value: 'eliza', label: 'ElizaOS', description: 'ai16z agent framework', tag: 'web3', tagColor: '#a78bfa', category: ['web3'] },
  { value: 'virtuals', label: 'Virtuals Protocol', description: 'On-chain AI agents', tag: 'web3', tagColor: '#a78bfa', category: ['web3'] },
  { value: 'farcaster', label: 'Farcaster', description: 'Decentralized social', tag: 'social', tagColor: '#60a5fa', category: ['social'] },
  { value: 'twitter', label: 'X / Twitter', description: 'Platform bots & agents', tag: 'social', tagColor: '#60a5fa', category: ['social'] },
  { value: 'telegram', label: 'Telegram Bot', description: 'Telegram Bot API', tag: 'social', tagColor: '#60a5fa', category: ['social'] },
  { value: 'discord', label: 'Discord', description: 'Discord bot integration', tag: 'social', tagColor: '#60a5fa', category: ['social'] },
  { value: 'custom', label: 'Self-hosted/Custom', description: 'Own infrastructure', category: [] },
]

const CATEGORY_FILTERS: { value: PlatformCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'trending', label: 'Trending' },
  { value: 'web3', label: 'Web3' },
  { value: 'social', label: 'Social' },
]

const steps = [
  { id: 'basic', label: 'Basic Info', icon: FileText },
  { id: 'platform', label: 'Platform', icon: Shield },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'review', label: 'Review', icon: Check },
]

export function RegisterAgentForm({ onSuccess }: RegisterAgentFormProps) {
  const { address, isConnected, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain } = useSwitchChain()

  const isWrongChain = isConnected && chain?.id !== intuitionTestnet.id

  const promptSwitchChain = () => {
    try {
      switchChain({ chainId: intuitionTestnet.id })
    } catch {
      setError('Failed to switch network. Please switch manually to Intuition Testnet (Chain ID: 13579).')
    }
  }

  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [atomId, setAtomId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: '',
    platforms: [] as AgentPlatform[],
    walletAddress: '',
    verificationLevel: 'none' as VerificationLevel,
    tags: [] as string[],
    website: '',
    documentation: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [platformFilter, setPlatformFilter] = useState<PlatformCategory>('all')
  const [walletSigning, setWalletSigning] = useState(false)
  const [walletSigned, setWalletSigned] = useState(false)
  const [signatureHash, setSignatureHash] = useState<string | null>(null)

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
        if (formData["platforms"].length === 0) newErrors["platform"] = 'Please select at least one platform'
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

  const handleSignMessage = async () => {
    if (!isConnected) {
      setError('Connect your wallet first to sign a message')
      return
    }
    if (isWrongChain) {
      await promptSwitchChain()
      return
    }
    if (!walletClient) {
      promptSwitchChain()
      return
    }

    const walletAddr = formData.walletAddress || address
    if (!walletAddr) {
      setError('Enter a wallet address first')
      return
    }

    setWalletSigning(true)
    setError(null)

    try {
      const message = `I verify ownership of wallet ${walletAddr} for AgentScore agent registration.\n\nTimestamp: ${new Date().toISOString()}`
      const signature = await walletClient.signMessage({
        message,
        account: walletClient.account!,
      })

      setSignatureHash(signature)
      setWalletSigned(true)
      setFormData(prev => ({ ...prev, verificationLevel: 'signed' as VerificationLevel }))
    } catch (e: any) {
      if (e.message?.includes('rejected') || e.message?.includes('denied')) {
        setError('Signing was cancelled')
      } else {
        setError(e.message || 'Failed to sign message')
      }
    } finally {
      setWalletSigning(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) return
    if (!isConnected) {
      setError('Please connect your wallet first')
      return
    }
    if (isWrongChain) {
      await promptSwitchChain()
      return
    }
    if (!walletClient || !publicClient) {
      promptSwitchChain()
      return
    }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const config = createWriteConfig(walletClient, publicClient)

      const result = await createAgentAtom(config, {
        name: formData.name,
        description: formData.description,
        category: formData.platforms[0] || 'general',
        website: formData.website || undefined,
        tags: formData.tags,
      })

      setTxHash(result.transactionHash)
      setAtomId(result.state.termId)

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
        {
          const togglePlatform = (value: AgentPlatform) => {
            const current = formData.platforms
            const updated = current.includes(value)
              ? current.filter(p => p !== value)
              : [...current, value]
            setFormData({ ...formData, platforms: updated })
          }

          const filtered = platformFilter === 'all'
            ? PLATFORMS
            : PLATFORMS.filter(p => p.category.includes(platformFilter))

          return (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h3 className="text-xl font-semibold mb-1">Where is your agent hosted?</h3>
              <p className="text-sm text-text-muted">Select one or more platforms</p>

              {/* Category Filters */}
              <div className="flex gap-2">
                {CATEGORY_FILTERS.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setPlatformFilter(cat.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-colors',
                      platformFilter === cat.value
                        ? 'bg-primary text-white'
                        : 'glass hover:bg-white/10'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Platform Grid */}
              <div className="grid grid-cols-2 gap-3">
                {filtered.map(platform => {
                  const isSelected = formData.platforms.includes(platform.value)
                  return (
                    <button
                      key={platform.value}
                      onClick={() => togglePlatform(platform.value)}
                      className={cn(
                        'glass rounded-lg p-4 text-left transition-all relative',
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <PlatformIcon id={platform.value} size={28} active={isSelected} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{platform.label}</span>
                            {platform.tag && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
                                style={{
                                  color: platform.tagColor,
                                  backgroundColor: `${platform.tagColor}15`,
                                  border: `1px solid ${platform.tagColor}30`,
                                }}
                              >
                                {platform.tag}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-text-muted block mt-0.5">{platform.description}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Selected Summary Bar */}
              {formData.platforms.length > 0 && (
                <div className="glass rounded-lg px-4 py-3 flex items-center gap-3">
                  <span className="text-xs text-text-muted flex-shrink-0">Selected:</span>
                  <div className="flex flex-wrap gap-2">
                    {formData.platforms.map(id => {
                      const p = PLATFORMS.find(pl => pl.value === id)
                      return (
                        <span key={id} className="flex items-center gap-1.5 glass px-2 py-1 rounded-md text-xs">
                          <PlatformIcon id={id} size={16} active />
                          {p?.label}
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePlatform(id) }}
                            className="text-text-muted hover:text-text-primary ml-0.5"
                          >
                            &times;
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

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
        }

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
              <div className="relative">
                <input
                  type="text"
                  value={formData["walletAddress"]}
                  onChange={(e) => { setFormData({ ...formData, walletAddress: e.target.value }); setWalletSigned(false); setSignatureHash(null) }}
                  placeholder="0x..."
                  className={cn(
                    "w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none font-mono pr-28",
                    errors["walletAddress"] && "ring-2 ring-trust-critical"
                  )}
                />
                {isConnected && address && !formData["walletAddress"] && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, walletAddress: address })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded"
                  >
                    Use connected
                  </button>
                )}
              </div>
              {errors["walletAddress"] && (
                <p className="text-sm text-trust-critical">{errors["walletAddress"]}</p>
              )}
            </div>

            {/* Verification Options */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Verification Options</p>

              <button
                onClick={handleSignMessage}
                disabled={walletSigning || walletSigned || !isConnected}
                className={cn(
                  'w-full glass rounded-lg p-4 text-left transition-all',
                  walletSigned
                    ? 'ring-2 ring-trust-good/50 bg-trust-good/5'
                    : !isConnected
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/10 hover:ring-1 hover:ring-primary/30'
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    {walletSigned ? (
                      <Check className="w-5 h-5 text-trust-good" />
                    ) : (
                      <Shield className="w-5 h-5 text-trust-good" />
                    )}
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {walletSigning ? 'Signing...' : walletSigned ? 'Wallet Verified' : 'Sign Message'}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {walletSigned
                          ? `Signature: ${signatureHash?.slice(0, 10)}...${signatureHash?.slice(-6)}`
                          : 'Prove wallet ownership'}
                      </span>
                    </span>
                  </span>
                  {walletSigning ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : walletSigned ? (
                    <Badge variant="default" size="sm" className="bg-trust-good/20 text-trust-good border-0">Verified</Badge>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-text-muted" />
                  )}
                </span>
              </button>

              <button className="w-full glass rounded-lg p-4 text-left transition-all opacity-50 cursor-not-allowed" disabled>
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
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-text-muted">Platforms</dt>
                    <dd className="flex flex-wrap gap-1.5 justify-end">
                      {formData.platforms.map(id => {
                        const p = PLATFORMS.find(pl => pl.value === id)
                        return (
                          <span key={id} className="flex items-center gap-1 glass px-2 py-0.5 rounded text-xs">
                            <PlatformIcon id={id} size={14} active />
                            {p?.label}
                          </span>
                        )
                      })}
                    </dd>
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
                  {walletSigned && (
                    <div className="flex items-center gap-2 mt-2">
                      <Check className="w-4 h-4 text-trust-good" />
                      <span className="text-sm text-trust-good">Ownership verified via signature</span>
                    </div>
                  )}
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
            <p className="text-yellow-400 font-semibold">Connect your wallet to register agents</p>
            <p className="text-sm text-text-secondary mt-1">
              Make sure you're on Intuition Testnet (Chain ID: 13579)
            </p>
          </div>
        )}

        {/* Wrong Chain Warning */}
        {isWrongChain && (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-semibold">Wrong network detected</p>
            <p className="text-sm text-text-secondary mt-1">
              You're connected but not on Intuition Testnet (Chain ID: 13579).
            </p>
            <button
              onClick={promptSwitchChain}
              className="mt-3 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-sm font-medium transition-colors"
            >
              Switch to Intuition Testnet
            </button>
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