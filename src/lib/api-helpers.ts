import { NextResponse } from 'next/server'

/**
 * Standard API response wrapper.
 * All endpoints return this format.
 */
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
        ...meta,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    }
  )
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
