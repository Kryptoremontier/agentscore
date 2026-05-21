import { NextRequest, NextResponse } from 'next/server'
import {
  FeedbackStoreError,
  isJsonRequest,
  readFeedbackEntries,
  requireFeedbackAdmin,
  writeFeedbackEntries,
} from '@/lib/feedback-store'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireFeedbackAdmin(req)
  if (authError) return authError

  if (!isJsonRequest(req)) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json.' },
      { status: 415 },
    )
  }

  const { id } = await params
  let body: { resolved?: unknown }
  try {
    body = await req.json() as { resolved?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let entries
  try {
    entries = await readFeedbackEntries()
  } catch (error) {
    const message = error instanceof FeedbackStoreError
      ? error.message
      : 'Unable to read feedback storage.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
  const idx = entries.findIndex(e => e.id === id)

  if (idx === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  entries[idx] = {
    ...entries[idx],
    resolved: typeof body.resolved === 'boolean' ? body.resolved : !entries[idx].resolved,
  }
  await writeFeedbackEntries(entries)

  return NextResponse.json(entries[idx])
}
