import Link from 'next/link'
import { Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 bg-[#0F1113]">
      <div className="max-w-md w-full bg-[#171A1D] border border-[#C8963C]/20 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#C8963C]/10 flex items-center justify-center mx-auto mb-6">
          <Search className="w-8 h-8 text-[#C8963C]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Page not found</h2>
        <p className="text-[#B5BDC6] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: 'rgba(200,150,60,0.15)', border: '1px solid rgba(200,150,60,0.35)', color: '#C8963C' }}
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  )
}
