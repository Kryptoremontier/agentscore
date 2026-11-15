import { PageBackground } from '@/components/shared/PageBackground'
import { ContextRanking } from '@/components/trust/ContextRanking'
import { TrustContextsBody } from '@/components/landing/TrustContexts'
import { getTrustContexts } from '@/lib/landing-data'
import { contextBySlug } from '@/lib/trust-contexts'
import { CONTEXT_UNKNOWN } from '@/lib/people-copy'
import { DomainsClient } from './domains-client'

/**
 * /domains (Etap 8b Run B) — the same route, two views.
 *
 * - `/domains?context=<slug>`: one trust context's ranked list — "Agents people trust for X", distinct
 *   people first, then the existing tie-break chain (components/trust/ContextRanking).
 * - `/domains`: the trust contexts grid from the landing's §04 (featured list + all 8 contexts), then
 *   everything that was here before, below it (./domains-client).
 *
 * Read on the server from what /agents and the landing already read (lib/landing-data.ts
 * getTrustContexts); each view prints its data's age, and a failed read says so.
 */
export const dynamic = 'force-dynamic'

export default async function DomainsPage({ searchParams }: { searchParams: { context?: string | string[] } }) {
  const slug = typeof searchParams.context === 'string' ? searchParams.context : null
  const context = contextBySlug(slug)
  const contexts = await getTrustContexts()

  if (context) {
    const summary = contexts.status === 'ok' ? contexts.value.summaries.find((s) => s.context.slug === context.slug) ?? null : null
    return (
      <PageBackground>
        <div className="pt-24 pb-28 lg:pb-16 min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ContextRanking context={context} summary={summary} readAt={contexts.status === 'ok' ? contexts.value.dataReadAt : null} />
          </div>
        </div>
      </PageBackground>
    )
  }

  return (
    <DomainsClient
      top={
        <>
          {slug && <p className="mb-4 text-sm text-[#B5BDC6]" data-testid="context-unknown">{CONTEXT_UNKNOWN(slug)}</p>}
          <TrustContextsBody contexts={contexts} />
        </>
      }
    />
  )
}
