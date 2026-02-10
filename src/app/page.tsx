import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { CTA } from '@/components/landing/CTA'

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <FeaturedAgents />
      <CTA />
    </>
  )
}