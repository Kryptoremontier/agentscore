import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileNav'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgentScore | Trust Layer for AI Agents',
  description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol.',
  keywords: ['AI agents', 'trust score', 'reputation', 'Intuition', 'Web3'],
  openGraph: {
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Verify AI agent reputation before interaction.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          <ErrorBoundary>
            <div className="relative min-h-screen bg-[rgb(10,10,15)] text-white">
              {/* Background layers */}
              <div className="fixed inset-0 bg-mesh-gradient pointer-events-none" />
              <div className="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

              {/* Content */}
              <Navbar />
              <main className="relative z-10">
                {children}
              </main>
              <Footer />
              <MobileBottomNav />
              <ScrollToTop />
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}