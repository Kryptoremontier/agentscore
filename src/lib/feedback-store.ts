import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

export interface FeedbackEntry {
  id: string
  sender: string
  message: string
  createdAt: string
  resolved: boolean
}

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'feedback.json')
const DEV_ADMIN_TOKEN = 'dev-admin'

export class FeedbackStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedbackStoreError'
  }
}

async function ensureDbFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(DB_PATH, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await writeFile(DB_PATH, '[]\n', 'utf-8')
  }
}

export async function readFeedbackEntries(): Promise<FeedbackEntry[]> {
  await ensureDbFile()
  const raw = await readFile(DB_PATH, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) throw new Error('feedback.json must contain an array')
    return parsed as FeedbackEntry[]
  } catch {
    throw new FeedbackStoreError('Feedback storage is corrupted. Please repair data/feedback.json before retrying.')
  }
}

export async function writeFeedbackEntries(entries: FeedbackEntry[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DB_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

export function getConfiguredAdminToken(): string | null {
  const token = process.env.FEEDBACK_ADMIN_TOKEN?.trim()
  if (token) return token
  return process.env.NODE_ENV === 'production' ? null : DEV_ADMIN_TOKEN
}

export function requireFeedbackAdmin(req: NextRequest): NextResponse | null {
  const token = getConfiguredAdminToken()
  if (!token) {
    return NextResponse.json(
      { error: 'FEEDBACK_ADMIN_TOKEN is not configured.' },
      { status: 503 },
    )
  }

  if (req.headers.get('x-admin-token') !== token) {
    return NextResponse.json({ error: 'Invalid admin token.' }, { status: 401 })
  }

  return null
}

export function isJsonRequest(req: NextRequest): boolean {
  return req.headers.get('content-type')?.toLowerCase().includes('application/json') ?? false
}
