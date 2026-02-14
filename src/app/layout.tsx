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
  metadataBase: new URL('https://agentscore-5x67v5x1r-kryptoremontiers-projects.vercel.app'),
  title: 'AgentScore | Trust Layer for AI Agents',
  description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol.',
  keywords: ['AI agents', 'trust score', 'verification', 'Web3', 'Intuition Protocol', 'Base', 'blockchain'],
  authors: [{ name: 'Kryptoremontier' }],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol.',
    url: 'https://agentscore-5x67v5x1r-kryptoremontiers-projects.vercel.app',
    siteName: 'AgentScore',
    images: [
      {
        url: '/images/brand/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AgentScore - Trust Layer for AI Agents',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Verify AI agent reputation before interaction. Decentralized trust verification built on Intuition Protocol.',
    images: ['/images/brand/og-image.png'],
    creator: '@Kryptoremontier',
    site: '@Kryptoremontier',
  },
  robots: {
    index: true,
    follow: true,
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