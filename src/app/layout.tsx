import type { Metadata } from 'next'
import { Inter, Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
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

// Etap 6b type system (tokens: globals.css :root + tailwind.config.ts). Display: a heavy, tight
// grotesk for h1/h2. Accent: an italic display face for one accent word per headline
// (components/shared/AccentWord). Both free (OFL, Google Fonts).
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-accent',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://agentscore-gilt.vercel.app'),
  title: 'AgentScore | Trust Layer for AI Agents',
  description: 'Real people vouch for AI agents, on-chain — by name, for something specific. One wallet can never do it alone. Built on Intuition.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'AgentScore | Trust Layer for AI Agents',
    description: 'Real people vouch for AI agents, on-chain — by name, for something specific. One wallet can never do it alone. Built on Intuition.',
    url: 'https://agentscore-gilt.vercel.app',
    siteName: 'AgentScore',
    images: [
      {
        url: 'https://agentscore-gilt.vercel.app/images/brand/gold/og-image.png',
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
    description: 'Real people vouch for AI agents, on-chain — by name, for something specific. One wallet can never do it alone. Built on Intuition.',
    images: ['https://agentscore-gilt.vercel.app/images/brand/gold/og-image.png'],
    creator: '@AgentScoreApp',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable} ${jetbrains.variable} font-sans antialiased`}
        style={{
          backgroundImage: "url('/images/brand/gold/background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#0F1113',
        }}
        suppressHydrationWarning
      >
        <Providers>
          <div className="relative min-h-screen text-white">
            {/* Dark overlay to dim the background image */}
            <div className="fixed inset-0 bg-[rgb(10,10,15)]/75 pointer-events-none z-0" />
            {/* Navbar stays visible even if a page crashes */}
            <Navbar />
            {/* Sidebar — desktop only, collapsed 56px, hover-expanded */}
            <Sidebar />
            {/* Content area — offset by sidebar on desktop */}
            <div className="md:pl-56">
              <main className="relative">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
            <MobileBottomNav />
            <ScrollToTop />
          </div>
        </Providers>
      </body>
    </html>
  )
}
