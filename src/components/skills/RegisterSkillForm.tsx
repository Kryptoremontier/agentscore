'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Puzzle, Link as LinkIcon, Check, ChevronRight, Sparkles, Loader2
} from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { createWriteConfig, createSkillAtom } from '@/lib/intuition'
import { SKILL_CATEGORIES, SKILL_COMPATIBILITIES, type SkillCategory, type SkillCompatibility } from '@/types/skill'

interface RegisterSkillFormProps {
  onSuccess?: (skillId: string) => void
}

const steps = [
  { id: 'basic',   label: 'Basic Info',    icon: FileText },
  { id: 'category', label: 'Category',     icon: Puzzle },
  { id: 'compat',  label: 'Compatibility', icon: LinkIcon },
  { id: 'review',  label: 'Review',        icon: Check },
]

export function RegisterSkillForm({ onSuccess }: RegisterSkillFormProps) {
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
    category: '' as SkillCategory | '',
    compatibilities: [] as SkillCompatibility[],
    githubUrl: '',
    installCommand: '',
    version: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const validateStep = () => {
    const newErrors: Record<string, string> = {}

    switch (currentStep) {
      case 0: // Basic Info
        if (!formData.name) newErrors.name = 'Skill name is required'
        if (formData.name && formData.name.length < 3) newErrors.name = 'Name must be at least 3 characters'
        if (!formData.description) newErrors.description = 'Description is required'
        if (formData.description && formData.description.length < 20) newErrors.description = 'Description must be at least 20 characters'
        break
      case 1: // Category
        if (!formData.category) newErrors.category = 'Please select a category'
        break
      case 2: // Compatibility — optional, no hard validation
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

  const toggleCompat = (id: SkillCompatibility) => {
    setFormData(prev => ({
      ...prev,
      compatibilities: prev.compatibilities.includes(id)
        ? prev.compatibilities.filter(c => c !== id)
        : [...prev.compatibilities, id],
    }))
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

      const result = await createSkillAtom(config, {
        name: formData.name,
        description: formData.description,
        category: formData.category as string,
        compatibilities: formData.compatibilities,
      })

      setTxHash(result.transactionHash)
      setAtomId(result.state.termId)

      onSuccess?.(result.state.termId)

    } catch (e: any) {
      setError(e.message || 'Failed to register skill')
      setLoading(false)
    }
  }

  const selectedCategoryDef = SKILL_CATEGORIES.find(c => c.id === formData.category)

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-4">Tell us about your skill</h3>

            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Skill Name <span className="text-trust-critical">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Web Search Tool"
                className={cn(
                  'w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none',
                  errors.name && 'ring-2 ring-trust-critical'
                )}
              />
              {errors.name && (
                <p className="text-sm text-trust-critical">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Description <span className="text-trust-critical">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this skill does, its inputs/outputs, and how agents can use it..."
                className={cn(
                  'w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none resize-none',
                  errors.description && 'ring-2 ring-trust-critical'
                )}
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-trust-critical">{errors.description}</p>
              )}
              <p className="text-xs text-text-muted">
                {formData.description.length}/500 characters
              </p>
            </div>
          </motion.div>
        )

      case 1: // Category
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-1">What type of skill is this?</h3>
            <p className="text-sm text-text-muted">Select one category</p>

            {errors.category && (
              <p className="text-sm text-trust-critical">{errors.category}</p>
            )}

            {/* Category Grid 3×4 */}
            <div className="grid grid-cols-3 gap-3">
              {SKILL_CATEGORIES.map(cat => {
                const isSelected = formData.category === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setFormData({ ...formData, category: cat.id })}
                    className={cn(
                      'glass rounded-xl p-3 text-left transition-all relative group',
                      isSelected
                        ? 'ring-2 ring-primary'
                        : 'hover:bg-white/10'
                    )}
                    style={isSelected ? { backgroundColor: cat.color + '15', borderColor: cat.color + '40' } : {}}
                  >
                    <div className="text-xl mb-1.5">{cat.icon}</div>
                    <div className="font-medium text-xs leading-tight">{cat.label}</div>
                    <p className="text-[10px] text-text-muted mt-0.5 leading-tight hidden sm:block">{cat.description}</p>
                    {isSelected && (
                      <div
                        className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: cat.color }}
                      >
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )

      case 2: // Compatibility
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold mb-1">Compatible frameworks</h3>
            <p className="text-sm text-text-muted">Select all frameworks this skill works with (optional)</p>

            {/* Compatibility pills */}
            <div className="flex flex-wrap gap-2">
              {SKILL_COMPATIBILITIES.map(compat => {
                const isSelected = formData.compatibilities.includes(compat.id)
                return (
                  <button
                    key={compat.id}
                    onClick={() => toggleCompat(compat.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                      isSelected
                        ? 'text-white'
                        : 'text-text-muted hover:text-white border-white/10 hover:border-white/20 glass'
                    )}
                    style={isSelected ? {
                      backgroundColor: compat.color + '25',
                      borderColor: compat.color + '60',
                      color: compat.color,
                    } : {}}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {compat.label}
                  </button>
                )
              })}
            </div>

            {/* Optional metadata */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <p className="text-sm font-medium text-text-secondary">Additional Info (optional)</p>

              <div className="space-y-2">
                <label className="block text-xs text-text-muted">GitHub Repository</label>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                  placeholder="https://github.com/you/skill"
                  className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-text-muted">Install Command</label>
                <input
                  type="text"
                  value={formData.installCommand}
                  onChange={(e) => setFormData({ ...formData, installCommand: e.target.value })}
                  placeholder="pip install my-skill"
                  className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-text-muted">Version</label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full px-4 py-3 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
                />
              </div>
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
            <h3 className="text-xl font-semibold mb-4">Review your skill details</h3>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="glass rounded-lg p-4">
                <h4 className="font-medium mb-3 text-text-secondary">Basic Information</h4>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-text-muted">Name</dt>
                    <dd className="font-medium">{formData.name}</dd>
                  </div>
                  {selectedCategoryDef && (
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-text-muted">Category</dt>
                      <dd className="flex items-center gap-1.5 text-sm font-medium">
                        <span>{selectedCategoryDef.icon}</span>
                        <span style={{ color: selectedCategoryDef.color }}>{selectedCategoryDef.label}</span>
                      </dd>
                    </div>
                  )}
                  {formData.compatibilities.length > 0 && (
                    <div className="flex justify-between items-start">
                      <dt className="text-sm text-text-muted">Compatible with</dt>
                      <dd className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                        {formData.compatibilities.map(id => {
                          const c = SKILL_COMPATIBILITIES.find(s => s.id === id)
                          return (
                            <span
                              key={id}
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: (c?.color || '#666') + '20',
                                color: c?.color || '#999',
                                border: `1px solid ${(c?.color || '#666')}30`,
                              }}
                            >
                              {c?.shortLabel}
                            </span>
                          )
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Description */}
              <div className="glass rounded-lg p-4">
                <h4 className="font-medium mb-3 text-text-secondary">Description</h4>
                <p className="text-sm">{formData.description}</p>
              </div>

              {/* Optional info */}
              {(formData.githubUrl || formData.installCommand || formData.version) && (
                <div className="glass rounded-lg p-4">
                  <h4 className="font-medium mb-3 text-text-secondary">Additional Info</h4>
                  <dl className="space-y-2">
                    {formData.githubUrl && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-text-muted">GitHub</dt>
                        <dd className="text-sm text-accent-cyan truncate max-w-[200px]">{formData.githubUrl}</dd>
                      </div>
                    )}
                    {formData.installCommand && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-text-muted">Install</dt>
                        <dd><code className="text-xs text-accent-cyan">{formData.installCommand}</code></dd>
                      </div>
                    )}
                    {formData.version && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-text-muted">Version</dt>
                        <dd className="text-sm font-mono">{formData.version}</dd>
                      </div>
                    )}
                  </dl>
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
                  I confirm that this skill complies with AgentScore guidelines and I understand
                  that misleading skills may be reported and stakes slashed.
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
        {mounted && !isConnected && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 font-semibold">Connect your wallet to register skills</p>
            <p className="text-sm text-text-secondary mt-1">
              Make sure you&apos;re on Intuition Testnet (Chain ID: 13579)
            </p>
          </div>
        )}

        {/* Wrong Chain Warning */}
        {mounted && isWrongChain && (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-semibold">Wrong network detected</p>
            <p className="text-sm text-text-secondary mt-1">
              You&apos;re connected but not on Intuition Testnet (Chain ID: 13579).
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
            <p className="text-green-400 font-bold">✅ Skill registered on-chain!</p>
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
              disabled={(mounted && !isConnected) || loading}
              className="flex-1 glow-blue"
            >
              {mounted && !isConnected ? (
                '🔌 Connect Wallet First'
              ) : loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ⏳ Registering on-chain...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  ⚡ Register Skill
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
