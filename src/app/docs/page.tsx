import Link from 'next/link'
import { PageBackground } from '@/components/shared/PageBackground'

export default function DocsPage() {
  return (
    <PageBackground image="wave" opacity={0.2}>
      <div className="pt-24 pb-16">
        <div className="container max-w-4xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-white mb-3">Documentation</h1>
            <p className="text-[#6b7280] text-lg">
              AgentScore — decentralized trust layer for AI agents built on Intuition Protocol.
            </p>
          </div>

          <div className="grid gap-6">
            <DocSection title="What is AgentScore?">
              <p>
                AgentScore is a reputation and trust verification system for AI agents.
                Anyone can stake <span className="text-[#9ca3af] font-medium">tTRUST</span> tokens
                to signal confidence in an agent — every vote is transparent, on-chain, and permanent.
              </p>
            </DocSection>

            <DocSection title="How trust scores work">
              <ul className="space-y-2 text-[#9ca3af]">
                <li>• <strong className="text-white">Support</strong> — stake tTRUST in favour of an agent to boost its score</li>
                <li>• <strong className="text-white">Oppose</strong> — stake tTRUST against an agent to lower its score</li>
                <li>• Score range: <strong className="text-white">0–100</strong>, anchored at 50 until enough stakes accumulate</li>
                <li>• Older signals decay over time (half-life 90 days)</li>
              </ul>
            </DocSection>

            <DocSection title="Trust Tiers">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { tier: 'Unverified', icon: '○', color: '#6b7280', desc: 'No signals yet' },
                  { tier: 'Sandbox',    icon: '◐', color: '#eab308', desc: '3+ stakers'     },
                  { tier: 'Trusted',   icon: '✓', color: '#22c55e', desc: '10+ stakers'    },
                  { tier: 'Verified',  icon: '⭐', color: '#f59e0b', desc: '25+ stakers'   },
                ].map(t => (
                  <div key={t.tier} className="bg-[#111318] border border-[#1e2028] rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1" style={{ color: t.color }}>{t.icon}</div>
                    <div className="font-semibold text-white text-sm">{t.tier}</div>
                    <div className="text-[#6b7280] text-xs mt-1">{t.desc}</div>
                  </div>
                ))}
              </div>
            </DocSection>

            <DocSection title="Getting started">
              <div className="flex gap-4 flex-wrap">
                <Link
                  href="/agents"
                  className="px-4 py-2 bg-[#10b981] text-white rounded-lg text-sm font-medium hover:bg-[#059669] transition-colors"
                >
                  Browse agents →
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-[#1e2028] text-white border border-[#30363d] rounded-lg text-sm font-medium hover:bg-[#21262d] transition-colors"
                >
                  Register an agent →
                </Link>
              </div>
            </DocSection>
          </div>
        </div>
      </div>
    </PageBackground>
  )
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111318] border border-[#1e2028] rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="text-[#9ca3af] leading-relaxed">{children}</div>
    </div>
  )
}
