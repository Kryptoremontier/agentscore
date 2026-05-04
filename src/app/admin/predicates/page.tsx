'use client'

/**
 * Admin → Predicates registry.
 *
 * One-time setup tool to register every canonical AgentScore predicate
 * as an Atom on the active network. Required before mainnet launch so
 * triples like "Agent → has agent skill → Skill" work out of the box.
 *
 * Connect the AgentScore admin wallet on the target network (mainnet for
 * production prep). Each row reads on-chain status; missing predicates
 * can be created with one click via the standard FeeProxy flow.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import Link from 'next/link'
import {
  CheckCircle2, XCircle, Loader2, ExternalLink, Plus, ShieldAlert,
  RefreshCw, ChevronRight, Code2,
} from 'lucide-react'
import { stringToHex, type Hex } from 'viem'
import { calculateAtomId as sdkCalculateAtomId } from '@0xintuition/sdk'
import { PageBackground } from '@/components/shared/PageBackground'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/lib/app-config'
import { createSimpleAtom, createWriteConfig } from '@/lib/intuition'
import {
  PREDICATE_INVENTORY,
  groupedInventory,
  activeLabel,
  buildPredicateJsonLd,
  type PredicateEntry,
  type PredicateGroup,
} from '@/lib/predicate-inventory'

const NETWORK = process.env['NEXT_PUBLIC_NETWORK'] ?? 'testnet'

interface PredicateStatus {
  termId?: string
  registered: boolean
  loading: boolean
  txHash?: string
  error?: string
}

const GROUP_LABELS: Record<PredicateGroup, { title: string; subtitle: string; color: string }> = {
  core:         { title: 'Core',         subtitle: 'Power scoring, trust attestations',  color: '#C8963C' },
  capability:   { title: 'Capability',   subtitle: 'Certifications & qualifications',    color: '#2ECC71' },
  relationship: { title: 'Relationship', subtitle: 'Discovery between agents',           color: '#2EE6D6' },
  opinion:      { title: 'Opinion',      subtitle: 'Stakeable community sentiment',      color: '#38B6FF' },
  attestation:  { title: 'Attestation',  subtitle: 'Identity verification & vouches',    color: '#A78BFA' },
  report:       { title: 'Report',       subtitle: 'Moderation & abuse reporting',       color: '#EF4444' },
}

/**
 * Compute the deterministic term_id of a Schema.org JSON-LD predicate.
 * Mirrors the SDK calculation: keccak256(salt + atomData).
 */
function computeJsonLdTermId(jsonLd: string): `0x${string}` {
  return sdkCalculateAtomId(stringToHex(jsonLd) as Hex) as `0x${string}`
}

/**
 * Batch-fetch existing atoms by term_ids and labels in TWO queries instead
 * of 2N parallel calls. Returns a Set of every term_id that exists and a
 * Map of label → term_id for the fallback path.
 */
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

  if (!res.ok) {
    throw new Error(`Hasura ${res.status}`)
  }

  const json = await res.json()
  if (json?.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }

  const termIdSet = new Set<string>(
    (json?.data?.byTermId ?? []).map((a: { term_id: string }) => a.term_id),
  )
  const labelMap = new Map<string, string>()
  for (const a of json?.data?.byLabel ?? []) {
    if (!labelMap.has(a.label)) labelMap.set(a.label, a.term_id)
  }
  return { termIdSet, labelMap }
}

export default function PredicatesAdminPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [statuses, setStatuses] = useState<Record<string, PredicateStatus>>({})
  const [refreshing, setRefreshing] = useState(false)

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    const updates: Record<string, PredicateStatus> = {}

    // Pre-compute the deterministic JSON-LD term_id for each entry —
    // this is the canonical mainnet identity. Also collect all fallback
    // labels (active label per network).
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
        const termId = termIdSet.has(expected)
          ? expected
          : labelMap.get(fallbackLabel)
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

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  const stats = useMemo(() => {
    const total = PREDICATE_INVENTORY.length
    const required = PREDICATE_INVENTORY.filter(p => p.required).length
    const registered = Object.values(statuses).filter(s => s.registered).length
    const requiredRegistered = PREDICATE_INVENTORY.filter(
      p => p.required && statuses[p.key]?.registered
    ).length
    return { total, required, registered, requiredRegistered }
  }, [statuses])

  const handleRegister = async (entry: PredicateEntry) => {
    if (!walletClient || !publicClient || !address) return

    setStatuses(prev => ({
      ...prev,
      [entry.key]: { ...(prev[entry.key] || { registered: false, loading: false }), loading: true, error: undefined },
    }))

    try {
      // Build the canonical JSON-LD payload (Schema.org Thing).
      // This becomes the atom data — Hasura will index `data` field with the
      // full JSON, and the `name` property is what users see on portals.
      const jsonLd = buildPredicateJsonLd(entry)
      const config = createWriteConfig(walletClient, publicClient)
      const result = await createSimpleAtom(config, jsonLd)

      setStatuses(prev => ({
        ...prev,
        [entry.key]: {
          registered: true,
          loading: false,
          termId: result.termId,
          txHash: result.transactionHash,
        },
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setStatuses(prev => ({
        ...prev,
        [entry.key]: {
          ...(prev[entry.key] || { registered: false }),
          loading: false,
          error: msg,
        },
      }))
    }
  }

  const [previewKey, setPreviewKey] = useState<string | null>(null)

  const explorerBase = NETWORK === 'mainnet'
    ? 'https://explorer.intuition.systems'
    : 'https://testnet.explorer.intuition.systems'

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

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <ShieldAlert className="w-7 h-7 text-[#C8963C]" />
                  Canonical Predicates Registry
                </h1>
                <p className="text-[#B5BDC6] max-w-2xl">
                  Bootstrap the on-chain ontology AgentScore depends on. Each predicate
                  is registered as an Atom on{' '}
                  <span className="text-[#C8963C] font-semibold uppercase">{NETWORK}</span>.
                  Run this once before launch — atoms are permanent.
                </p>
              </div>

              <Button onClick={refreshAll} disabled={refreshing} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>
          </div>

          {/* Wallet status */}
          {!isConnected && (
            <div
              className="rounded-2xl p-5 mb-6 flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold text-white">Wallet not connected</div>
                <div className="text-[#B5BDC6]">
                  Connect your admin wallet (network: {NETWORK}) to register predicates.
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Predicates',    value: stats.total },
              { label: 'Required for Launch', value: stats.required },
              { label: 'Registered',          value: `${stats.registered}/${stats.total}` },
              { label: 'Required Done',       value: `${stats.requiredRegistered}/${stats.required}` },
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

          {/* Groups */}
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
                            {/* Status icon */}
                            <div className="shrink-0 w-6 flex justify-center">
                              {status.loading ? (
                                <Loader2 className="w-5 h-5 text-[#7A838D] animate-spin" />
                              ) : status.registered ? (
                                <CheckCircle2 className="w-5 h-5 text-[#2ECC71]" />
                              ) : (
                                <XCircle className="w-5 h-5 text-[#7A838D]" />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-sm font-mono font-semibold text-white">
                                  {label}
                                </code>
                                <span
                                  className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                                  style={{
                                    background: 'rgba(46,230,214,0.10)',
                                    color: '#2EE6D6',
                                    border: '1px solid rgba(46,230,214,0.25)',
                                  }}
                                >
                                  Thing
                                </span>
                                {entry.required && (
                                  <span
                                    className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      background: 'rgba(200,150,60,0.15)',
                                      color: '#C8963C',
                                      border: '1px solid rgba(200,150,60,0.3)',
                                    }}
                                  >
                                    Required
                                  </span>
                                )}
                                {entry.testnet !== entry.mainnet && (
                                  <span className="text-[10px] text-[#4A5260]">
                                    testnet: <code>{entry.testnet}</code>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#7A838D] mt-0.5 line-clamp-2">
                                {entry.description.replace(/\n/g, ' ')}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {status.termId && (
                                  <a
                                    href={`${explorerBase}/atom/${status.termId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-[#C8963C] hover:text-[#E8B84B] font-mono inline-flex items-center gap-1"
                                  >
                                    {status.termId.slice(0, 14)}…{status.termId.slice(-8)}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                <button
                                  onClick={() => setPreviewKey(isPreviewOpen ? null : entry.key)}
                                  className="text-[10px] text-[#7A838D] hover:text-[#B5BDC6] inline-flex items-center gap-1"
                                >
                                  <Code2 className="w-3 h-3" />
                                  {isPreviewOpen ? 'Hide' : 'View'} JSON-LD payload
                                </button>
                              </div>
                              {status.error && (
                                <div className="text-xs text-red-400 mt-1">⚠ {status.error}</div>
                              )}
                            </div>

                            {/* Action */}
                            <div className="shrink-0">
                              {status.registered ? (
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

                          {/* JSON-LD payload preview */}
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

          {/* Footer note */}
          <div
            className="mt-8 rounded-2xl p-5 text-sm text-[#B5BDC6]"
            style={{ background: 'rgba(15,17,19,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="font-semibold text-white mb-2">How it works</div>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>
                Each predicate is registered as a <strong>Schema.org JSON-LD <code>Thing</code></strong> —
                same format as Saulo&apos;s core predicates (<code>resolved to</code>, <code>belongs to</code>, ...).
              </li>
              <li>
                The <code>name</code> field is what users see on Intuition Portal; the
                <code> description</code> documents usage and warnings; <code>image</code> is an
                IPFS-hosted icon.
              </li>
              <li>
                Registration cost ≈ <strong>0.001 tTRUST</strong> default deposit + protocol fee
                (fixed + bps). Routed through the standard FeeProxy.
              </li>
              <li>
                Atoms are <strong>permanent and immutable</strong> — re-creation with the same JSON
                payload is impossible (same <code>term_id</code> = collision error).
              </li>
              <li>
                The display layer (<code>predicate-display.ts</code>) recognizes both new
                lowercase-with-spaces labels and legacy testnet camelCase forms.
              </li>
              <li>
                Active label set is controlled by <code>NEXT_PUBLIC_NETWORK</code>.
              </li>
            </ul>
          </div>

        </div>
      </div>
    </PageBackground>
  )
}
