'use client'

import { useState, useMemo, useEffect, useRef, KeyboardEvent } from 'react'
import {
  ChevronDown, X, Loader2,
  Bot, Zap, Link2, GitBranch, MessageSquare, Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { parseEther } from 'viem'
import { cn } from '@/lib/cn'
import {
  createWriteConfig,
  getFeeConfig,
  registerAgentBatch,
} from '@/lib/intuition'
import {
  calculateProfileCompleteness,
  AGENT_CATEGORIES,
  type AgentCardData,
  type AgentCategory,
} from '@/lib/agent-card'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RegisterAgentFormProps {
  onSuccess?: (agentId: string) => void
}

type SectionKey = 'identity' | 'capabilities' | 'endpoints' | 'source' | 'social'

// ─── URL validation helpers ────────────────────────────────────────────────

function isValidUrl(value: string): boolean {
  if (!value) return true
  try { new URL(value.startsWith('http') ? value : `https://${value}`); return true } catch { return false }
}
function isValidHttpsUrl(value: string): boolean {
  if (!value) return true
  try { const u = new URL(value); return u.protocol === 'https:' } catch { return false }
}
function normalizeGithub(value: string): string {
  return value.replace(/^https?:\/\//, '')
}

// ─── Section progress dot ─────────────────────────────────────────────────

function SectionDot({ filled, partial }: { filled: boolean; partial?: boolean }) {
  if (filled)   return <span className="w-2 h-2 rounded-full bg-[#2ECC71] flex-shrink-0" />
  if (partial)  return <span className="w-2 h-2 rounded-full bg-[#EAB308] flex-shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-[#3A4049] flex-shrink-0" />
}

// ─── Input ───────────────────────────────────────────────────────────────────

function Field({
  label, hint, error, required, children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#C8D1DA]">
        {label} {required && <span className="text-[#EF4444]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#7A838D] italic">{hint}</p>}
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

function Input({
  value, onChange, onBlur, placeholder, error, type = 'text', className,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  error?: boolean
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-[#4A5260]',
        'bg-[#12151A] border outline-none transition-colors',
        error
          ? 'border-[#EF444440] focus:border-[#EF4444]'
          : 'border-[#1E2229] focus:border-[#C8963C]/40',
        className,
      )}
    />
  )
}

// ─── Completeness Bar ────────────────────────────────────────────────────────

function CompletenessBar({ pct, isA2AReady, nextMissing }: { pct: number; isA2AReady: boolean; nextMissing?: string }) {
  const color = pct < 30 ? '#EF4444' : pct < 60 ? '#EAB308' : '#2ECC71'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#7A838D] font-medium">Profile Completeness</span>
        <div className="flex items-center gap-2">
          {isA2AReady && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#2ECC7120] text-[#2ECC71] border border-[#2ECC7130]">
              A2A Ready
            </span>
          )}
          <span className="font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#1E2229] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
      {nextMissing && pct < 100 && (
        <p className="text-xs text-[#7A838D] flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3 text-[#C8963C] flex-shrink-0" />
          Add <span className="text-[#C8963C]">{nextMissing}</span> to increase completeness
        </p>
      )}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────��──

function SectionHeader({
  icon: Icon, iconColor, label, badge, expanded, filled, partial, toggle,
}: {
  icon: LucideIcon
  iconColor: string
  label: string
  badge?: string
  expanded: boolean
  filled: boolean
  partial?: boolean
  toggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      className="w-full flex items-center gap-3 py-3 text-left group"
    >
      <SectionDot filled={filled} partial={partial} />
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}14`, border: `1px solid ${iconColor}30` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
      </div>
      <span className="text-sm font-semibold text-[#C8D1DA] flex-1">
        {label}
        {badge && (
          <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#C8963C15] text-[#C8963C] border border-[#C8963C25]">
            {badge}
          </span>
        )}
      </span>
      <ChevronDown
        className={cn('w-4 h-4 text-[#4A5260] transition-transform duration-200', expanded && 'rotate-180')}
      />
    </button>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RegisterAgentForm({ onSuccess }: RegisterAgentFormProps) {
  const { address, isConnected, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain } = useSwitchChain()

  const isWrongChain = isConnected && chain?.id !== intuitionTestnet.id

  // ── Form state ───────────────────────────────────────────────────────────

  const [cardData, setCardData] = useState<AgentCardData>({
    name: '',
    description: '',
    category: undefined,
    skills: [],
    endpoints: { api: '', mcp: '', a2aCard: '', website: '', docs: '' },
    source: { github: '', version: '', license: '', framework: '' },
    social: { twitter: '', discord: '', telegram: '' },
  })

  const [initialStake, setInitialStake] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [existingSkills, setExistingSkills] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const skillContainerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    identity:     true,
    capabilities: true,
    endpoints:    false,
    source:       false,
    social:       false,
  })
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [platformFee, setPlatformFee] = useState<{ fixedFee: bigint; bps: bigint } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (publicClient) {
      getFeeConfig(publicClient).then(setPlatformFee).catch(() => {})
    }
  }, [publicClient])

  // Fetch existing skills for autocomplete (lazy — on first focus)
  const fetchSkillsOnce = useRef(false)
  const fetchExistingSkills = async () => {
    if (fetchSkillsOnce.current) return
    fetchSkillsOnce.current = true
    try {
      const res = await fetch('/api/v1/skills')
      const json = await res.json()
      const names: string[] = (json.data ?? [])
        .map((s: { name?: string; label?: string }) => s.name || s.label || '')
        .filter(Boolean)
      setExistingSkills(names)
    } catch { /* non-critical */ }
  }

  // ── Completeness (real-time) ─────────────────────────────────────────────

  const completeness = useMemo(() => {
    const clean: AgentCardData = {
      ...cardData,
      name: cardData.name.trim(),
      description: cardData.description?.trim() || undefined,
      skills: cardData.skills?.filter(Boolean),
      endpoints: {
        api:     cardData.endpoints?.api?.trim() || undefined,
        mcp:     cardData.endpoints?.mcp?.trim() || undefined,
        a2aCard: cardData.endpoints?.a2aCard?.trim() || undefined,
        website: cardData.endpoints?.website?.trim() || undefined,
        docs:    cardData.endpoints?.docs?.trim() || undefined,
      },
      source: {
        github:    cardData.source?.github?.trim() || undefined,
        version:   cardData.source?.version?.trim() || undefined,
        license:   cardData.source?.license?.trim() || undefined,
        framework: cardData.source?.framework?.trim() || undefined,
      },
      social: {
        twitter:  cardData.social?.twitter?.trim() || undefined,
        discord:  cardData.social?.discord?.trim() || undefined,
        telegram: cardData.social?.telegram?.trim() || undefined,
      },
    }
    return calculateProfileCompleteness(clean)
  }, [cardData])

  // ── Section filled states ────────────────────────────────────────────────

  const sectionFilled = {
    identity:     !!cardData.name.trim() && !!cardData.description?.trim() && !!cardData.category,
    capabilities: (cardData.skills?.length ?? 0) > 0,
    endpoints:    !!(cardData.endpoints?.api?.trim() || cardData.endpoints?.mcp?.trim()),
    source:       !!cardData.source?.github?.trim(),
    social:       !!(cardData.social?.twitter?.trim() || cardData.social?.discord?.trim() || cardData.social?.telegram?.trim()),
  }
  const sectionPartial = {
    identity:     !!cardData.name.trim() && (!cardData.description?.trim() || !cardData.category),
    capabilities: false,
    endpoints:    !!(cardData.endpoints?.website?.trim() || cardData.endpoints?.docs?.trim()),
    source:       !!(cardData.source?.version?.trim() || cardData.source?.license?.trim()),
    social:       false,
  }

  const toggleSection = (key: SectionKey) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Skill input ──────────────────────────────────────────────────────────

  const addSkill = (raw: string) => {
    const skill = raw.trim()
    if (!skill) return
    if ((cardData.skills?.length ?? 0) >= 10) return
    if (cardData.skills?.includes(skill)) return
    setCardData(prev => ({ ...prev, skills: [...(prev.skills ?? []), skill] }))
    setSkillInput('')
    setShowSuggestions(false)
  }

  const removeSkill = (skill: string) =>
    setCardData(prev => ({ ...prev, skills: prev.skills?.filter(s => s !== skill) }))

  const onSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill(skillInput)
    }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  // Suggestions: existing skills matching input, excluding already added
  const suggestions = useMemo(() => {
    const q = skillInput.trim().toLowerCase()
    if (!q) return []
    return existingSkills
      .filter(s => s.toLowerCase().includes(q) && !cardData.skills?.includes(s))
      .slice(0, 8)
  }, [skillInput, existingSkills, cardData.skills])

  const showNewOption = skillInput.trim().length > 0
    && !existingSkills.some(s => s.toLowerCase() === skillInput.trim().toLowerCase())
    && !cardData.skills?.includes(skillInput.trim())

  // ── URL validation (on blur) ─────────────────────────────────────────────

  const validateUrl = (key: string, value: string) => {
    if (!value) { setUrlErrors(prev => { const n = { ...prev }; delete n[key]; return n }); return }
    const valid = isValidHttpsUrl(value)
    setUrlErrors(prev => valid
      ? (() => { const n = { ...prev }; delete n[key]; return n })()
      : { ...prev, [key]: 'Must be a valid https:// URL' }
    )
  }

  // ── Cost display ────────────────────────────────────────────────────────

  const costDisplay = useMemo(() => {
    if (!platformFee) return '~0.02 tTRUST + gas'
    const fixedEth = Number(platformFee.fixedFee) / 1e18
    const pct = Number(platformFee.bps) / 100
    return `~${fixedEth.toFixed(3)} tTRUST fixed + ${pct}% + gas`
  }, [platformFee])

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!cardData.name.trim()) { setSubmitError('Agent name is required'); return }
    if (Object.keys(urlErrors).length > 0) { setSubmitError('Fix URL errors before submitting'); return }

    if (!isConnected) { setSubmitError('Connect your wallet first'); return }
    if (isWrongChain) {
      try { switchChain({ chainId: intuitionTestnet.id }) } catch { setSubmitError('Please switch to Intuition Testnet (Chain ID: 13579)') }
      return
    }
    if (!walletClient || !publicClient) { setSubmitError('Wallet not ready'); return }

    setLoading(true)
    setSubmitError(null)
    setLoadingStep(null)

    try {
      const config = createWriteConfig(walletClient, publicClient)

      // Build clean card (strip empty strings)
      const finalCard: AgentCardData = {
        name: cardData.name.trim(),
        description: cardData.description?.trim() || undefined,
        category: cardData.category || undefined,
        // skills handled separately via triples
        endpoints: {
          api:     cardData.endpoints?.api?.trim()     || undefined,
          mcp:     cardData.endpoints?.mcp?.trim()     || undefined,
          a2aCard: cardData.endpoints?.a2aCard?.trim() || undefined,
          website: cardData.endpoints?.website?.trim() || undefined,
          docs:    cardData.endpoints?.docs?.trim()    || undefined,
        },
        source: {
          github:    normalizeGithub(cardData.source?.github?.trim() || ''),
          version:   cardData.source?.version?.trim()   || undefined,
          license:   cardData.source?.license?.trim()   || undefined,
          framework: cardData.source?.framework?.trim() || undefined,
        },
        social: {
          twitter:  cardData.social?.twitter?.trim()  || undefined,
          discord:  cardData.social?.discord?.trim()  || undefined,
          telegram: cardData.social?.telegram?.trim() || undefined,
        },
      }
      // clean empty github
      if (!finalCard.source?.github) finalCard.source = { ...finalCard.source, github: undefined }

      const deposit = initialStake ? parseEther(initialStake) : undefined

      const skills = (cardData.skills ?? []).filter(Boolean)

      const result = await registerAgentBatch(
        config,
        finalCard,
        skills,
        deposit,
        (step) => setLoadingStep(step),
      )

      onSuccess?.(result.termId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setSubmitError(msg || 'Registration failed')
    } finally {
      setLoading(false)
      setLoadingStep(null)
    }
  }

  if (!mounted) return null

  const inputBase = 'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-[#4A5260] bg-[#12151A] border border-[#1E2229] outline-none focus:border-[#C8963C]/40 transition-colors'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#0F1113,#13161B)', border: '1px solid rgba(200,150,60,0.14)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#1E2229]">
          <h2 className="text-lg font-bold text-white mb-4">Register Your AI Agent</h2>
          <CompletenessBar
            pct={completeness.percentage}
            isA2AReady={completeness.isA2AReady}
            nextMissing={completeness.missingFields[0]}
          />
        </div>

        {/* Sections */}
        <div className="px-6 divide-y divide-[#1E2229]">

          {/* ── Identity ── */}
          <div>
            <SectionHeader
              icon={Bot} iconColor="#C8963C" label="Identity" badge="required"
              expanded={expanded.identity}
              filled={sectionFilled.identity} partial={sectionPartial.identity}
              toggle={() => toggleSection('identity')}
            />
            {expanded.identity && (
              <div className="pb-5 space-y-4">
                <Field label="Agent Name" required error={!cardData.name.trim() && submitError ? 'Required' : undefined}>
                  <Input
                    value={cardData.name}
                    onChange={v => setCardData(prev => ({ ...prev, name: v }))}
                    placeholder="e.g. CodeBuddy"
                  />
                </Field>

                <Field label="Description" hint="One-liner: what does this agent do?">
                  <div className="relative">
                    <textarea
                      value={cardData.description ?? ''}
                      onChange={e => setCardData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="AI-powered code review assistant that analyzes pull requests and suggests fixes"
                      rows={3}
                      maxLength={500}
                      className={cn(inputBase, 'resize-none')}
                    />
                    <span className="absolute bottom-2 right-3 text-[11px] text-[#4A5260]">
                      {500 - (cardData.description?.length ?? 0)}
                    </span>
                  </div>
                </Field>

                <Field label="Category">
                  <div className="relative">
                    <select
                      value={cardData.category ?? ''}
                      onChange={e => setCardData(prev => ({ ...prev, category: e.target.value as AgentCategory || undefined }))}
                      className={cn(inputBase, 'appearance-none cursor-pointer')}
                    >
                      <option value="">Select category…</option>
                      {AGENT_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5260] pointer-events-none" />
                  </div>
                </Field>
              </div>
            )}
          </div>

          {/* ── Capabilities ── */}
          <div>
            <SectionHeader
              icon={Zap} iconColor="#2EE6D6" label="Capabilities" badge="powers scoring"
              expanded={expanded.capabilities}
              filled={sectionFilled.capabilities}
              toggle={() => toggleSection('capabilities')}
            />
            {expanded.capabilities && (
              <div className="pb-5 space-y-3">
                <Field
                  label="Skills"
                  hint="Type to search existing skills or add a new one. Skills power Domain Leaderboards."
                >
                  <div className="relative" ref={skillContainerRef}>
                    {/* Chips + input */}
                    <div
                      className="flex flex-wrap gap-2 min-h-[44px] p-2.5 rounded-xl bg-[#12151A] border border-[#1E2229] focus-within:border-[#C8963C]/40 transition-colors cursor-text"
                      onClick={() => document.getElementById('skill-input')?.focus()}
                    >
                      {cardData.skills?.map(skill => (
                        <span
                          key={skill}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#C8963C15] text-[#E8B84B] border border-[#C8963C30]"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeSkill(skill) }}
                            className="hover:text-white transition-colors ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        id="skill-input"
                        type="text"
                        value={skillInput}
                        autoComplete="off"
                        onChange={e => { setSkillInput(e.target.value); setShowSuggestions(true) }}
                        onFocus={() => { fetchExistingSkills(); setShowSuggestions(true) }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        onKeyDown={onSkillKeyDown}
                        placeholder={(cardData.skills?.length ?? 0) === 0 ? 'Search or add skill…' : 'Add more…'}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-white placeholder-[#4A5260]"
                      />
                    </div>

                    {/* Autocomplete dropdown */}
                    {showSuggestions && (suggestions.length > 0 || showNewOption) && (
                      <div
                        className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
                        style={{ background: '#1A1D22', border: '1px solid rgba(200,150,60,0.2)' }}
                      >
                        {suggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addSkill(s) }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[#C8963C10] transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C8963C] flex-shrink-0" />
                            <span className="text-[#C8D1DA]">{s}</span>
                            <span className="ml-auto text-[10px] text-[#4A5260]">existing</span>
                          </button>
                        ))}
                        {showNewOption && (
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addSkill(skillInput) }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[#2ECC7110] transition-colors border-t border-[#1E2229]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71] flex-shrink-0" />
                            <span className="text-[#C8D1DA]">
                              Add <span className="text-[#2ECC71] font-medium">"{skillInput.trim()}"</span>
                            </span>
                            <span className="ml-auto text-[10px] text-[#4A5260]">new</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {(cardData.skills?.length ?? 0) >= 10 && (
                    <p className="text-xs text-[#7A838D]">Maximum 10 skills</p>
                  )}
                </Field>
              </div>
            )}
          </div>

          {/* ── Endpoints ── */}
          <div>
            <SectionHeader
              icon={Link2} iconColor="#38B6FF" label="Endpoints" badge="A2A discovery"
              expanded={expanded.endpoints}
              filled={sectionFilled.endpoints} partial={sectionPartial.endpoints}
              toggle={() => toggleSection('endpoints')}
            />
            {expanded.endpoints && (
              <div className="pb-5 space-y-4">
                <p className="text-xs text-[#7A838D] italic -mt-1">
                  Endpoints let other AI agents discover and communicate with your agent programmatically.
                </p>

                <Field label="API Endpoint" error={urlErrors['endpoints.api']}>
                  <Input
                    value={cardData.endpoints?.api ?? ''}
                    onChange={v => setCardData(prev => ({ ...prev, endpoints: { ...prev.endpoints, api: v } }))}
                    onBlur={() => validateUrl('endpoints.api', cardData.endpoints?.api ?? '')}
                    placeholder="https://yourapp.ai/api"
                    error={!!urlErrors['endpoints.api']}
                  />
                </Field>

                <Field label="MCP Server" error={urlErrors['endpoints.mcp']}>
                  <Input
                    value={cardData.endpoints?.mcp ?? ''}
                    onChange={v => setCardData(prev => ({ ...prev, endpoints: { ...prev.endpoints, mcp: v } }))}
                    onBlur={() => validateUrl('endpoints.mcp', cardData.endpoints?.mcp ?? '')}
                    placeholder="https://yourapp.ai/mcp"
                    error={!!urlErrors['endpoints.mcp']}
                  />
                </Field>

                <Field label="A2A Agent Card URL" hint="/.well-known/agent.json" error={urlErrors['endpoints.a2aCard']}>
                  <Input
                    value={cardData.endpoints?.a2aCard ?? ''}
                    onChange={v => setCardData(prev => ({ ...prev, endpoints: { ...prev.endpoints, a2aCard: v } }))}
                    onBlur={() => validateUrl('endpoints.a2aCard', cardData.endpoints?.a2aCard ?? '')}
                    placeholder="https://yourapp.ai/.well-known/agent.json"
                    error={!!urlErrors['endpoints.a2aCard']}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Website" error={urlErrors['endpoints.website']}>
                    <Input
                      value={cardData.endpoints?.website ?? ''}
                      onChange={v => setCardData(prev => ({ ...prev, endpoints: { ...prev.endpoints, website: v } }))}
                      onBlur={() => validateUrl('endpoints.website', cardData.endpoints?.website ?? '')}
                      placeholder="https://yourapp.ai"
                      error={!!urlErrors['endpoints.website']}
                    />
                  </Field>
                  <Field label="Docs" error={urlErrors['endpoints.docs']}>
                    <Input
                      value={cardData.endpoints?.docs ?? ''}
                      onChange={v => setCardData(prev => ({ ...prev, endpoints: { ...prev.endpoints, docs: v } }))}
                      onBlur={() => validateUrl('endpoints.docs', cardData.endpoints?.docs ?? '')}
                      placeholder="https://docs.yourapp.ai"
                      error={!!urlErrors['endpoints.docs']}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* ── Source ── */}
          <div>
            <SectionHeader
              icon={GitBranch} iconColor="#A78BFA" label="Source & Provenance"
              expanded={expanded.source}
              filled={sectionFilled.source} partial={sectionPartial.source}
              toggle={() => toggleSection('source')}
            />
            {expanded.source && (
              <div className="pb-5 space-y-4">
                <Field label="GitHub Repository">
                  <Input
                    value={cardData.source?.github ?? ''}
                    onChange={v => setCardData(prev => ({ ...prev, source: { ...prev.source, github: v } }))}
                    placeholder="github.com/yourorg/yourrepo"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Version">
                    <Input
                      value={cardData.source?.version ?? ''}
                      onChange={v => setCardData(prev => ({ ...prev, source: { ...prev.source, version: v } }))}
                      placeholder="v2.1.0"
                    />
                  </Field>
                  <Field label="License">
                    <div className="relative">
                      <select
                        value={cardData.source?.license ?? ''}
                        onChange={e => setCardData(prev => ({ ...prev, source: { ...prev.source, license: e.target.value || undefined } }))}
                        className={cn(inputBase, 'appearance-none cursor-pointer')}
                      >
                        <option value="">Select…</option>
                        {['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'AGPL-3.0', 'Proprietary', 'Other'].map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5260] pointer-events-none" />
                    </div>
                  </Field>
                </div>

                <Field label="Framework">
                  <div className="relative">
                    <select
                      value={cardData.source?.framework ?? ''}
                      onChange={e => setCardData(prev => ({ ...prev, source: { ...prev.source, framework: e.target.value || undefined } }))}
                      className={cn(inputBase, 'appearance-none cursor-pointer')}
                    >
                      <option value="">Select or type…</option>
                      {['LangChain', 'CrewAI', 'ElizaOS', 'AutoGen', 'OpenAI Assistants', 'Anthropic Claude', 'Custom'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5260] pointer-events-none" />
                  </div>
                </Field>
              </div>
            )}
          </div>

          {/* ── Social ── */}
          <div>
            <SectionHeader
              icon={MessageSquare} iconColor="#7A838D" label="Social"
              expanded={expanded.social}
              filled={sectionFilled.social}
              toggle={() => toggleSection('social')}
            />
            {expanded.social && (
              <div className="pb-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Twitter/X">
                    <Input
                      value={cardData.social?.twitter ?? ''}
                      onChange={v => setCardData(prev => ({ ...prev, social: { ...prev.social, twitter: v } }))}
                      placeholder="@agentname"
                    />
                  </Field>
                  <Field label="Discord">
                    <Input
                      value={cardData.social?.discord ?? ''}
                      onChange={v => setCardData(prev => ({ ...prev, social: { ...prev.social, discord: v } }))}
                      placeholder="discord.gg/…"
                    />
                  </Field>
                  <Field label="Telegram">
                    <Input
                      value={cardData.social?.telegram ?? ''}
                      onChange={v => setCardData(prev => ({ ...prev, social: { ...prev.social, telegram: v } }))}
                      placeholder="@agentname"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-[#1E2229] space-y-4">
          {/* Completeness summary at bottom */}
          <CompletenessBar
            pct={completeness.percentage}
            isA2AReady={completeness.isA2AReady}
            nextMissing={completeness.missingFields[0]}
          />

          {/* Initial stake (optional) */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[#7A838D] mb-1.5">Initial stake (optional)</label>
              <Input
                value={initialStake}
                onChange={setInitialStake}
                placeholder="0.001"
                type="number"
              />
            </div>
            <div className="text-xs text-[#7A838D] pt-5">tTRUST</div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="rounded-xl px-4 py-3 bg-[#EF444415] border border-[#EF444430] text-[#EF4444] text-sm">
              {submitError}
            </div>
          )}

          {/* Submit */}
          {!isConnected ? (
            <div className="rounded-xl px-4 py-3 bg-[#C8963C10] border border-[#C8963C25] text-[#C8963C] text-sm text-center">
              Connect wallet to register
            </div>
          ) : isWrongChain ? (
            <button
              onClick={() => switchChain({ chainId: intuitionTestnet.id })}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all bg-[#EAB30820] text-[#EAB308] border border-[#EAB30840] hover:bg-[#EAB30830]"
            >
              Switch to Intuition Testnet
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !cardData.name.trim()}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-bold transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-gradient-to-r from-[#C8963C] to-[#E8B84B] text-black hover:opacity-90',
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {loadingStep || 'Processing…'}
                </span>
              ) : (
                `Register Agent — ${costDisplay}`
              )}
            </button>
          )}

          <p className="text-xs text-[#4A5260] text-center">
            Only name is required. Add more details anytime via Claims.
          </p>
        </div>
      </div>
    </div>
  )
}
