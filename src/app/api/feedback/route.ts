import { NextRequest, NextResponse } from 'next/server'
import {
  FeedbackStoreError,
  isJsonRequest,
  readFeedbackEntries,
  requireFeedbackAdmin,
  writeFeedbackEntries,
  type FeedbackEntry,
} from '@/lib/feedback-store'

export async function GET(req: NextRequest) {
  const authError = requireFeedbackAdmin(req)
  if (authError) return authError

  try {
    const entries = await readFeedbackEntries()
    return NextResponse.json(entries)
  } catch (error) {
    const message = error instanceof FeedbackStoreError
      ? error.message
      : 'Unable to read feedback storage.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!isJsonRequest(req)) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json.' },
      { status: 415 },
    )
  }

  let body: { sender?: unknown; message?: unknown }
  try {
    body = await req.json() as { sender?: unknown; message?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message || message.length < 10) {
    return NextResponse.json(
      { error: 'Message must be at least 10 characters.' },
      { status: 400 },
    )
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: 'Message must be 4000 characters or less.' },
      { status: 400 },
    )
  }

  const sender = typeof body.sender === 'string' ? body.sender.trim() : ''
  if (sender.length > 200) {
    return NextResponse.json(
      { error: 'Sender must be 200 characters or less.' },
      { status: 400 },
    )
  }

  const entry: FeedbackEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: sender || 'Anonymous',
    message,
    createdAt: new Date().toISOString(),
    resolved: false,
  }

  try {
    const entries = await readFeedbackEntries()
    entries.unshift(entry)
    await writeFeedbackEntries(entries)
  } catch (error) {
    const message = error instanceof FeedbackStoreError
      ? error.message
      : 'Unable to write feedback storage.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json(entry, { status: 201 })
}
