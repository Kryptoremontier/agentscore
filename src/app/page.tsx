import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { TrustOverTime } from '@/components/landing/TrustOverTime'
import { GateExample } from '@/components/landing/GateExample'
import { TrustContexts } from '@/components/landing/TrustContexts'
import { CTA } from '@/components/landing/CTA'
import { getLandingData } from '@/lib/landing-data'

/**
 * The landing (Etap 8b): the story in numbered sections, built from real data.
 *
 *   Hero → 01 How it works → 02 Trust over time (a live card for one real agent) → 03 Agents ask
 *   first (a real should_i_trust answer) → 04 Trust contexts → the closing block. The footer is the
 *   site's (app/layout.tsx).
 *
 * Rendered on the server and regenerated every LANDING_REVALIDATE_SECONDS (ISR): the live parts cost
 * a visitor no JavaScript and no request. Every part prints its age, counted again in the browser
 * (components/shared/DataAge); a part whose read failed says so.
 *
 * `force-static` keeps the page static even though the shared reads fetch with `cache: 'no-store'`;
 * `default-no-store` keeps every fetch out of Next's data cache, so a regeneration reads the indexer
 * (or the shared complete-reads cache, which records its own age) — never a stale fetch that would
 * claim to be live.
 */
export const dynamic = 'force-static'
// LANDING_REVALIDATE_SECONDS, a literal (Next reads it statically). Next takes the shortest TTL among
// the reads behind the page, so it regenerates more often in practice (30 s, the agent-detail TTL).
export const revalidate = 120
export const fetchCache = 'default-no-store'

export default async function HomePage() {
  const data = await getLandingData()
  const now = new Date().toISOString()
  return (
    <div className="relative">
      <Hero />
      <HowItWorks />
      <TrustOverTime story={data.story} now={now} />
      <GateExample gate={data.gate} />
      <TrustContexts contexts={data.contexts} />
      <CTA />
    </div>
  )
}
