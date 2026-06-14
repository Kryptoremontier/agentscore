/**
 * /lab/poc — Domain-Scoped Trust, Proof of Concept (EXPERIMENTAL).
 * ──────────────────────────────────────────────────────────────────────────
 * Reads the LIVE mainnet `has category` graph, normalizes the fragmented
 * taxonomy (domain-aliases), and renders a per-domain score vector per entity
 * (domain-score). Read-only. Not wired into production scoring or navigation.
 *
 * The "money shot": the normalization panel shows fragmented labels
 * (defi, crypto_assets, smart_contracts) folding into ONE canonical bucket —
 * the fragmentation problem being solved live.
 */

import { fetchDomainCategoryGraph } from '@/lib/domain-data'
import { scoreDomains, type DomainScore } from '@/lib/domain-score'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Domain Score PoC — Lab' }

const MAX_ENTITIES = 30

const STATUS_STYLES: Record<DomainScore['status'], { chip: string; bar: string; tag: string }> = {
  canonical:         { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200', bar: 'bg-emerald-400', tag: 'canonical' },
  pending_canonical: { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-200',       bar: 'bg-amber-400',   tag: 'PENDING canonical bucket' },
  uncategorized:     { chip: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',           bar: 'bg-zinc-400',    tag: 'uncategorized' },
}

function ExperimentalBanner() {
  return (
    <div className="mb-6 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100">
      <span className="font-semibold">🧪 EXPERIMENTAL — Proof of Concept.</span>{' '}
      Domain-scoped trust over the live mainnet <code className="text-fuchsia-200">has category</code> graph.
      Read-only, not production scoring. Reputation per-domain instead of one global score.
    </div>
  )
}

export default async function DomainScorePocPage() {
  let entities: Awaited<ReturnType<typeof fetchDomainCategoryGraph>> = []
  let error: string | null = null
  try {
    entities = await fetchDomainCategoryGraph(200)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const scored = entities
    .map((e) => ({ ...e, result: scoreDomains(e.categories) }))
    .sort((a, b) => b.result.totalAttestations - a.result.totalAttestations)

  // Aggregate taxonomy gaps across the whole dataset.
  const allPending = new Set<string>()
  const allUncategorized = new Set<string>()
  for (const s of scored) {
    s.result.pendingCanonical.forEach((l) => allPending.add(l))
    s.result.uncategorized.forEach((l) => allUncategorized.add(l))
  }

  const shown = scored.slice(0, MAX_ENTITIES)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-zinc-100">
      <h1 className="mb-1 text-2xl font-bold">Domain-Scoped Trust — PoC</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Live mainnet · {entities.length} entities · {scored.reduce((n, s) => n + s.result.totalAttestations, 0)}{' '}
        <code>has category</code> attestations
      </p>
      <ExperimentalBanner />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Failed to load mainnet graph: {error}
        </div>
      )}

      {/* Taxonomy gaps — surfaced honestly */}
      {(allPending.size > 0 || allUncategorized.size > 0) && (
        <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-200">Taxonomy gaps</h2>
          {allPending.size > 0 && (
            <p className="mb-1 text-xs text-amber-200/90">
              <span className="font-semibold">PENDING canonical bucket</span> (real domains, no canonical atom yet):{' '}
              {[...allPending].sort().join(', ')}
            </p>
          )}
          {allUncategorized.size > 0 && (
            <p className="text-xs text-zinc-400">
              <span className="font-semibold">Uncategorized</span> (unmapped — surfaced, not dropped):{' '}
              {[...allUncategorized].sort().join(', ')}
            </p>
          )}
        </section>
      )}

      {/* Per-entity domain vectors */}
      <div className="space-y-4">
        {shown.map((s) => {
          const domains = Object.values(s.result.vector).sort((a, b) => b.score - a.score)
          const maxScore = Math.max(1, ...domains.map((d) => d.score))
          return (
            <article key={s.entityTermId} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="truncate text-base font-semibold text-zinc-100">{s.entity}</h3>
                <span className="shrink-0 text-xs text-zinc-500">{s.result.totalAttestations} attestation(s)</span>
              </div>

              {/* Domain score vector — bar per domain */}
              <div className="space-y-2">
                {domains.map((d) => {
                  const st = STATUS_STYLES[d.status]
                  return (
                    <div key={d.bucket} className="flex items-center gap-3">
                      <span className={`w-52 shrink-0 truncate rounded-md border px-2 py-0.5 text-xs ${st.chip}`}>
                        {d.bucket}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full ${st.bar}`} style={{ width: `${(d.score / maxScore) * 100}%` }} />
                      </div>
                      <span className="w-28 shrink-0 text-right text-xs text-zinc-400">
                        score {d.score} · {d.distinctAttesters}/{d.count} att.
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Normalization panel — the money shot: fragments → canonical */}
              {domains.some((d) => d.sources.length > 1 || d.sources[0] !== d.bucket) && (
                <div className="mt-3 border-t border-white/5 pt-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Normalization</p>
                  <ul className="space-y-0.5">
                    {domains
                      .filter((d) => d.sources.length > 1 || d.sources[0] !== d.bucket)
                      .map((d) => (
                        <li key={d.bucket} className="text-xs text-zinc-400">
                          <span className="text-zinc-300">{d.sources.join(', ')}</span>
                          {' → '}
                          <span className="font-medium text-zinc-100">{d.bucket}</span>
                          <span className="ml-1 text-zinc-500">({STATUS_STYLES[d.status].tag})</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {scored.length > MAX_ENTITIES && (
        <p className="mt-4 text-center text-xs text-zinc-500">
          Showing top {MAX_ENTITIES} of {scored.length} entities by attestation volume.
        </p>
      )}
    </main>
  )
}
