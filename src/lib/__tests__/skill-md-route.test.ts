import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { GET } from '@/app/skill.md/route'
import { renderTrustText, EXAMPLE_TRUST_BREAKDOWN } from '@/lib/agent-surface'

const REPO_SKILL_MD = fs.readFileSync(path.join(process.cwd(), 'SKILL.md'), 'utf-8')

describe('GET /skill.md', () => {
  it('is text/plain and serves bytes byte-identical to the repo SKILL.md', async () => {
    const res = await GET()
    expect(res.headers.get('content-type')).toContain('text/plain')

    const text = await res.text()
    expect(text).toBe(REPO_SKILL_MD)
  })

  it('has activation frontmatter naming the skill', () => {
    expect(REPO_SKILL_MD).toMatch(/^---\s*\nname: agentscore-reputation-check\n/)
    expect(REPO_SKILL_MD).toContain('description:')
  })

  it('embeds the real curl one-liner and a real renderTrustText() example — cannot silently drift', () => {
    expect(REPO_SKILL_MD).toContain(
      `curl "https://agentscore-gilt.vercel.app/api/v1/agents/${EXAMPLE_TRUST_BREAKDOWN.agentId}/trust?format=text"`
    )
    expect(REPO_SKILL_MD).toContain(renderTrustText(EXAMPLE_TRUST_BREAKDOWN).trim())
  })

  it('points at the full manual and leads with the score.objectScore fallback', () => {
    expect(REPO_SKILL_MD).toContain('/llms.txt')
    expect(REPO_SKILL_MD).toContain('score.objectScore ?? score.trustScore')
  })

  it('does not instruct the agent to take actions beyond reading scores', () => {
    expect(REPO_SKILL_MD.toLowerCase()).not.toContain('register_agent')
    expect(REPO_SKILL_MD.toLowerCase()).not.toMatch(/\bstake\b.*\bnow\b/)
  })
})
