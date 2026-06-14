/** @type {import('next').NextConfig} */

// On some corporate/VPN networks the Node TLS stack can't verify Intuition's
// testnet certificate chain. Disable verification in dev only so server-side
// fetches to Hasura succeed. NEVER set this in production.
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optimize images
  images: {
    domains: [
      'localhost',
      'api.intuition.systems',
      'testnet.api.intuition.systems',
      'ipfs.io',
      'gateway.pinata.cloud',
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
    NEXT_PUBLIC_INTUITION_API_URL: process.env.NEXT_PUBLIC_INTUITION_API_URL || 'https://api.testnet.intuition.systems',
    // No default on purpose: a missing NEXT_PUBLIC_CHAIN_ID must never
    // silently select a network. Consumers fail safe to testnet (see
    // src/lib/attestation-gate.ts getAttestationConfig).
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Fix for wallet connect
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }

    // Stub optional peer deps that MetaMask SDK / WalletConnect pull in
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    }

    // Disable persistent filesystem cache in dev on Windows to prevent
    // file-locking errors ("UNKNOWN: unknown error, open .next/static/chunks/...")
    // that occur when HMR tries to overwrite files still held by the OS.
    if (dev) {
      config.cache = false
    }

    return config
  },
}

module.exports = nextConfig