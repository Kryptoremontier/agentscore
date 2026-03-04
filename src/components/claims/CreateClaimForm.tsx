'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Check, ChevronRight, Sparkles, Loader2, X, AlertCircle } from 'lucide-react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { intuitionTestnet } from '@0xintuition/protocol'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { PREDICATES, type PredicateConfig, getAtomName, getAtomType } from '@/types/claim'

import { APP_CONFIG } from '@/lib/app-config'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

interface AtomResult {
  term_id: string
  label: string
  created_at: string
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
}

async function fetchAtoms(prefix: 'Agent' | 'Skill', search = ''): Promise<AtomResult[]> {
  const resolvedPrefix = prefix === 'Agent' ? APP_CONFIG.AGENT_PREFIX : APP_CONFIG.SKILL_PREFIX
  const conditions = [`{ label: { _ilike: "${resolvedPrefix}%" } }`]
  if (search.trim()) conditions.push(`{ label: { _ilike: "%${search.trim()}%" } }`)
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query FetchAtoms {
          atoms(
            where: { _and: [${conditions.join(', ')}] }
            order_by: { created_at: desc }
            limit: 20
          ) {
            term_id label created_at
            positions_aggregate { aggregate { count sum { shares } } }
          }
        }
      `,
    }),
  })
  const data = await res.json()
  return data.data?.atoms ?? []
}

interface CreateClaimFormProps {
  onSuccess: (claimTermId: string) => void
  onClose: () => void
}

type Step = 1 | 2 | 3

export function CreateClaimForm({ onSuccess, onClose }: CreateClaimFormProps) {
  const { address, isConnected, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const isWrongChain = isConnected && chain?.id !== intuitionTestnet.id
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ─── Step state ───
  const [step, setStep] = useState<Step>(1)

  // ─── Subject ───
  const [subjectTab, setSubjectTab] = useState<'Agent' | 'Skill'>('Agent')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectAtoms, setSubjectAtoms] = useState<AtomResult[]>([])
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<AtomResult | null>(null)

  // ─── Predicate ───
  const [selectedPredicate, setSelectedPredicate] = useState<PredicateConfig | null>(null)
  const [customPredicate, setCustomPredicate] = useState('')

  // ─── Object ───
  const [objectTab, setObjectTab] = useState<'Agent' | 'Skill'>('Skill')
  const [objectSearch, setObjectSearch] = useState('')
  const [objectAtoms, setObjectAtoms] = useState<AtomResult[]>([])
  const [objectLoading, setObjectLoading] = useState(false)
  const [selectedObject, setSelectedObject] = useState<AtomResult | null>(null)

  // ─── Submit ───
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ─── Load subject atoms ───
  const loadSubjectAtoms = useCallback(async (prefix: 'Agent' | 'Skill', search: string) => {
    setSubjectLoading(true)
    try {
      const atoms = await fetchAtoms(prefix, search)
      setSubjectAtoms(atoms)
    } finally {
      setSubjectLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step !== 1) return
    const t = setTimeout(() => loadSubjectAtoms(subjectTab, subjectSearch), 300)
    return () => clearTimeout(t)
  }, [subjectTab, subjectSearch, step, loadSubjectAtoms])

  // ─── Load object atoms ───
  const loadObjectAtoms = useCallback(async (prefix: 'Agent' | 'Skill', search: string) => {
    setObjectLoading(true)
    try {
      const atoms = await fetchAtoms(prefix, search)
      setObjectAtoms(atoms)
    } finally {
      setObjectLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step !== 3) return
    const t = setTimeout(() => loadObjectAtoms(objectTab, objectSearch), 300)
    return () => clearTimeout(t)
  }, [objectTab, objectSearch, step, loadObjectAtoms])

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!selectedSubject || !selectedPredicate || !selectedObject) return
    const predicateLabel = selectedPredicate.id === 'custom'
      ? customPredicate.trim()
      : selectedPredicate.atomLabel
    if (!predicateLabel) return

    setIsSubmitting(true)
    setSubmitError(null)
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
      )
      onSuccess(result.termId)
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to create claim')
    } finally {
      setIsSubmitting(false)
    }
  }

  const predicateLabel = selectedPredicate?.id === 'custom'
    ? customPredicate || 'custom predicate'
    : selectedPredicate?.label ?? ''

  const canProceedStep1 = !!selectedSubject
  const canProceedStep2 = !!selectedPredicate && (selectedPredicate.id !== 'custom' || customPredicate.trim().length >= 2)
  const sameItem = selectedSubject && selectedObject && selectedSubject.term_id === selectedObject.term_id
  const canSubmit = !!selectedSubject && !!selectedPredicate && !!selectedObject && !sameItem && canProceedStep2

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center mb-8">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                step > s ? 'bg-emerald-500 text-white' :
                step === s ? 'bg-primary text-white' :
                'bg-white/10 text-slate-500'
              )}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={cn(
                'text-sm font-medium hidden sm:inline',
                step === s ? 'text-white' : 'text-slate-500'
              )}>
                {s === 1 ? 'Subject' : s === 2 ? 'Relationship' : 'Object & Review'}
              </span>
            </div>
            {i < 2 && (
              <div className={cn('flex-1 h-px mx-3', step > s ? 'bg-emerald-500' : 'bg-white/10')} />
            )}
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-6 sm:p-8">
        <AnimatePresence mode="wait">

          {/* ── STEP 1: Subject ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div>
                <h3 className="text-xl font-semibold mb-1">Choose Subject</h3>
                <p className="text-sm text-slate-400">Select an Agent or Skill as the subject of this claim</p>
              </div>

              {/* Tab switch */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/10 w-fit">
                {(['Agent', 'Skill'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setSubjectTab(tab); setSelectedSubject(null) }}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                      subjectTab === tab ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {tab === 'Agent' ? '🤖' : '⚡'} {tab}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                  placeholder={`Search ${subjectTab}s...`}
                  className="w-full pl-9 pr-4 py-2.5 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
                />
              </div>

              {/* Results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {subjectLoading ? (
                  <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                  </div>
                ) : subjectAtoms.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-6">No {subjectTab}s found</p>
                ) : subjectAtoms.map(atom => {
                  const name = getAtomName(atom.label)
                  const selected = selectedSubject?.term_id === atom.term_id
                  return (
                    <button
                      key={atom.term_id}
                      onClick={() => setSelectedSubject(atom)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                        selected ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <span className="text-lg">{subjectTab === 'Agent' ? '🤖' : '⚡'}</span>
                      <span className="font-medium text-sm flex-1 truncate">{name}</span>
                      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {selectedSubject && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-medium">Selected:</span>
                  <span className="text-white truncate">{getAtomName(selectedSubject.label)}</span>
                </div>
              )}

              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full">
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* ── STEP 2: Predicate ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div>
                <h3 className="text-xl font-semibold mb-1">Choose Relationship</h3>
                <p className="text-sm text-slate-400">
                  How does <span className="text-indigo-400 font-medium">{getAtomName(selectedSubject?.label ?? '')}</span> relate to the other?
                </p>
              </div>

              <div className="space-y-2">
                {PREDICATES.map(pred => {
                  const selected = selectedPredicate?.id === pred.id
                  return (
                    <button
                      key={pred.id}
                      onClick={() => setSelectedPredicate(pred)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                        selected
                          ? 'ring-2'
                          : 'bg-white/5 hover:bg-white/10'
                      )}
                      style={selected ? {
                        backgroundColor: pred.color + '18',
                        border: `2px solid ${pred.color}40`,
                      } as any : {}}
                    >
                      <span className="text-lg w-7 text-center">{pred.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm" style={{ color: selected ? pred.color : undefined }}>
                          {pred.label}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{pred.description}</div>
                      </div>
                      {selected && <Check className="w-4 h-4 shrink-0" style={{ color: pred.color }} />}
                    </button>
                  )
                })}
              </div>

              {/* Custom predicate input */}
              {selectedPredicate?.id === 'custom' && (
                <input
                  type="text"
                  value={customPredicate}
                  onChange={e => setCustomPredicate(e.target.value)}
                  placeholder="e.g. isCompatibleWith, integrates_with..."
                  className="w-full px-4 py-2.5 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
                />
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="flex-1">
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Object + Review ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div>
                <h3 className="text-xl font-semibold mb-1">Choose Object & Review</h3>
                <p className="text-sm text-slate-400">Select what the relationship points to</p>
              </div>

              {/* Tab switch */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/10 w-fit">
                {(['Agent', 'Skill'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setObjectTab(tab); setSelectedObject(null) }}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                      objectTab === tab ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {tab === 'Agent' ? '🤖' : '⚡'} {tab}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={objectSearch}
                  onChange={e => setObjectSearch(e.target.value)}
                  placeholder={`Search ${objectTab}s...`}
                  className="w-full pl-9 pr-4 py-2.5 glass rounded-lg border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
                />
              </div>

              {/* Results */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {objectLoading ? (
                  <div className="flex items-center justify-center py-4 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                  </div>
                ) : objectAtoms.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-4">No {objectTab}s found</p>
                ) : objectAtoms.map(atom => {
                  const name = getAtomName(atom.label)
                  const selected = selectedObject?.term_id === atom.term_id
                  const isSame = selectedSubject?.term_id === atom.term_id
                  return (
                    <button
                      key={atom.term_id}
                      onClick={() => !isSame && setSelectedObject(atom)}
                      disabled={isSame}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                        isSame ? 'opacity-30 cursor-not-allowed bg-white/5' :
                        selected ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <span className="text-lg">{objectTab === 'Agent' ? '🤖' : '⚡'}</span>
                      <span className="font-medium text-sm flex-1 truncate">{name}</span>
                      {isSame && <span className="text-xs text-slate-500">same as subject</span>}
                      {selected && !isSame && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* Preview */}
              {selectedSubject && selectedPredicate && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-medium">Preview</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-sm font-semibold">
                      {subjectTab === 'Agent' ? '🤖' : '⚡'} {getAtomName(selectedSubject.label)}
                    </span>
                    <span className="px-3 py-1.5 rounded-lg text-sm font-semibold border"
                      style={{
                        backgroundColor: (selectedPredicate.color) + '15',
                        borderColor: (selectedPredicate.color) + '30',
                        color: selectedPredicate.color,
                      }}>
                      {selectedPredicate.icon} {predicateLabel}
                    </span>
                    {selectedObject ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
                        {objectTab === 'Agent' ? '🤖' : '⚡'} {getAtomName(selectedObject.label)}
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-sm">
                        ? (select above)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Cost notice */}
              <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                Creates up to 2 on-chain transactions: predicate atom (if new) + triple. Cost ~0.02 tTRUST.
              </div>

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {submitError}
                </div>
              )}

              {mounted && !isConnected && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400">
                  Connect your wallet to create claims
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>Back</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting || (mounted && !isConnected)}
                  className="flex-1 glow-blue"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating on-chain...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Create Claim</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
