import Link from 'next/link'
import { Coins, ChevronRight } from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { FeesAdminClient } from '@/components/admin/FeesAdminClient'

/** /admin/fees (Etap 9c) — behind AdminGuard (app/admin/layout.tsx). How the fee is changed: docs/FEE_CHANGE_RUNBOOK.md. */
export default function FeesAdminPage() {
  return (
    <PageBackground>
      <div className="pt-24 pb-28 md:pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
            <Link href="/" className="hover:text-[#C8963C] transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span>Admin</span>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: '#C8963C' }}>Fees</span>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl mb-2 flex items-center gap-3 font-extrabold tracking-display leading-display">
              <Coins className="w-7 h-7" style={{ color: '#C8963C' }} />
              Fees
            </h1>
            <p className="text-white/40 text-sm">
              The FeeProxy&apos;s deposit fee, read live from the contract. Changing it is one transaction from a whitelisted admin wallet.
            </p>
          </div>

          <FeesAdminClient />

        </div>
      </div>
    </PageBackground>
  )
}
