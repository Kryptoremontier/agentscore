import { Suspense } from 'react'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Stats } from '@/components/landing/Stats'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { CTA } from '@/components/landing/CTA'

function HomeFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[#7A838D] text-sm animate-pulse">Loading…</div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="relative">
      <Suspense fallback={<HomeFallback />}>
        <Hero />
        <Features />
        <HowItWorks />
        <Stats />
        <FeaturedAgents />
        <CTA />
      </Suspense>
    </div>
  )
}
