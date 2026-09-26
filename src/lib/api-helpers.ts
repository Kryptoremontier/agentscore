import { NextResponse } from 'next/server'
import { currentFreshness, runWithReadLedger, type Freshness } from './server-cache'

/** CDN cache for a complete answer. Anything incomplete (a failed or capped read) is never cached. */
export const API_CACHE_CONTROL = 'public, s-maxage=15, stale-while-revalidate=30'
export const NO_STORE = 'no-store'

/**
 * `meta` freshness fields for a machine-read answer (lib/server-cache.ts): `dataAgeSeconds` is
 * the age of the oldest read behind the answer when it was built (0 = read live) and
 * `dataReadAt` that read's time. A CDN hop adds its own `Age` header on top of dataAgeSeconds;
 * dataReadAt is absolute.
 */
export function freshnessMeta(f: Freshness = currentFreshness()) {
  return { dataAgeSeconds: f.dataAgeSeconds, dataReadAt: f.dataReadAt }
}

/** Cache-Control for an answer: CDN-cacheable only when every read behind it was complete. */
export function cacheControlFor(f: Freshness = currentFreshness(), cacheable: string = API_CACHE_CONTROL): string {
  return f.complete ? cacheable : NO_STORE
}

/**
 * Standard API response wrapper.
 * All endpoints return this format. Inside `withReadLedger`, meta carries the answer's
 * freshness and an incomplete answer is sent `no-store`.
 */
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  const f = currentFreshness()
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
        ...freshnessMeta(f),
        ...meta,
      },
    },
    {
      headers: {
        'Cache-Control': cacheControlFor(f),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    }
  )
}

/**
 * Wrap a route handler so every read it makes is recorded in one ledger — what `apiSuccess`
 * reports as `meta.dataAgeSeconds`. Every /api/v1 GET that reads data is wrapped (a test checks).
 */
export function withReadLedger<A extends unknown[], R>(handler: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return (...args: A) => runWithReadLedger(() => handler(...args))
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

export function corsOptions() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(searchParams: URLSearchParams) {
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  return { limit: Math.max(1, limit), offset: Math.max(0, offset) }
}
