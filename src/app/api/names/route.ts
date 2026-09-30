/**
 * GET /api/names?w=0xabc,0xdef — ENS names for wallets (lib/person-names-server.ts), for the UI's
 * <PersonName>. Internal: not part of the /api/v1 REST surface. `{ names: { [lowercase]: string | null } }`,
 * null = no ENS name; a wallet whose read failed is absent.
 */

import { NextResponse } from 'next/server'
import { resolvePersonNames } from '@/lib/person-names-server'
import { NAMES_BATCH } from '@/lib/person-names'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('w') ?? ''
  const wallets = raw.split(',').map((w) => w.trim()).filter(Boolean).slice(0, NAMES_BATCH * 2)
  const names = await resolvePersonNames(wallets)
  return NextResponse.json({ names }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
