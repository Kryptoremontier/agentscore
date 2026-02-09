import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { Stats } from '@/components/landing/Stats'
import { CTA } from '@/components/landing/CTA'

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <FeaturedAgents />
      <Stats />
      <CTA />
    </>
  )
}