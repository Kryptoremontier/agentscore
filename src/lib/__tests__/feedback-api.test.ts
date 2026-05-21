import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { NextRequest } from 'next/server'

const originalCwd = process.cwd()
let tempDir: string

async function loadRoutes() {
  vi.resetModules()
  return {
    feedback: await import('@/app/api/feedback/route'),
    feedbackById: await import('@/app/api/feedback/[id]/route'),
  }
}

function jsonRequest(url: string, body?: unknown, headers?: Record<string, string>) {
  return new NextRequest(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'agentscore-feedback-'))
  process.chdir(tempDir)
  delete process.env.FEEDBACK_ADMIN_TOKEN
})

afterEach(async () => {
  process.chdir(originalCwd)
  await rm(tempDir, { recursive: true, force: true })
})

describe('feedback API auth and persistence', () => {
  it('allows public POST with valid JSON feedback', async () => {
    const { feedback } = await loadRoutes()

    const res = await feedback.POST(jsonRequest('http://localhost/api/feedback', {
      sender: '0xabc',
      message: 'This bug report is long enough.',
    }))

    expect(res.status).toBe(201)
    const entry = await res.json()
    expect(entry.sender).toBe('0xabc')
    expect(entry.resolved).toBe(false)
  })

  it('rejects GET without admin token', async () => {
    const { feedback } = await loadRoutes()

    const res = await feedback.GET(jsonRequest('http://localhost/api/feedback'))

    expect(res.status).toBe(401)
  })

  it('allows GET with dev admin fallback token outside production', async () => {
    const { feedback } = await loadRoutes()

    await feedback.POST(jsonRequest('http://localhost/api/feedback', {
      message: 'This bug report is long enough.',
    }))
    const res = await feedback.GET(jsonRequest('http://localhost/api/feedback', undefined, {
      'x-admin-token': 'dev-admin',
    }))

    expect(res.status).toBe(200)
    const entries = await res.json()
    expect(entries).toHaveLength(1)
  })

  it('requires admin token for PATCH', async () => {
    const { feedback, feedbackById } = await loadRoutes()

    const created = await feedback.POST(jsonRequest('http://localhost/api/feedback', {
      message: 'This bug report is long enough.',
    }))
    const entry = await created.json()

    const noToken = await feedbackById.PATCH(
      new NextRequest(`http://localhost/api/feedback/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      }),
      { params: Promise.resolve({ id: entry.id }) },
    )
    expect(noToken.status).toBe(401)

    const withToken = await feedbackById.PATCH(
      new NextRequest(`http://localhost/api/feedback/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'dev-admin' },
        body: JSON.stringify({ resolved: true }),
      }),
      { params: Promise.resolve({ id: entry.id }) },
    )
    expect(withToken.status).toBe(200)
    expect((await withToken.json()).resolved).toBe(true)
  })
})
