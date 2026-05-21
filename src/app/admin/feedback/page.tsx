import Link from 'next/link'
import { Bug, ChevronRight } from 'lucide-react'
import { PageBackground } from '@/components/shared/PageBackground'
import { FeedbackAdminClient } from '@/components/admin/FeedbackAdminClient'

export default function FeedbackAdminPage() {
  return (
    <PageBackground>
      <div className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
            <Link href="/" className="hover:text-[#C8963C] transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span>Admin</span>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: '#EF4444' }}>Bug Reports</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Bug className="w-7 h-7" style={{ color: '#EF4444' }} />
              Bug Reports
            </h1>
            <p className="text-white/40 text-sm">
              User-submitted bug reports from the in-app feedback form.
            </p>
          </div>

          <FeedbackAdminClient />

        </div>
      </div>
    </PageBackground>
  )
}
