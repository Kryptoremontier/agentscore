import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { CTA } from '@/components/landing/CTA'

/**
 * The landing (Etap 8b): the story in numbered sections. Hero → 01 How it works → … → the way in
 * again. Server components: the story costs a visitor no JavaScript.
 */
export default function HomePage() {
  return (
    <div className="relative">
      <Hero />
      <HowItWorks />
      <CTA />
    </div>
  )
}
