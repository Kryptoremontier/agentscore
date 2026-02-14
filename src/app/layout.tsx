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
  metadataBase: new URL('https://agentscore-gilt.vercel.app'),
  title: 'AgentScore | Trust Layer for AI Agents',
  description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol. 770K+ AI agents need trust verification.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol. 770K+ AI agents need trust verification.',
    url: 'https://agentscore-gilt.vercel.app',
    siteName: 'AgentScore',
    images: [
      {
        url: 'https://agentscore-gilt.vercel.app/images/brand/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AgentScore - Trust Layer for AI Agents',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Verify AI agent reputation before interaction. Decentralized trust verification.',
    images: ['https://agentscore-gilt.vercel.app/images/brand/og-image.png'],
    creator: '@Kryptoremontier',
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
              {/* Content */}
              <Navbar />
              <main className="relative">
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