'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useWalletClient, usePublicClient, useAccount, useChainId } from 'wagmi'
import { cn } from '@/lib/cn'
import { ForgeCategory, ProjectStage, FORGE_CATEGORIES, PROJECT_STAGE_LABELS } from '@/lib/forge/types'
import { CATEGORY_ICON_MAP, CATEGORY_HEX } from './CategoryPill'
import { calculateForgeCompleteness } from '@/lib/forge/completeness'
import { serializeForgeProject } from '@/lib/forge/data'
import { registerForgeProjectBatch } from '@/lib/forge/chain'
import { createWriteConfig } from '@/lib/intuition'

const INTUITION_TESTNET_ID = 13579
import { CategoryPill } from './CategoryPill'
import type { ForgeProjectRegistrationInput } from '@/lib/forge/types'

const ALL_STAGES = Object.values(ProjectStage)

const STEP_LABELS = ['Basics', 'Details', 'Preview & List']

const EMPTY_FORM: ForgeProjectRegistrationInput = {
  name: '',
  tagline: '',
  description: '',
  category: ForgeCategory.AI_AGENTS,
  stage: ProjectStage.BUILDING,
  website: '',
  github: '',
  twitter: '',
  discord: '',
  demo: '',
  teamSize: undefined,
  isAnonymous: false,
  isOpenSource: false,
  usesFeeProxy: false,
  hasMCPServer: false,
  hasAPI: false,
  techStack: [],
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < current ? 'bg-amber-500/80' : i === current ? 'bg-amber-500' : 'bg-white/10',
          )}
          style={{ width: i === current ? 32 : 16 }}
        />
      ))}
      <span className="ml-2 text-xs text-white/30">
        Step {current + 1} of {total}: {STEP_LABELS[current]}
      </span>
    </div>
  )
}

function InputField({
  label, value, onChange, placeholder, maxLength, required, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-white/50">
        {label} {required && <span className="text-amber-500/80">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5',
          'text-sm text-white placeholder:text-white/20',
          'outline-none focus:border-white/20 transition-colors',
        )}
      />
      {maxLength && value.length > 0 && (
        <p className="text-[10px] text-white/20 text-right">
          {maxLength - value.length} characters remaining
        </p>
      )}
    </div>
  )
}

function TextareaField({
  label, value, onChange, placeholder, maxLength, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-white/50">
        {label} {required && <span className="text-amber-500/80">*</span>}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5',
          'text-sm text-white placeholder:text-white/20 resize-none',
          'outline-none focus:border-white/20 transition-colors',
        )}
      />
      {maxLength && value.length > 0 && (
        <p className="text-[10px] text-white/20 text-right">
          {maxLength - value.length} characters remaining
        </p>
      )}
    </div>
  )
}

function CheckboxField({
  label, checked, onChange, description,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  description?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        className={cn(
          'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
          checked ? 'bg-amber-500/80 border-amber-500' : 'border-white/20 bg-white/5 group-hover:border-white/30',
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && <span className="text-[10px] text-black font-bold">✓</span>}
      </div>
      <div>
        <span className="text-sm text-white/70">{label}</span>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({
  form,
  update,
}: {
  form: ForgeProjectRegistrationInput
  update: (k: keyof ForgeProjectRegistrationInput, v: unknown) => void
}) {
  return (
    <div className="space-y-5">
      <InputField
        label="Project Name"
        value={form.name}
        onChange={v => update('name', v)}
        placeholder="My Awesome Project"
        maxLength={80}
        required
      />
      <InputField
        label="Tagline"
        value={form.tagline}
        onChange={v => update('tagline', v)}
        placeholder="One line that explains what you're building"
        maxLength={100}
        required
      />
      <TextareaField
        label="Description"
        value={form.description}
        onChange={v => update('description', v)}
        placeholder="Tell the community more about your project, its goals and current status..."
        maxLength={500}
        required
      />

      {/* Category */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/50">
          Category <span className="text-amber-500/80">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FORGE_CATEGORIES.map(cat => {
            const selected = form.category === cat.id
            const Icon     = CATEGORY_ICON_MAP[cat.icon]
            const hex      = CATEGORY_HEX[cat.color] ?? CATEGORY_HEX['text-white/40']
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => update('category', cat.id)}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all duration-150',
                  selected ? 'border-white/20' : 'border-white/10 hover:border-white/20 hover:bg-white/5',
                )}
                style={selected ? {
                  background: `rgba(${hex.rgb},0.08)`,
                  borderColor: `rgba(${hex.rgb},0.35)`,
                  boxShadow: `0 0 12px rgba(${hex.rgb},0.08)`,
                } : {}}
              >
                {/* Icon square — matches Agents/Skills/Claims style */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `rgba(${hex.rgb},0.12)`,
                    border:    `1px solid rgba(${hex.rgb},0.28)`,
                    boxShadow: selected ? `0 0 14px rgba(${hex.rgb},0.20)` : `0 0 10px rgba(${hex.rgb},0.10)`,
                  }}
                >
                  {Icon && <Icon className="w-4 h-4" style={{ color: hex.text }} />}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate"
                    style={{ color: selected ? hex.text : 'rgba(255,255,255,0.75)' }}>
                    {cat.label}
                  </p>
                  <p className="text-[11px] leading-snug mt-0.5 line-clamp-1"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {cat.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Stage */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/50">
          Stage <span className="text-amber-500/80">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_STAGES.map(stage => (
            <button
              key={stage}
              type="button"
              onClick={() => update('stage', stage)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                form.stage === stage
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60',
              )}
            >
              {PROJECT_STAGE_LABELS[stage]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step2({
  form,
  update,
}: {
  form: ForgeProjectRegistrationInput
  update: (k: keyof ForgeProjectRegistrationInput, v: unknown) => void
}) {
  const [techInput, setTechInput] = useState('')

  function addTech() {
    const t = techInput.trim()
    if (!t || (form.techStack || []).includes(t)) return
    update('techStack', [...(form.techStack || []), t])
    setTechInput('')
  }

  function removeTech(tag: string) {
    update('techStack', (form.techStack || []).filter(t => t !== tag))
  }

  const completeness = calculateForgeCompleteness(form)
  const githubBoost = !form.github ? 10 : 0
  const demoBoost = !form.demo ? 10 : 0
  const boost = githubBoost + demoBoost

  return (
    <div className="space-y-6">
      {/* Links */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-white/25 mb-3">Links</p>
        <div className="space-y-3">
          <InputField label="Website" value={form.website || ''} onChange={v => update('website', v)} placeholder="https://yourproject.xyz" />
          <InputField label="GitHub" value={form.github || ''} onChange={v => update('github', v)} placeholder="github.com/yourorg/repo" />
          <InputField label="Twitter" value={form.twitter || ''} onChange={v => update('twitter', v)} placeholder="@handle" />
          <InputField label="Discord" value={form.discord || ''} onChange={v => update('discord', v)} placeholder="discord.gg/invite" />
          <InputField label="Demo" value={form.demo || ''} onChange={v => update('demo', v)} placeholder="https://demo.yourproject.xyz" />
        </div>
      </div>

      {/* Tech */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-white/25 mb-3">Tech</p>
        <div className="space-y-3">
          {/* Tech Stack */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/50">Tech Stack</label>
            <div className="flex gap-2">
              <input
                value={techInput}
                onChange={e => setTechInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTech())}
                placeholder="Next.js, TypeScript, ..."
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5',
                  'text-sm text-white placeholder:text-white/20',
                  'outline-none focus:border-white/20 transition-colors',
                )}
              />
              <button
                type="button"
                onClick={addTech}
                className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
              >
                + Add
              </button>
            </div>
            {(form.techStack || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form.techStack || []).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs text-white/60"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTech(tag)} className="text-white/30 hover:text-white/60">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Team size */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/50">Team Size</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.teamSize ?? ''}
              onChange={e => update('teamSize', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="3"
              className={cn(
                'w-24 px-3 py-2 rounded-lg border border-white/10 bg-white/5',
                'text-sm text-white placeholder:text-white/20',
                'outline-none focus:border-white/20 transition-colors',
              )}
            />
          </div>

          <CheckboxField
            label="Open Source"
            checked={form.isOpenSource}
            onChange={v => update('isOpenSource', v)}
          />
          <CheckboxField
            label="Anonymous Team"
            checked={form.isAnonymous}
            onChange={v => update('isAnonymous', v)}
          />
        </div>
      </div>

      {/* Intuition Integration */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-white/25 mb-3">Intuition Integration</p>
        <div className="space-y-3">
          <CheckboxField
            label="Uses FeeProxy"
            checked={form.usesFeeProxy}
            onChange={v => update('usesFeeProxy', v)}
            description="Your app routes transactions through the FeeProxy contract"
          />
          <CheckboxField
            label="Has MCP Server"
            checked={form.hasMCPServer}
            onChange={v => update('hasMCPServer', v)}
            description="AI agents can access your project via Model Context Protocol"
          />
          <CheckboxField
            label="Has REST API"
            checked={form.hasAPI}
            onChange={v => update('hasAPI', v)}
            description="Other projects can integrate programmatically"
          />
        </div>
      </div>

      {/* Hint */}
      {boost > 0 && (
        <div
          className="px-3 py-2.5 rounded-lg text-xs"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: 'rgba(147,197,253,0.7)' }}
        >
          💡 Adding {[!form.github && 'GitHub', !form.demo && 'Demo'].filter(Boolean).join(' and ')} boosts your Profile Completeness by {boost}%
        </div>
      )}

      <div className="text-xs text-white/30">Current completeness: {completeness.percentage}%</div>
    </div>
  )
}

function Step3({
  form,
  onSubmit,
  isSubmitting,
  progressMsg,
  error,
}: {
  form: ForgeProjectRegistrationInput
  onSubmit: () => void
  isSubmitting: boolean
  progressMsg?: string
  error?: string
}) {
  const completeness = calculateForgeCompleteness(form)

  return (
    <div className="space-y-6">
      {/* Preview Card */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-white/25 mb-3">Preview</p>
        <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] space-y-2">
          <div className="flex items-center gap-2">
            <CategoryPill category={form.category} size="sm" />
            <span className="text-xs text-white/30">{PROJECT_STAGE_LABELS[form.stage]}</span>
          </div>
          <h3 className="font-semibold text-white">{form.name || 'Project Name'}</h3>
          <p className="text-xs text-white/40 leading-relaxed">{form.tagline || 'Your tagline'}</p>
          {(form.techStack || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(form.techStack || []).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/30 border border-white/8">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completeness */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/40">Profile Completeness</span>
          <span className="text-sm font-bold" style={{ color: '#C8963C' }}>{completeness.percentage}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${completeness.percentage}%`, background: '#C8963C' }}
          />
        </div>
        {completeness.suggestions.length > 0 && (
          <p className="mt-1.5 text-[11px] text-amber-400/60">
            💡 {completeness.suggestions[0]}
          </p>
        )}
      </div>

      {/* Listing details */}
      <div
        className="p-4 rounded-xl space-y-3"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-white/25">Listing Details</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">Registration</span>
            <span className="text-emerald-400 font-medium">FREE (protocol gas only)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Staking fee</span>
            <span className="text-white/60">2.5% on community stakes</span>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 space-y-1.5">
          <p className="text-xs font-medium text-white/40 mb-2">What happens next:</p>
          {[
            'Project appears on IntuForge',
            'Community can stake tTRUST on your project',
            'Trust Score builds over time',
            'Evaluator-weighted anti-manipulation scoring',
          ].map(item => (
            <div key={item} className="flex items-start gap-2 text-xs text-white/50">
              <span className="text-emerald-400 shrink-0">✓</span>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={isSubmitting || !form.name || !form.tagline || !form.description}
        className={cn(
          'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
          isSubmitting || !form.name || !form.tagline || !form.description
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:scale-[1.01]',
        )}
        style={{
          background: 'rgba(200,150,60,0.15)',
          border: '1px solid rgba(200,150,60,0.35)',
          color: '#C8963C',
        }}
      >
        {isSubmitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
          : 'List Project'
        }
      </button>

      {isSubmitting && progressMsg && (
        <p className="text-center text-xs" style={{ color: 'rgba(200,150,60,0.7)' }}>
          {progressMsg}
        </p>
      )}

      {error && (
        <p className="text-center text-xs" style={{ color: '#EF4444' }}>
          {error}
        </p>
      )}

      <p className="text-center text-[11px] text-white/20">
        By listing, you agree to IntuForge Terms. Registration is free on Intuition Testnet.
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProjectRegistrationForm() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const chainId = useChainId()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<ForgeProjectRegistrationInput>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [error, setError] = useState('')

  function update(key: keyof ForgeProjectRegistrationInput, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function canProceedStep1() {
    return form.name.trim().length > 0 && form.tagline.trim().length > 0 && form.description.trim().length > 0
  }

  async function handleSubmit() {
    if (!isConnected || !walletClient || !publicClient) {
      setError('Connect your wallet to Intuition Testnet first.')
      return
    }

    if (!walletClient.account) {
      setError('Wallet account not available. Please disconnect and reconnect.')
      return
    }

    if (chainId !== INTUITION_TESTNET_ID) {
      setError(`Wrong network. Please switch to Intuition Testnet (chain ID ${INTUITION_TESTNET_ID}). Currently on chain ${chainId}.`)
      return
    }

    setIsSubmitting(true)
    setError('')
    setProgressMsg('Preparing registration…')

    try {
      const metadataJson  = serializeForgeProject(form)
      const categoryDef   = FORGE_CATEGORIES.find(c => c.id === form.category)
      const categoryLabel = categoryDef?.label ?? form.category
      const cfg           = createWriteConfig(walletClient, publicClient)

      console.log('[ForgeRegistration] Starting registration', { name: form.name, categoryLabel, chainId })

      // Up to 3 txs: Tx0 (one-time approval), Tx1 batch atoms (name + metadata),
      // Tx2 batch triples ([is], [related to], [hasForgeCategory])
      const { termId } = await registerForgeProjectBatch(
        cfg,
        form.name,
        metadataJson,
        categoryLabel,
        undefined,
        setProgressMsg,
      )

      console.log('[ForgeRegistration] Success, termId:', termId)
      setProgressMsg('Project registered! Redirecting…')
      router.push(`/explore/intuforge/${termId}?new=1`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed. Please try again.'
      console.error('[ForgeRegistration] Failed:', err)
      setError(msg)
      setIsSubmitting(false)
      setProgressMsg('')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <StepIndicator current={step} total={3} />

      {step === 0 && <Step1 form={form} update={update} />}
      {step === 1 && <Step2 form={form} update={update} />}
      {step === 2 && (
        <Step3
          form={form}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          progressMsg={progressMsg}
          error={error}
        />
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
          >
            ← Back
          </button>
        )}
        {step < 2 && (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && !canProceedStep1()}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
              step === 0 && !canProceedStep1()
                ? 'opacity-30 cursor-not-allowed border border-white/10 text-white/40'
                : 'hover:scale-[1.01]',
            )}
            style={
              step === 0 && !canProceedStep1()
                ? {}
                : { background: 'rgba(200,150,60,0.1)', border: '1px solid rgba(200,150,60,0.25)', color: '#C8963C' }
            }
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
