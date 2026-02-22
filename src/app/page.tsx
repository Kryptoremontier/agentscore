import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Stats } from '@/components/landing/Stats'
import { FeaturedAgents } from '@/components/landing/FeaturedAgents'
import { CTA } from '@/components/landing/CTA'

export default function HomePage() {
  return (
    <div
      className="relative bg-center bg-cover bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'url(/images/backgrounds/hero-bg.jpg)' }}
    >
      {/* Global dimming layer over the fixed background */}
      <div className="fixed inset-0 bg-[rgb(10,10,15)]/60 pointer-events-none" />
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <FeaturedAgents />
      <CTA />
    </div>
  )
}
