import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

/**
 * SKILL.md has exactly one copy — the repo root file. Reading it here (at
 * module load, i.e. build/cold-start time) instead of hand-copying its
 * content means the two can never drift; skill-md-route.test.ts asserts the
 * served bytes equal the repo file.
 */
const SKILL_MD = fs.readFileSync(path.join(process.cwd(), 'SKILL.md'), 'utf-8')

export async function GET() {
  return new NextResponse(SKILL_MD, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
