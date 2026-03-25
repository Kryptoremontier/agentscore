'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Check, ChevronRight, ChevronLeft, Sparkles, Loader2, AlertCircle,
  Flame, HeartHandshake, TrendingUp, Link2, ArrowLeftRight, Swords,
  ShieldCheck, BadgeCheck, MessageSquare,
} from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { cn } from '@/lib/cn'
import { PREDICATES, type PredicateConfig, getAtomName } from '@/types/claim'
import { APP_CONFIG } from '@/lib/app-config'
import { AGENT_WHERE_STR, SKILL_WHERE_STR } from '@/lib/gql-filters'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

// ── Triple colors ───────────────────────────────────────────────────────────
const COLORS = {
  subject:   { text: '#C8963C', bg: 'rgba(200,150,60,0.12)', border: 'rgba(200,150,60,0.30)', glow: 'rgba(200,150,60,0.06)' },
  predicate: { text: '#2EE6D6', bg: 'rgba(46,230,214,0.10)', border: 'rgba(46,230,214,0.28)', glow: 'rgba(46,230,214,0.05)' },
  object:    { text: '#38B6FF', bg: 'rgba(56,182,255,0.10)', border: 'rgba(56,182,255,0.28)', glow: 'rgba(56,182,255,0.05)' },
} as const

// ── Lucide icon map for predicates ──────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame, HeartHandshake, TrendingUp, Link: Link2, Sparkles,
  ArrowLeftRight, Swords, ShieldCheck, BadgeCheck, MessageSquare,
}

function PredIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] || Sparkles
  return <span style={style}><Icon className={className} /></span>
}

// ── Data fetching ───────────────────────────────────────────────────────────
interface AtomResult {
  term_id: string
  label: string
  created_at: string
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

async function fetchAtoms(prefix: 'Agent' | 'Skill', search = ''): Promise<AtomResult[]> {
  // Use the same semantic filter as the main agents/skills pages —
  // catches both prefixed labels AND atoms identified via type triples.
  const baseWhere = prefix === 'Agent' ? AGENT_WHERE_STR : SKILL_WHERE_STR
  const conditions = [baseWhere]
  if (search.trim()) conditions.push(`{ label: { _ilike: "%${search.trim()}%" } }`)
  const where = conditions.length > 1
    ? `{ _and: [${conditions.join(', ')}] }`
    : baseWhere
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query FetchAtoms { atoms(where: ${where} order_by: { created_at: desc } limit: 50) { term_id label created_at positions_aggregate { aggregate { count sum { shares } } } } }`,
    }),
  })
  const data = await res.json()
  return data.data?.atoms ?? []
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  onSuccess: (claimTermId: string) => void
  onClose: () => void
}

type Step = 1 | 2 | 3

export function CreateClaimForm({ onSuccess, onClose }: Props) {
  const { address, isConnected, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const isWrongChain = isConnected && chain?.id !== intuitionTestnet.id
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [step, setStep] = useState<Step>(1)

  // Subject
  const [subjectTab, setSubjectTab] = useState<'Agent' | 'Skill'>('Agent')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectAtoms, setSubjectAtoms] = useState<AtomResult[]>([])
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<AtomResult | null>(null)

  // Predicate
  const [selectedPredicate, setSelectedPredicate] = useState<PredicateConfig | null>(null)
  const [customPredicate, setCustomPredicate] = useState('')

  // Object
  const [objectTab, setObjectTab] = useState<'Agent' | 'Skill'>('Skill')
  const [objectSearch, setObjectSearch] = useState('')
  const [objectAtoms, setObjectAtoms] = useState<AtomResult[]>([])
  const [objectLoading, setObjectLoading] = useState(false)
  const [selectedObject, setSelectedObject] = useState<AtomResult | null>(null)

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitProgress, setSubmitProgress] = useState<string | null>(null)

  // ── Load atoms ──
  const loadSubjectAtoms = useCallback(async (prefix: 'Agent' | 'Skill', search: string) => {
    setSubjectLoading(true)
    try { setSubjectAtoms(await fetchAtoms(prefix, search)) } finally { setSubjectLoading(false) }
  }, [])

  useEffect(() => {
    if (step !== 1) return
    const t = setTimeout(() => loadSubjectAtoms(subjectTab, subjectSearch), 300)
    return () => clearTimeout(t)
  }, [subjectTab, subjectSearch, step, loadSubjectAtoms])

  const loadObjectAtoms = useCallback(async (prefix: 'Agent' | 'Skill', search: string) => {
    setObjectLoading(true)
    try { setObjectAtoms(await fetchAtoms(prefix, search)) } finally { setObjectLoading(false) }
  }, [])

  useEffect(() => {
    if (step !== 3) return
    const t = setTimeout(() => loadObjectAtoms(objectTab, objectSearch), 300)
    return () => clearTimeout(t)
  }, [objectTab, objectSearch, step, loadObjectAtoms])

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedSubject || !selectedPredicate || !selectedObject) return
    const predicateLabel = selectedPredicate.id === 'custom' ? customPredicate.trim() : selectedPredicate.atomLabel
    if (!predicateLabel) return

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitProgress('Preparing...')
    try {
      const { getWalletClient } = await import('@wagmi/core')
      const { config: wagmiConfig } = await import('@/lib/wagmi')
      const freshWalletClient = walletClient ?? await getWalletClient(wagmiConfig)
      if (!freshWalletClient || !publicClient) throw new Error('Wallet not connected')
      const { createWriteConfig, createTripleClaim } = await import('@/lib/intuition')
      const cfg = createWriteConfig(freshWalletClient, publicClient)
      const result = await createTripleClaim(
        cfg,
        selectedSubject.term_id as `0x${string}`,
        predicateLabel,
        selectedObject.term_id as `0x${string}`,
        (step) => setSubmitProgress(step),
      )
      onSuccess(result.termId)
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to create claim')
    } finally {
      setIsSubmitting(false)
      setSubmitProgress(null)
    }
  }

  const predicateLabel = selectedPredicate?.id === 'custom'
    ? customPredicate || 'custom'
    : selectedPredicate?.label ?? ''

  const canProceedStep1 = !!selectedSubject
  const canProceedStep2 = !!selectedPredicate && (selectedPredicate.id !== 'custom' || customPredicate.trim().length >= 2)
  const sameItem = selectedSubject && selectedObject && selectedSubject.term_id === selectedObject.term_id
  const canSubmit = !!selectedSubject && !!selectedPredicate && !!selectedObject && !sameItem && canProceedStep2

  // ── Render helpers ──
  function TripleBuilder() {
    return (
      <div className="flex items-center gap-1.5 flex-wrap mb-6 p-3 rounded-xl" style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Subject */}
        <TriplePill
          role="subject"
          label={selectedSubject ? getAtomName(selectedSubject.label) : 'Subject'}
          filled={!!selectedSubject}
          active={step === 1}
          onClick={() => step > 1 && setStep(1)}
        />
        {/* Arrow */}
        <ChevronRight className="w-3.5 h-3.5 text-[#3A3F47] shrink-0" />
        {/* Predicate */}
        <TriplePill
          role="predicate"
          label={selectedPredicate ? predicateLabel : 'Relationship'}
          filled={!!selectedPredicate}
          active={step === 2}
          onClick={() => step > 2 && setStep(2)}
          predColor={selectedPredicate?.color}
        />
        {/* Arrow */}
        <ChevronRight className="w-3.5 h-3.5 text-[#3A3F47] shrink-0" />
        {/* Object */}
        <TriplePill
          role="object"
          label={selectedObject ? getAtomName(selectedObject.label) : 'Object'}
          filled={!!selectedObject}
          active={step === 3}
        />
      </div>
    )
  }

  function TriplePill({ role, label, filled, active, onClick, predColor }: {
    role: 'subject' | 'predicate' | 'object'
    label: string
    filled: boolean
    active: boolean
    onClick?: () => void
    predColor?: string
  }) {
    const c = COLORS[role]
    const color = role === 'predicate' && predColor ? predColor : c.text
    const bg = role === 'predicate' && predColor ? predColor + '15' : c.bg
    const border = role === 'predicate' && predColor ? predColor + '35' : c.border
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'px-2.5 py-1 rounded-lg text-xs font-semibold truncate max-w-[140px] transition-all',
          active && 'ring-1 ring-offset-1 ring-offset-[#0F1113]',
          !filled && 'opacity-40',
        )}
        style={{
          background: bg,
          border: `1px solid ${border}`,
          color: color,
          ...(active ? { ringColor: color } : {}),
        }}
      >
        {label}
      </button>
    )
  }

  function AtomList({ atoms, loading, selectedId, subjectId, tab, onSelect }: {
    atoms: AtomResult[]
    loading: boolean
    selectedId?: string
    subjectId?: string
    tab: 'Agent' | 'Skill'
    onSelect: (a: AtomResult) => void
  }) {
    if (loading) return (
      <div className="flex items-center justify-center py-8 text-[#7A838D] text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
      </div>
    )
    if (atoms.length === 0) return (
      <p className="text-center text-[#4A5260] text-sm py-8">No {tab.toLowerCase()}s found</p>
    )
    return (
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
        {atoms.map(atom => {
          const name = getAtomName(atom.label)
          const selected = selectedId === atom.term_id
          const isSame = subjectId === atom.term_id
          const stakers = atom.positions_aggregate?.aggregate?.count ?? 0
          return (
            <button
              key={atom.term_id}
              onClick={() => !isSame && onSelect(atom)}
              disabled={isSame}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                isSame ? 'opacity-25 cursor-not-allowed' :
                selected ? 'ring-1' : 'hover:bg-white/[0.04]',
              )}
              style={{
                background: selected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: selected ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.04)',
                ...(selected ? { ringColor: 'rgba(255,255,255,0.2)' } : {}),
              }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: tab === 'Agent' ? COLORS.subject.bg : 'rgba(74,222,128,0.10)', color: tab === 'Agent' ? COLORS.subject.text : '#4ADE80' }}>
                {tab === 'Agent' ? 'A' : 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[#E8E8E8] truncate block">{name}</span>
                {stakers > 0 && <span className="text-[10px] text-[#4A5260]">{stakers} staker{stakers !== 1 ? 's' : ''}</span>}
              </div>
              {isSame && <span className="text-[10px] text-[#4A5260]">= subject</span>}
              {selected && !isSame && <Check className="w-4 h-4 text-white/60 shrink-0" />}
            </button>
          )
        })}
      </div>
    )
  }

  function TabSwitch({ value, onChange }: { value: 'Agent' | 'Skill'; onChange: (v: 'Agent' | 'Skill') => void }) {
    return (
      <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {(['Agent', 'Skill'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-medium transition-all',
              value === tab ? 'text-white' : 'text-[#7A838D] hover:text-[#B5BDC6]'
            )}
            style={value === tab ? { background: 'rgba(255,255,255,0.08)' } : {}}
          >
            {tab === 'Agent' ? 'Agents' : 'Skills'}
          </button>
        ))}
      </div>
    )
  }

  // ── Main render ──
  return (
    <div className="max-w-xl mx-auto">
      {/* Triple builder — always visible */}
      <TripleBuilder />

      {/* Steps */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <AnimatePresence mode="wait">

          {/* ── STEP 1: Subject ── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: COLORS.subject.bg, color: COLORS.subject.text, border: `1px solid ${COLORS.subject.border}` }}>1</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Choose Subject</h3>
                  <p className="text-[11px] text-[#7A838D]">Select an Agent or Skill</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <TabSwitch value={subjectTab} onChange={v => { setSubjectTab(v); setSelectedSubject(null) }} />
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5260]" />
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={e => setSubjectSearch(e.target.value)}
                    placeholder={`Search...`}
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8E8E8' }}
                  />
                </div>
              </div>

              <AtomList atoms={subjectAtoms} loading={subjectLoading} selectedId={selectedSubject?.term_id} tab={subjectTab} onSelect={setSelectedSubject} />

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: canProceedStep1 ? COLORS.subject.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${canProceedStep1 ? COLORS.subject.border : 'rgba(255,255,255,0.06)'}`, color: canProceedStep1 ? COLORS.subject.text : '#4A5260' }}
              >
                Next: Relationship <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── STEP 2: Predicate ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: COLORS.predicate.bg, color: COLORS.predicate.text, border: `1px solid ${COLORS.predicate.border}` }}>2</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Choose Relationship</h3>
                  <p className="text-[11px] text-[#7A838D]">
                    How does <span style={{ color: COLORS.subject.text }} className="font-medium">{getAtomName(selectedSubject?.label ?? '')}</span> relate?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {PREDICATES.filter(p => p.id !== 'custom').map(pred => {
                  const selected = selectedPredicate?.id === pred.id
                  return (
                    <button
                      key={pred.id}
                      onClick={() => setSelectedPredicate(pred)}
                      className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all')}
                      style={{
                        background: selected ? pred.color + '15' : 'rgba(255,255,255,0.02)',
                        border: selected ? `1px solid ${pred.color}40` : '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <PredIcon name={pred.icon} className="w-4 h-4 shrink-0" style={{ color: selected ? pred.color : '#7A838D' }} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: selected ? pred.color : '#B5BDC6' }}>{pred.label}</div>
                        <div className="text-[9px] text-[#4A5260] truncate">{pred.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Custom option */}
              <button
                onClick={() => setSelectedPredicate(PREDICATES.find(p => p.id === 'custom')!)}
                className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all mb-3')}
                style={{
                  background: selectedPredicate?.id === 'custom' ? 'rgba(107,114,128,0.15)' : 'rgba(255,255,255,0.02)',
                  border: selectedPredicate?.id === 'custom' ? '1px solid rgba(107,114,128,0.35)' : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#7A838D] shrink-0" />
                <span className="text-xs text-[#7A838D]">Custom predicate...</span>
              </button>

              {selectedPredicate?.id === 'custom' && (
                <input
                  type="text"
                  value={customPredicate}
                  onChange={e => setCustomPredicate(e.target.value)}
                  placeholder="e.g. isCompatibleWith"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8E8E8' }}
                  autoFocus
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A838D' }}
                >
                  <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: canProceedStep2 ? COLORS.predicate.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${canProceedStep2 ? COLORS.predicate.border : 'rgba(255,255,255,0.06)'}`, color: canProceedStep2 ? COLORS.predicate.text : '#4A5260' }}
                >
                  Next: Object <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Object + Review ── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: COLORS.object.bg, color: COLORS.object.text, border: `1px solid ${COLORS.object.border}` }}>3</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Choose Object & Submit</h3>
                  <p className="text-[11px] text-[#7A838D]">What does the relationship point to?</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <TabSwitch value={objectTab} onChange={v => { setObjectTab(v); setSelectedObject(null) }} />
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5260]" />
                  <input
                    type="text"
                    value={objectSearch}
                    onChange={e => setObjectSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8E8E8' }}
                  />
                </div>
              </div>

              <AtomList
                atoms={objectAtoms}
                loading={objectLoading}
                selectedId={selectedObject?.term_id}
                subjectId={selectedSubject?.term_id}
                tab={objectTab}
                onSelect={setSelectedObject}
              />

              {/* Cost + info */}
              <div className="flex items-start gap-2.5 mt-4 p-3 rounded-xl text-[11px] text-[#7A838D] leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C8963C]" />
                <span>
                  Creates a <strong className="text-[#B5BDC6]">Triple</strong> on Intuition Protocol.{' '}
                  {selectedPredicate?.id === 'custom'
                    ? 'Custom predicate may require 2 transactions (create predicate + create triple).'
                    : '1 transaction — predicate already registered on-chain.'
                  }{' '}Cost ~0.02 tTRUST + platform fee.
                </span>
              </div>

              {submitError && (
                <div className="mt-3 p-3 rounded-xl text-xs text-[#F87171]"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)' }}>
                  {submitError}
                </div>
              )}

              {mounted && !isConnected && (
                <div className="mt-3 p-3 rounded-xl text-xs text-[#FBBF24]"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
                  Connect your wallet to create claims
                </div>
              )}

              {mounted && isWrongChain && (
                <div className="mt-3 p-3 rounded-xl text-xs text-[#FBBF24]"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
                  Switch to Intuition Testnet to create claims
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A838D' }}
                >
                  <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting || (mounted && (!isConnected || isWrongChain))}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: canSubmit ? 'linear-gradient(135deg, #C8963C, #C9A84C)' : 'rgba(255,255,255,0.04)',
                    border: canSubmit ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    color: canSubmit ? '#0F1113' : '#4A5260',
                  }}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {submitProgress || 'Creating on-chain...'}</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Create Claim</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
