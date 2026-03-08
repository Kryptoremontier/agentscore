'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Puzzle, Link as LinkIcon, Check, ChevronRight, Sparkles, Loader2,
  Brain, Code2, BarChart3, Globe, Search, Database, Eye, Mic, Plug, GitBranch,
  Zap, Link2, TrendingUp, ShieldCheck, Activity, Languages, MessageSquare, Type,
  FlaskConical, Wrench, KeyRound, DollarSign, Github, Terminal, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { createWriteConfig, createSkillAtom, getFeeConfig } from '@/lib/intuition'
import { SKILL_CATEGORIES, SKILL_COMPATIBILITIES, type SkillCategory, type SkillCompatibility } from '@/types/skill'

const ICON_MAP: Record<string, LucideIcon> = {
  Brain, Code2, BarChart3, Globe, Search, Database, Eye, Mic, Plug, GitBranch,
  Zap, Link2, TrendingUp, ShieldCheck, Activity, Languages, MessageSquare, Type,
  FlaskConical, Wrench,
}

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
    customCategoryText: '',
    compatibilities: [] as SkillCompatibility[],
    requiresApiKey: false,
    pricing: 'free' as 'free' | 'freemium' | 'paid',
    githubUrl: '',
    installCommand: '',
    termsAccepted: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)
  const [platformFee, setPlatformFee] = useState<{ fixedFee: bigint; bps: bigint } | null>(null)

  useEffect(() => {
    setMounted(true)
    if (publicClient) {
      getFeeConfig(publicClient).then(setPlatformFee).catch(() => {})
    }
  }, [publicClient])

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
        if (formData.category === 'custom' && !formData.customCategoryText.trim())
          newErrors.customCategoryText = 'Please describe your custom category'
        break
      case 2: // Compatibility — optional, no hard validation
        if (formData.githubUrl && !formData.githubUrl.startsWith('http'))
          newErrors.githubUrl = 'Enter a valid URL (starting with https://)'
        break
      case 3: // Review
        if (!formData.termsAccepted) newErrors.termsAccepted = 'You must accept the terms to continue'
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
        category: formData.category === 'custom' && formData.customCategoryText.trim()
          ? formData.customCategoryText.trim()
          : formData.category as string,
        compatibilities: formData.compatibilities,
        requiresApiKey: formData.requiresApiKey,
        pricing: formData.pricing,
        githubUrl: formData.githubUrl || undefined,
        installCommand: formData.installCommand || undefined,
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
            className="space-y-4"
          >
            <div>
              <h3 className="text-xl font-semibold mb-1">What type of skill is this?</h3>
              <p className="text-sm text-text-muted">Select one category</p>
            </div>

            {errors.category && (
              <p className="text-sm text-trust-critical">{errors.category}</p>
            )}

            {/* Category List */}
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {SKILL_CATEGORIES.map(cat => {
                const isSelected = formData.category === cat.id
                const CatIcon = ICON_MAP[cat.icon] ?? Wrench
                return (
                  <button
                    key={cat.id}
                    onClick={() => setFormData({ ...formData, category: cat.id, customCategoryText: '' })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group"
                    style={{
                      background: isSelected ? cat.bg : 'rgba(255,255,255,0.03)',
                      borderColor: isSelected ? cat.border : 'rgba(255,255,255,0.07)',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: cat.bg, border: `1px solid ${cat.border}` }}
                    >
                      <CatIcon className="w-4 h-4" style={{ color: cat.color }} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-medium leading-tight"
                        style={{ color: isSelected ? cat.color : '#E2E8F0' }}
                      >
                        {cat.label}
                      </div>
                      <div className="text-[11px] text-text-muted leading-tight mt-0.5 truncate">
                        {cat.description}
                      </div>
                    </div>

                    {/* Check */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                        isSelected ? 'border-transparent' : 'border-white/20 group-hover:border-white/40'
                      )}
                      style={isSelected ? { backgroundColor: cat.color } : {}}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Custom category text input */}
            {formData.category === 'custom' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1.5"
              >
                <label className="block text-sm font-medium text-[#7A838D]">
                  Describe your custom category <span className="text-trust-critical">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={formData.customCategoryText}
                  onChange={e => setFormData({ ...formData, customCategoryText: e.target.value })}
                  placeholder="e.g., Physics simulation, Game AI, 3D rendering…"
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all',
                    'bg-[rgba(122,131,141,0.08)] text-white placeholder:text-[#4A5568]',
                    errors.customCategoryText
                      ? 'border-trust-critical ring-1 ring-trust-critical'
                      : 'border-[rgba(122,131,141,0.25)] focus:border-[rgba(122,131,141,0.55)] focus:ring-1 focus:ring-[rgba(122,131,141,0.30)]'
                  )}
                  maxLength={60}
                />
                {errors.customCategoryText && (
                  <p className="text-xs text-trust-critical">{errors.customCategoryText}</p>
                )}
                <p className="text-[11px] text-text-muted">{formData.customCategoryText.length}/60</p>
              </motion.div>
            )}
          </motion.div>
        )

      case 2: // Compatibility
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
          >
            <div>
              <h3 className="text-xl font-semibold mb-1">Compatibility & Access</h3>
              <p className="text-sm text-text-muted">Help agents understand how to use this skill</p>
            </div>

            {/* Framework pills */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#94A3B8]">Compatible frameworks <span className="text-text-muted font-normal">(optional, multi-select)</span></p>
              <div className="flex flex-wrap gap-2">
                {SKILL_COMPATIBILITIES.map(compat => {
                  const isSelected = formData.compatibilities.includes(compat.id)
                  return (
                    <button
                      key={compat.id}
                      onClick={() => toggleCompat(compat.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                      style={{
                        background: isSelected ? compat.color + '18' : 'rgba(255,255,255,0.04)',
                        borderColor: isSelected ? compat.color + '70' : 'rgba(255,255,255,0.08)',
                        color: isSelected ? compat.color : '#94A3B8',
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: compat.color }}
                      />
                      {compat.label}
                      {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Requires API Key toggle */}
            <div
              className="flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all"
              style={{
                background: formData.requiresApiKey ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                borderColor: formData.requiresApiKey ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)',
              }}
              onClick={() => setFormData({ ...formData, requiresApiKey: !formData.requiresApiKey })}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: formData.requiresApiKey ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${formData.requiresApiKey ? 'rgba(251,191,36,0.40)' : 'rgba(255,255,255,0.10)'}`,
                  }}
                >
                  <KeyRound className="w-4 h-4" style={{ color: formData.requiresApiKey ? '#FBBF24' : '#7A838D' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: formData.requiresApiKey ? '#FBBF24' : '#E2E8F0' }}>
                    Requires API Key / Secrets
                  </p>
                  <p className="text-[11px] text-text-muted">Agent needs credentials to use this skill</p>
                </div>
              </div>
              <div
                className="w-10 h-6 rounded-full transition-all relative shrink-0"
                style={{ background: formData.requiresApiKey ? '#FBBF24' : 'rgba(255,255,255,0.12)' }}
              >
                <div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ left: formData.requiresApiKey ? '22px' : '4px' }}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#94A3B8] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Pricing model
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'free',      label: 'Free',      desc: 'No cost to use',            color: '#4ADE80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.30)' },
                  { id: 'freemium', label: 'Freemium',  desc: 'Free tier + paid limits',   color: '#C8963C', bg: 'rgba(200,150,60,0.10)',  border: 'rgba(200,150,60,0.30)' },
                  { id: 'paid',      label: 'Paid',      desc: 'Requires subscription/fee', color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.30)' },
                ] as const).map(opt => {
                  const isActive = formData.pricing === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setFormData({ ...formData, pricing: opt.id })}
                      className="p-3 rounded-xl border text-left transition-all"
                      style={{
                        background: isActive ? opt.bg : 'rgba(255,255,255,0.03)',
                        borderColor: isActive ? opt.border : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: isActive ? opt.color : '#E2E8F0' }}>
                          {opt.label}
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5" style={{ color: opt.color }} />}
                      </div>
                      <p className="text-[10px] text-text-muted leading-tight">{opt.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Links */}
            <div className="space-y-3 pt-1 border-t border-white/8">
              <p className="text-sm font-medium text-[#94A3B8] pt-1">Links <span className="text-text-muted font-normal">(optional)</span></p>

              <div className="space-y-1">
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A838D]" />
                  <input
                    type="url"
                    value={formData.githubUrl}
                    onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                    placeholder="https://github.com/you/skill"
                    className={cn(
                      'w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none text-sm transition-all',
                      'bg-[rgba(255,255,255,0.04)] text-white placeholder:text-[#3A4555]',
                      errors.githubUrl
                        ? 'border-trust-critical ring-1 ring-trust-critical'
                        : 'border-[rgba(255,255,255,0.08)] focus:border-[rgba(200,150,60,0.40)] focus:ring-1 focus:ring-[rgba(200,150,60,0.20)]'
                    )}
                  />
                </div>
                {errors.githubUrl && <p className="text-xs text-trust-critical pl-1">{errors.githubUrl}</p>}
              </div>

              <div className="relative">
                <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A838D]" />
                <input
                  type="text"
                  value={formData.installCommand}
                  onChange={(e) => setFormData({ ...formData, installCommand: e.target.value })}
                  placeholder="pip install my-skill  /  npm install my-skill"
                  className={cn(
                    'w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none text-sm font-mono transition-all',
                    'bg-[rgba(255,255,255,0.04)] text-white placeholder:text-[#3A4555]',
                    'border-[rgba(255,255,255,0.08)] focus:border-[rgba(200,150,60,0.40)] focus:ring-1 focus:ring-[rgba(200,150,60,0.20)]'
                  )}
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
                  {selectedCategoryDef && (() => {
                    const RevIcon = ICON_MAP[selectedCategoryDef.icon] ?? Wrench
                    const displayLabel = selectedCategoryDef.id === 'custom' && formData.customCategoryText.trim()
                      ? formData.customCategoryText.trim()
                      : selectedCategoryDef.label
                    return (
                      <div className="flex justify-between items-center">
                        <dt className="text-sm text-text-muted">Category</dt>
                        <dd className="flex items-center gap-1.5 text-sm font-medium">
                          <RevIcon className="w-4 h-4" style={{ color: selectedCategoryDef.color }} />
                          <span style={{ color: selectedCategoryDef.color }}>{displayLabel}</span>
                        </dd>
                      </div>
                    )
                  })()}
                </dl>
              </div>

              {/* Description */}
              <div className="glass rounded-lg p-4">
                <h4 className="font-medium mb-3 text-text-secondary">Description</h4>
                <p className="text-sm">{formData.description}</p>
              </div>

              {/* Compatibility & Access */}
              <div className="glass rounded-lg p-4">
                <h4 className="font-medium mb-3 text-text-secondary">Compatibility & Access</h4>
                <dl className="space-y-2.5">
                  {/* Pricing */}
                  {(() => {
                    const PRICING_COLORS: Record<string, string> = { free: '#4ADE80', freemium: '#C8963C', paid: '#F87171' }
                    const col = PRICING_COLORS[formData.pricing]
                    return (
                      <div className="flex justify-between items-center">
                        <dt className="text-sm text-text-muted flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" /> Pricing
                        </dt>
                        <dd className="text-sm font-medium capitalize" style={{ color: col }}>
                          {formData.pricing}
                        </dd>
                      </div>
                    )
                  })()}
                  {/* API Key */}
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-text-muted flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" /> API Key required
                    </dt>
                    <dd className="text-sm font-medium" style={{ color: formData.requiresApiKey ? '#FBBF24' : '#4ADE80' }}>
                      {formData.requiresApiKey ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  {/* Frameworks */}
                  {formData.compatibilities.length > 0 && (
                    <div className="flex justify-between items-start">
                      <dt className="text-sm text-text-muted">Frameworks</dt>
                      <dd className="flex flex-wrap gap-1 justify-end max-w-[220px]">
                        {formData.compatibilities.map(id => {
                          const c = SKILL_COMPATIBILITIES.find(s => s.id === id)
                          return (
                            <span
                              key={id}
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: (c?.color || '#666') + '20',
                                color: c?.color || '#999',
                                border: `1px solid ${(c?.color || '#666')}35`,
                              }}
                            >
                              {c?.shortLabel}
                            </span>
                          )
                        })}
                      </dd>
                    </div>
                  )}
                  {/* GitHub */}
                  {formData.githubUrl && (
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-text-muted flex items-center gap-1.5">
                        <Github className="w-3.5 h-3.5" /> GitHub
                      </dt>
                      <dd className="text-sm text-accent-cyan truncate max-w-[200px]">{formData.githubUrl}</dd>
                    </div>
                  )}
                  {/* Install */}
                  {formData.installCommand && (
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-text-muted flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" /> Install
                      </dt>
                      <dd><code className="text-xs text-accent-cyan">{formData.installCommand}</code></dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Registration Fee */}
              <div className="glass rounded-lg p-4 border border-primary/20 space-y-2">
                <p className="font-medium">Registration Fee</p>
                {platformFee ? (() => {
                  const depositAmt = 0.001
                  const pctFee = depositAmt * Number(platformFee.bps) / 10000
                  const fixedFee = Number(platformFee.fixedFee) / 1e18
                  const protocolCost = 0.001
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-text-muted">
                        <span>Protocol cost</span><span>~{protocolCost.toFixed(3)} tTRUST</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Initial deposit</span><span>{depositAmt.toFixed(3)} tTRUST</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Platform fee ({Number(platformFee.bps)/100}% + {fixedFee.toFixed(3)})</span>
                        <span>{(pctFee + fixedFee).toFixed(4)} tTRUST</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t border-white/10 pt-1">
                        <span>Total</span>
                        <span className="font-mono">{(protocolCost + depositAmt + pctFee + fixedFee).toFixed(4)} tTRUST</span>
                      </div>
                    </div>
                  )
                })() : (
                  <p className="text-sm text-text-muted">~0.21 tTRUST (protocol + deposit + fee)</p>
                )}
              </div>

              {/* Terms */}
              <button
                type="button"
                onClick={() => setFormData(f => ({ ...f, termsAccepted: !f.termsAccepted }))}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                  formData.termsAccepted
                    ? 'bg-[rgba(200,150,60,0.08)] border-[rgba(200,150,60,0.35)]'
                    : errors.termsAccepted
                      ? 'bg-[rgba(248,113,113,0.06)] border-trust-critical'
                      : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    formData.termsAccepted ? 'border-transparent' : 'border-[#4A5568]'
                  )}
                  style={formData.termsAccepted ? { backgroundColor: '#C8963C' } : {}}
                >
                  {formData.termsAccepted && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  I confirm that this skill complies with AgentScore guidelines and I understand
                  that misleading skills may be reported and stakes slashed.
                </p>
              </button>
              {errors.termsAccepted && (
                <p className="text-xs text-trust-critical pl-1">{errors.termsAccepted}</p>
              )}
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
        {mounted && !isConnected && !txHash && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-400 font-semibold">Connect your wallet to register skills</p>
            <p className="text-sm text-text-secondary mt-1">
              Make sure you&apos;re on Intuition Testnet (Chain ID: 13579)
            </p>
          </div>
        )}

        {/* Wrong Chain Warning */}
        {mounted && isWrongChain && !txHash && (
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

        {/* Error State */}
        {error && !txHash && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Error
            </p>
            <p className="text-sm text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* ─── SUCCESS SCREEN replaces form ─── */}
        {txHash ? (
          <div className="flex flex-col items-center text-center py-4 space-y-6">
            <div className="w-16 h-16 rounded-full bg-[rgba(74,222,128,0.15)] border border-[rgba(74,222,128,0.40)] flex items-center justify-center">
              <Check className="w-8 h-8 text-[#4ADE80]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-1">Skill Registered!</h3>
              <p className="text-text-muted text-sm">Successfully created on the Intuition Protocol.</p>
            </div>

            {atomId && (
              <div className="w-full bg-[#0D1017] border border-[#1e2028] rounded-xl p-4 text-left space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#4A5568] mb-1">Atom ID</p>
                  <code className="text-[#4ADE80] text-xs font-mono break-all block leading-relaxed">{atomId}</code>
                </div>
                <div className="flex gap-6 pt-1 border-t border-[#1e2028]">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#4A5568] mb-0.5">Status</p>
                    <p className="text-sm font-semibold text-[#4ADE80]">Active</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#4A5568] mb-0.5">Network</p>
                    <p className="text-sm font-semibold text-[#C8963C]">Intuition Testnet</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button
                onClick={() => onSuccess?.(atomId ?? '')}
                className="flex-1"
              >
                View Skill
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/skills'}
                className="flex-1"
              >
                Browse Skills
              </Button>
            </div>

            <div className="w-full space-y-2 text-left">
              <p className="text-[11px] uppercase tracking-widest text-[#4A5568] font-semibold">Next Steps</p>
              {[
                { icon: ShieldCheck, color: '#C8963C', label: 'Build Trust', desc: 'Encourage users to Support your skill with tTRUST stakes' },
                { icon: Users,       color: '#38B6FF', label: 'Engage Community', desc: 'Grow your reputation through attestations' },
                { icon: TrendingUp,  color: '#4ADE80', label: 'Monitor Score', desc: 'Track trust score, stakers and activity in Explorer' },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
                >
                  <item.icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                  <div>
                    <span className="text-sm font-semibold" style={{ color: item.color }}>{item.label}</span>
                    <span className="text-sm text-text-muted"> {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <a
              href={`https://testnet.explorer.intuition.systems/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-cyan hover:underline"
            >
              View transaction on explorer →
            </a>
          </div>
        ) : (
          <>
            {renderStepContent()}

            {/* Actions */}
            <div className="flex gap-3 mt-8">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  Back
                </Button>
              )}
              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} className="flex-1">
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={(mounted && !isConnected) || loading}
                  className="flex-1"
                >
                  {mounted && !isConnected ? (
                    <>
                      <Plug className="w-4 h-4 mr-2" /> Connect Wallet First
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registering on-chain...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Register Skill
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
