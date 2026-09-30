import { Suspense } from 'react'
import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { Features } from '@/components/landing/Features'
import { CTA } from '@/components/landing/CTA'

function HomeFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[#7A838D] text-sm animate-pulse">Loading…</div>
    </div>
  )
}

/**
 * The landing (Etap 5b Run 2): the whole story on the first phone screen (Hero), then how it works,
 * the registry (the list's most vouched agents), what it's built on, and the way in again. The
 * Alpha Testnet banner (now the Hero's small badge) and the Testnet Statistics section (the same
 * numbers the Hero printed) are gone.
 */
export default function HomePage() {
  return (
    <div className="relative">
      <Suspense fallback={<HomeFallback />}>
        <Hero />
        <HowItWorks />
        <FeaturedAgents />
        <Features />
        <CTA />
      </Suspense>
    </div>
  )
}
