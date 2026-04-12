import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { ProjectRegistrationForm } from '@/components/intuforge/ProjectRegistrationForm'

export const metadata = {
  title: 'List Your Project | IntuForge',
  description: 'Register your Intuition project on IntuForge — the Project Discovery & Trust Launchpad.',
}

export default function RegisterProjectPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-white/30 mb-6">
        <Link href="/explore/intuforge" className="hover:text-white/60 transition-colors">IntuForge</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white/50">List Project</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🏗️</span>
          <h1 className="text-xl font-bold text-white">List Your Project on IntuForge</h1>
        </div>
        <p className="text-sm text-white/40 leading-relaxed">
          Registration is <span className="text-emerald-400 font-medium">free</span> — only protocol gas.
          Community staking carries a 2.5% fee that supports the ecosystem.
        </p>
      </div>

      <ProjectRegistrationForm />
    </div>
  )
}
