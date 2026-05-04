'use client'

/**
 * Admin → Predicates registry.
 *
 * TESTNET TAB — register any of the 16 predicates on testnet for development.
 * MAINNET TAB — status tracker for the 5 launch-scope predicates. Registration
 * is done manually on https://portal.intuition.systems per docs/MAINNET_PREDICATES.md.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import Link from 'next/link'
import {
  CheckCircle2, XCircle, Loader2, ExternalLink, Plus, ShieldAlert,
  RefreshCw, ChevronRight, Code2, Copy, AlertTriangle,
} from 'lucide-react'
import { stringToHex, type Hex } from 'viem'
import { calculateAtomId as sdkCalculateAtomId } from '@0xintuition/sdk'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/lib/app-config'
import { createSimpleAtom, createWriteConfig } from '@/lib/intuition'
import {
  PREDICATE_INVENTORY,
  LAUNCH_PREDICATES,
  groupedInventory,
  activeLabel,
  buildPredicateJsonLd,
  type PredicateEntry,
  type PredicateGroup,
} from '@/lib/predicate-inventory'

const NETWORK = process.env['NEXT_PUBLIC_NETWORK'] ?? 'testnet'

// ─── Shared types ────────────────────────────────────────────────────────────

interface PredicateStatus {
  termId?: string
  registered: boolean
  loading: boolean
  txHash?: string
  error?: string
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function computeJsonLdTermId(jsonLd: string): `0x${string}` {
  return sdkCalculateAtomId(stringToHex(jsonLd) as Hex) as `0x${string}`
}

async function fetchExistingAtoms(
  termIds: string[],
  labels: string[],
): Promise<{ termIdSet: Set<string>; labelMap: Map<string, string> }> {
  const termIdsJson = JSON.stringify(termIds)
  const labelsJson = JSON.stringify(labels)

  const query = `{
    byTermId: atoms(where: { term_id: { _in: ${termIdsJson} } }) { term_id }
    byLabel:  atoms(where: { label:   { _in: ${labelsJson} } }) { term_id label }
  }`

  const res = await fetch(APP_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) throw new Error(`Hasura ${res.status}`)
  const json = await res.json()
  if (json?.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')

  const termIdSet = new Set<string>(
    (json?.data?.byTermId ?? []).map((a: { term_id: string }) => a.term_id),
  )
  const labelMap = new Map<string, string>()
  for (const a of json?.data?.byLabel ?? []) {
    if (!labelMap.has(a.label)) labelMap.set(a.label, a.term_id)
  }
  return { termIdSet, labelMap }
}

// ─── Testnet tab ─────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<PredicateGroup, { title: string; subtitle: string; color: string }> = {
  core:         { title: 'Core',         subtitle: 'Power scoring, trust attestations', color: '#C8963C' },
  capability:   { title: 'Capability',   subtitle: 'Certifications & qualifications',   color: '#2ECC71' },
  relationship: { title: 'Relationship', subtitle: 'Discovery between agents',          color: '#2EE6D6' },
  opinion:      { title: 'Opinion',      subtitle: 'Stakeable community sentiment',     color: '#38B6FF' },
  attestation:  { title: 'Attestation',  subtitle: 'Identity verification & vouches',   color: '#A78BFA' },
  report:       { title: 'Report',       subtitle: 'Moderation & abuse reporting',      color: '#EF4444' },
}

function TestnetTabContent() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [statuses, setStatuses] = useState<Record<string, PredicateStatus>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [savedTermIds, setSavedTermIds] = useState<Record<string, string>>({})
  const [termIdInputs, setTermIdInputs] = useState<Record<string, string>>({})

  const explorerBase = 'https://testnet.explorer.intuition.systems'

  useEffect(() => {
    const saved: Record<string, string> = {}
    for (const entry of PREDICATE_INVENTORY) {
      const v = localStorage.getItem(`testnet_termid_${entry.key}`)
      if (v) saved[entry.key] = v
    }
    setSavedTermIds(saved)
  }, [])

  const handleSaveTermId = (key: string) => {
    const val = termIdInputs[key]?.trim()
    if (!val) return
    localStorage.setItem(`testnet_termid_${key}`, val)
    setSavedTermIds(prev => ({ ...prev, [key]: val }))
    setTermIdInputs(prev => ({ ...prev, [key]: '' }))
  }

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    const updates: Record<string, PredicateStatus> = {}

    const expectedByKey = new Map<string, string>()
    const labelByKey = new Map<string, string>()
    const allTermIds: string[] = []
    const allLabels: string[] = []

    for (const entry of PREDICATE_INVENTORY) {
      const jsonLd = buildPredicateJsonLd(entry)
      const tid = computeJsonLdTermId(jsonLd)
      const lbl = activeLabel(entry)
      expectedByKey.set(entry.key, tid)
      labelByKey.set(entry.key, lbl)
      allTermIds.push(tid)
      allLabels.push(lbl)
    }

    try {
      const { termIdSet, labelMap } = await fetchExistingAtoms(allTermIds, allLabels)
      for (const entry of PREDICATE_INVENTORY) {
        const expected = expectedByKey.get(entry.key)!
        const fallbackLabel = labelByKey.get(entry.key)!
        const termId = termIdSet.has(expected) ? expected : labelMap.get(fallbackLabel)
        updates[entry.key] = { termId, registered: !!termId, loading: false }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lookup failed'
      for (const entry of PREDICATE_INVENTORY) {
        updates[entry.key] = { registered: false, loading: false, error: msg }
      }
    }

    setStatuses(updates)
    setRefreshing(false)
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  const stats = useMemo(() => {
    const total = PREDICATE_INVENTORY.length
    const launchCount = PREDICATE_INVENTORY.filter(p => p.scope === 'launch').length
    const registered = Object.values(statuses).filter(s => s.registered).length
    const launchRegistered = PREDICATE_INVENTORY.filter(
      p => p.scope === 'launch' && statuses[p.key]?.registered
    ).length
    return { total, launchCount, registered, launchRegistered }
  }, [statuses])

  const handleRegister = async (entry: PredicateEntry) => {
    if (!walletClient || !publicClient || !address) return

    setStatuses(prev => ({
      ...prev,
      [entry.key]: { ...(prev[entry.key] || { registered: false, loading: false }), loading: true, error: undefined },
    }))

    try {
      const jsonLd = buildPredicateJsonLd(entry)
      const config = createWriteConfig(walletClient, publicClient)
      const result = await createSimpleAtom(config, jsonLd)
      setStatuses(prev => ({
        ...prev,
        [entry.key]: { registered: true, loading: false, termId: result.termId, txHash: result.transactionHash },
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setStatuses(prev => ({
        ...prev,
        [entry.key]: { ...(prev[entry.key] || { registered: false }), loading: false, error: msg },
      }))
    }
  }

  return (
    <>
      {!isConnected && (
        <div
          className="rounded-2xl p-5 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold text-white">Wallet not connected</div>
            <div className="text-[#B5BDC6]">Connect your admin wallet to register testnet predicates.</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total Predicates',   value: stats.total },
          { label: 'Mainnet Launch Scope', value: stats.launchCount },
          { label: 'Registered (testnet)', value: `${stats.registered}/${stats.total}` },
          { label: 'Launch Scope Done',  value: `${stats.launchRegistered}/${stats.launchCount}` },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}
          >
            <div className="text-2xl font-bold font-mono text-white">{stat.value}</div>
            <div className="text-xs text-[#7A838D] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={refreshAll} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      <div className="space-y-6">
        {groupedInventory().map(({ group, entries }) => {
          const cfg = GROUP_LABELS[group]
          return (
            <div key={group}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}66` }}
                />
                <h2 className="text-lg font-semibold text-white">{cfg.title}</h2>
                <span className="text-xs text-[#7A838D]">— {cfg.subtitle}</span>
              </div>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {entries.map((entry, i) => {
                  const status = statuses[entry.key] || { registered: false, loading: true }
                  const savedTermId = savedTermIds[entry.key]
                  const effectiveTermId = status.termId ?? savedTermId
                  const isRegistered = status.registered || !!savedTermId
                  const label = activeLabel(entry)
                  const isLast = i === entries.length - 1
                  const isPreviewOpen = previewKey === entry.key
                  const jsonLdPreview = buildPredicateJsonLd(entry)

                  return (
                    <div
                      key={entry.key}
                      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="px-5 py-4 flex items-center gap-4">
                        <div className="shrink-0 w-6 flex justify-center">
                          {status.loading ? (
                            <Loader2 className="w-5 h-5 text-[#7A838D] animate-spin" />
                          ) : isRegistered ? (
                            <CheckCircle2 className="w-5 h-5 text-[#2ECC71]" />
                          ) : (
                            <XCircle className="w-5 h-5 text-[#7A838D]" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-sm font-mono font-semibold text-white">{label}</code>
                            <span
                              className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(46,230,214,0.10)', color: '#2EE6D6', border: '1px solid rgba(46,230,214,0.25)' }}
                            >
                              Thing
                            </span>
                            {entry.scope === 'launch' && (
                              <span
                                className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(200,150,60,0.15)', color: '#C8963C', border: '1px solid rgba(200,150,60,0.3)' }}
                              >
                                Launch
                              </span>
                            )}
                            {entry.testnet !== entry.mainnet && (
                              <span className="text-[10px] text-[#4A5260]">
                                mainnet: <code>{entry.mainnet}</code>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#7A838D] mt-0.5 line-clamp-2">
                            {entry.description.replace(/\n/g, ' ')}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {effectiveTermId && (
                              <a
                                href={`${explorerBase}/atom/${effectiveTermId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#C8963C] hover:text-[#E8B84B] font-mono inline-flex items-center gap-1"
                              >
                                {effectiveTermId.slice(0, 14)}…{effectiveTermId.slice(-8)}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <button
                              onClick={() => setPreviewKey(isPreviewOpen ? null : entry.key)}
                              className="text-[10px] text-[#7A838D] hover:text-[#B5BDC6] inline-flex items-center gap-1"
                            >
                              <Code2 className="w-3 h-3" />
                              {isPreviewOpen ? 'Hide' : 'View'} JSON-LD
                            </button>
                          </div>
                          {status.error && (
                            <div className="text-xs text-red-400 mt-1">⚠ {status.error}</div>
                          )}
                          {/* Manual term_id entry — shown when not yet registered */}
                          {!isRegistered && !status.loading && (
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                type="text"
                                value={termIdInputs[entry.key] ?? ''}
                                onChange={e => setTermIdInputs(prev => ({ ...prev, [entry.key]: e.target.value }))}
                                placeholder="Paste term_id after registering (0x...)"
                                className="flex-1 text-xs font-mono rounded-lg px-3 py-1.5 bg-[#0f1113] border border-[rgba(255,255,255,0.10)] text-[#B5BDC6] placeholder-[#4A5260] focus:outline-none focus:border-[#C8963C]"
                                onKeyDown={e => e.key === 'Enter' && handleSaveTermId(entry.key)}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveTermId(entry.key)}
                                disabled={!termIdInputs[entry.key]?.trim()}
                              >
                                Save
                              </Button>
                            </div>
                          )}
                          {savedTermId && (
                            <button
                              onClick={() => {
                                localStorage.removeItem(`testnet_termid_${entry.key}`)
                                setSavedTermIds(prev => { const n = { ...prev }; delete n[entry.key]; return n })
                              }}
                              className="text-[10px] text-[#4A5260] hover:text-[#7A838D] mt-1 block"
                            >
                              Clear saved term_id
                            </button>
                          )}
                        </div>

                        <div className="shrink-0">
                          {isRegistered ? (
                            <span className="text-xs text-[#2ECC71] font-medium">Registered</span>
                          ) : status.loading ? (
                            <span className="text-xs text-[#7A838D]">Checking…</span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleRegister(entry)}
                              disabled={!isConnected || !walletClient}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Register
                            </Button>
                          )}
                        </div>
                      </div>

                      {isPreviewOpen && (
                        <div
                          className="mx-5 mb-4 p-3 rounded-lg overflow-x-auto"
                          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <pre className="text-[11px] text-[#B5BDC6] font-mono whitespace-pre-wrap break-all leading-relaxed">
                            {JSON.stringify(JSON.parse(jsonLdPreview), null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="mt-8 rounded-2xl p-5 text-sm text-[#B5BDC6]"
        style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="font-semibold text-white mb-2">How it works</div>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>Each predicate registers as a <strong>Schema.org JSON-LD <code>Thing</code></strong> — same format as Saulo&apos;s core predicates.</li>
          <li>5 predicates are <strong>required for mainnet launch</strong>; 11 are optional / post-launch.</li>
          <li>Registration cost ≈ <strong>0.001 tTRUST</strong> default deposit + protocol fee. Routed through FeeProxy.</li>
          <li>Atoms are <strong>permanent and immutable</strong> — same JSON-LD payload = same term_id = collision error.</li>
          <li>Active label set is controlled by <code>NEXT_PUBLIC_NETWORK</code>.</li>
        </ul>
      </div>
    </>
  )
}

// ─── Mainnet tab ──────────────────────────────────────────────────────────────

const LS_KEY = (key: string) => `mainnet_termid_${key}`

type MainnetBadge = '✅ REUSE' | '⚠️ CREATE' | '🆕 CREATE' | '✅ DONE'

function getInitialBadge(entry: PredicateEntry, savedTermId: string | null): MainnetBadge {
  if (savedTermId || entry.mainnetTermId) return '✅ DONE'
  if (entry.mainnetNote?.startsWith('✅ REUSE')) return '✅ REUSE'
  if (entry.mainnetNote?.startsWith('⚠️ CREATE')) return '⚠️ CREATE'
  return '🆕 CREATE'
}

const BADGE_STYLES: Record<MainnetBadge, { bg: string; color: string; border: string }> = {
  '✅ REUSE': { bg: 'rgba(46,204,113,0.12)', color: '#2ECC71', border: '1px solid rgba(46,204,113,0.3)' },
  '⚠️ CREATE': { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' },
  '🆕 CREATE': { bg: 'rgba(56,182,255,0.12)', color: '#38B6FF', border: '1px solid rgba(56,182,255,0.3)' },
  '✅ DONE':   { bg: 'rgba(46,204,113,0.12)', color: '#2ECC71', border: '1px solid rgba(46,204,113,0.3)' },
}

function MainnetPredicateCard({ entry }: { entry: PredicateEntry }) {
  const [savedTermId, setSavedTermId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showJsonLd, setShowJsonLd] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY(entry.key))
    if (saved) setSavedTermId(saved)
  }, [entry.key])

  const badge = getInitialBadge(entry, savedTermId)
  const displayTermId = savedTermId ?? entry.mainnetTermId
  const jsonLd = buildPredicateJsonLd(entry)
  const needsManualEntry = badge === '⚠️ CREATE' || badge === '🆕 CREATE'

  const handleSave = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    localStorage.setItem(LS_KEY(entry.key), trimmed)
    setSavedTermId(trimmed)
    setInputValue('')
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const badgeStyle = BADGE_STYLES[badge]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <code className="text-base font-mono font-semibold text-white">{entry.mainnet}</code>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={badgeStyle}
          >
            {badge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJsonLd(v => !v)}
            className="text-[11px] text-[#7A838D] hover:text-[#B5BDC6] inline-flex items-center gap-1 px-2 py-1 rounded"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Code2 className="w-3 h-3" />
            {showJsonLd ? 'Hide' : 'View'} JSON-LD
          </button>
          <a
            href="https://portal.intuition.systems"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#C8963C] hover:text-[#E8B84B] inline-flex items-center gap-1 px-2 py-1 rounded"
            style={{ border: '1px solid rgba(200,150,60,0.25)' }}
          >
            Register on Portal
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* term_id row */}
      <div className="text-xs text-[#7A838D] mb-2">
        {displayTermId ? (
          <div className="flex items-center gap-2">
            <span className="text-[#B5BDC6]">term_id:</span>
            <code className="text-[#C8963C] font-mono">
              {displayTermId.slice(0, 18)}…{displayTermId.slice(-8)}
            </code>
            <button
              onClick={() => handleCopy(displayTermId)}
              className="text-[#7A838D] hover:text-[#B5BDC6] transition-colors"
              title="Copy term_id"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2ECC71]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <span className="italic text-[#4A5260]">term_id: pending (register manually on portal)</span>
        )}
      </div>

      {/* Note */}
      {entry.mainnetNote && (
        <div className="text-xs text-[#B5BDC6] mb-3 pl-3 border-l-2 border-[#2EE6D6]/30">
          {entry.mainnetNote}
        </div>
      )}

      {/* Manual term_id entry (CREATE predicates) */}
      {needsManualEntry && !savedTermId && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Paste term_id from portal (0x...)"
            className="flex-1 text-xs font-mono rounded-lg px-3 py-2 bg-[#0f1113] border border-[rgba(255,255,255,0.10)] text-[#B5BDC6] placeholder-[#4A5260] focus:outline-none focus:border-[#C8963C]"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <Button size="sm" onClick={handleSave} disabled={!inputValue.trim()}>
            Save
          </Button>
        </div>
      )}
      {savedTermId && needsManualEntry && (
        <button
          onClick={() => {
            localStorage.removeItem(LS_KEY(entry.key))
            setSavedTermId(null)
          }}
          className="text-[10px] text-[#4A5260] hover:text-[#7A838D] mt-2"
        >
          Clear saved term_id
        </button>
      )}

      {/* JSON-LD preview */}
      {showJsonLd && (
        <div
          className="mt-3 p-3 rounded-lg overflow-x-auto relative"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={() => handleCopy(JSON.stringify(JSON.parse(jsonLd), null, 2))}
            className="absolute top-2 right-2 text-[10px] text-[#7A838D] hover:text-[#B5BDC6] inline-flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
          <pre className="text-[11px] text-[#B5BDC6] font-mono whitespace-pre-wrap break-all leading-relaxed pr-12">
            {JSON.stringify(JSON.parse(jsonLd), null, 2)}
          </pre>
          <div className="mt-2 text-[10px] text-[#4A5260]">
            This is the exact bytes stored on-chain. term_id = keccak256(this string). Verify it matches what portal computes.
          </div>
        </div>
      )}
    </div>
  )
}

function MainnetTabContent() {
  const ready = LAUNCH_PREDICATES.filter(p => !!p.mainnetTermId).length
  const pending = LAUNCH_PREDICATES.length - ready

  return (
    <>
      {/* Consult Saulo banner */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-start gap-3"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
      >
        <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-white mb-1">Consult Saulo before registering new predicates</div>
          <div className="text-[#B5BDC6]">
            Mainnet atoms are <strong>immutable</strong>. Check{' '}
            <code className="text-[#C8963C]">docs/MAINNET_PREDICATES.md</code> for the full
            protocol and Saulo consultation draft before touching the portal.
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Launch Scope',         value: LAUNCH_PREDICATES.length },
          { label: 'Ready (REUSE/DONE)',   value: ready },
          { label: 'Pending Registration', value: pending },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(200,150,60,0.15)' }}
          >
            <div className="text-2xl font-bold font-mono text-white">{stat.value}</div>
            <div className="text-xs text-[#7A838D] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Launch predicate cards */}
      <div className="space-y-4">
        {LAUNCH_PREDICATES.map(entry => (
          <MainnetPredicateCard key={entry.key} entry={entry} />
        ))}
      </div>

      <div
        className="mt-8 rounded-2xl p-5 text-sm text-[#B5BDC6]"
        style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="font-semibold text-white mb-2">Mainnet workflow</div>
        <ol className="space-y-1.5 list-decimal pl-5">
          <li>Consult Saulo on Discord — send the Phase 0 draft from <code>docs/MAINNET_PREDICATES.md</code>.</li>
          <li>For each <strong>CREATE</strong> predicate: generate icon (1024×1024), upload to IPFS, then register on portal.</li>
          <li>Paste the resulting term_id into the input below the card — it saves to localStorage and marks the badge ✅ DONE.</li>
          <li>Copy all confirmed term_ids into <code>src/lib/predicate-mainnet-ids.ts</code> for use in triple creation.</li>
        </ol>
      </div>
    </>
  )
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function PredicatesAdminPage() {
  const [activeTab, setActiveTab] = useState<'testnet' | 'mainnet'>('testnet')

  return (
    <PageBackground image="diagonal" opacity={0.3}>
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-[#7A838D] mb-2">
              <Link href="/" className="hover:text-[#C8963C] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span>Admin</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#C8963C]">Predicates</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-[#C8963C]" />
              Canonical Predicates Registry
            </h1>
            <p className="text-[#B5BDC6] max-w-2xl">
              Testnet: register predicates for development. Mainnet: status tracker for the
              5 launch-scope predicates — registration is done manually on portal.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: 'rgba(15,17,19,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['testnet', 'mainnet'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
                style={activeTab === tab ? {
                  background: 'rgba(200,150,60,0.15)',
                  color: '#C8963C',
                  border: '1px solid rgba(200,150,60,0.3)',
                } : {
                  color: '#7A838D',
                  border: '1px solid transparent',
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{ background: activeTab === tab ? '#C8963C' : '#4A5260' }}
                />
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'testnet' ? <TestnetTabContent /> : <MainnetTabContent />}

        </div>
      </div>
    </PageBackground>
  )
}
