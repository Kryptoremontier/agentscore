import { Metadata } from 'next'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
}

export function generateSEO({
  title = 'AgentScore',
  description = 'Trust Layer for AI Agents',
  image = '/og-image.png',
  url = 'https://agentscore.ai',
  type = 'website',
}: SEOProps = {}): Metadata {
  const fullTitle = title === 'AgentScore' ? title : `${title} | AgentScore`

  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      url,
      type,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      siteName: 'AgentScore',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
      creator: '@agentscore',
    },
    metadataBase: new URL(url),
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    keywords: [
      'AI agents',
      'trust score',
      'reputation',
      'blockchain',
      'Intuition Protocol',
      'Web3',
      'AI safety',
      'agent verification',
    ],
  }
}

// JSON-LD Schema for structured data
export function generateJSONLD(data: {
  type: 'Organization' | 'WebPage' | 'Person'
  name: string
  description?: string
  url?: string
  image?: string
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': data.type,
    name: data.name,
    description: data.description,
    url: data.url,
    image: data.image,
    ...(data.type === 'Organization' && {
      logo: data.image,
      sameAs: [
        'https://twitter.com/agentscore',
        'https://github.com/agentscore',
      ],
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}