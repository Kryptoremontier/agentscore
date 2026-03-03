import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Stats } from '@/components/landing/Stats'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { CTA } from '@/components/landing/CTA'

export default function HomePage() {
  return (
    <div className="relative">
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <FeaturedAgents />
      <CTA />
    </div>
  )
}
