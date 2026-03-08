import { readFileSync, writeFileSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────
// agents/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/agents/page.tsx', 'utf8')

  // 1. In cards: hide creator line (list view)
  // Pattern: "const creator = agent.creator?.label || 'unknown'" + JSX rendering
  c = c.replace(
    /const creator = agent\.creator\?\.label \|\| 'unknown'\n(\s+)(.*?){creator\.replace\('\.eth', ''\)}/gs,
    (m, spaces) => `const creator = ''\n${spaces}{''}` // replace with empty
  )

  // Simpler approach — just replace the two creator display blocks in cards
  c = c.replace(
    `                  const creator = agent.creator?.label || 'unknown'`,
    `                  const creator = null`
  )
  // There may be two instances
  c = c.replaceAll(
    `                  const creator = agent.creator?.label || 'unknown'`,
    `                  const creator = null`
  )

  // Hide creator text in card JSX (where it renders {creator.replace('.eth', '')})
  c = c.replaceAll(
    `{creator.replace('.eth', '')}`,
    `{''}` // render nothing
  )

  // 2. Detail panel: hide "Registered by" creator section (two places)
  // Pattern around line 1754
  c = c.replace(
    `                      {selectedAgent.creator?.id ? (
                          <a
                          href={\`/profile/\${selectedAgent.creator.id}\`}
                          className="text-[#C8963C] hover:underline text-xs truncate max-w-[120px]"
                          >
                          {selectedAgent.creator.label?.replace('.eth','') || selectedAgent.creator.id.slice(0, 10)}
                          </a>
                      ) : (
                          <p className="text-white text-xs truncate">{selectedAgent.creator?.label?.replace('.eth','') || 'unknown'}</p>
                      )}`,
    `<p className="text-[#7A838D] text-xs">via AgentScore</p>`
  )

  // Pattern around line 1793 — another creator link block (in detail panel)
  c = c.replace(
    `                    {selectedAgent.creator?.id ? (
                        <a
                          href={\`/profile/\${selectedAgent.creator.id}\`}
                          className="text-[#C8963C] text-xs hover:underline"
                        >
                          {selectedAgent.creator.label || selectedAgent.creator.id}
                        </a>
                      ) : (
                        <p className="text-[#7A838D] text-xs">{selectedAgent.creator?.label || '0x???'}</p>
                      )}`,
    `<p className="text-[#7A838D] text-xs">via AgentScore</p>`
  )

  // Pattern around line 3108 — creator in bottom info panel
  c = c.replace(
    `                          {selectedAgent.creator?.id ? (
                            <Link href={\`/profile/\${selectedAgent.creator.id}\`} className="text-[#C8963C] text-xs font-medium hover:underline">
                              {selectedAgent.creator.label?.replace('.eth', '') || selectedAgent.creator.id.slice(0, 10)}
                            </Link>
                          ) : (
                            <p className="text-white text-xs font-medium">{selectedAgent.creator?.label || 'unknown'}</p>
                          )}`,
    `<p className="text-white text-xs font-medium">via AgentScore</p>`
  )

  // 3. isCreator badge — set to false
  c = c.replace(
    `                                  const isCreator = selectedAgent.creator?.id &&
                                    pos.account_id?.toLowerCase() === selectedAgent.creator.id.toLowerCase()`,
    `                                  const isCreator = false // creator = FeeProxy address, not user`
  )

  // 4. claim.creator in agents page (bottom of claims list)
  c = c.replace(
    `                      {claim.creator && (
                          Created by {claim.creator.label?.replace('.eth', '') || 'unknown'}`,
    `                      {false && (
                          Created by {claim.creator?.label?.replace('.eth', '') || 'unknown'}`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/agents/page.tsx', c)
  console.log('agents/page.tsx creator patched')
}

// ─────────────────────────────────────────────────────────────────────────────
// skills/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/skills/page.tsx', 'utf8')

  c = c.replaceAll(
    `                  const creator = skill.creator?.label || 'unknown'`,
    `                  const creator = null`
  )

  c = c.replaceAll(
    `{creator.replace('.eth', '')}`,
    `{''}`
  )

  c = c.replace(
    `                      {selectedSkill.creator?.id ? (
                          <a
                          href={\`/profile/\${selectedSkill.creator.id}\`}
                          className="text-[#C8963C] hover:underline text-xs truncate max-w-[120px]"
                          >
                          {selectedSkill.creator.label?.replace('.eth','') || selectedSkill.creator.id.slice(0, 10)}
                          </a>
                      ) : (
                          <p className="text-white text-xs truncate">{selectedSkill.creator?.label?.replace('.eth','') || 'unknown'}</p>
                      )}`,
    `<p className="text-[#7A838D] text-xs">via AgentScore</p>`
  )

  c = c.replace(
    `                    {selectedSkill.creator?.id ? (
                        <a
                          href={\`/profile/\${selectedSkill.creator.id}\`}
                          className="text-[#C8963C] text-xs hover:underline"
                        >
                          {selectedSkill.creator.label || selectedSkill.creator.id}
                        </a>
                      ) : (
                        <p className="text-[#7A838D] text-xs">{selectedSkill.creator?.label || '0x???'}</p>
                      )}`,
    `<p className="text-[#7A838D] text-xs">via AgentScore</p>`
  )

  c = c.replace(
    `                          {selectedSkill.creator?.id ? (
                            <Link href={\`/profile/\${selectedSkill.creator.id}\`} className="text-[#C8963C] text-xs font-medium hover:underline">
                              {selectedSkill.creator.label?.replace('.eth', '') || selectedSkill.creator.id.slice(0, 10)}
                            </Link>
                          ) : (
                            <p className="text-white text-xs font-medium">{selectedSkill.creator?.label || 'unknown'}</p>
                          )}`,
    `<p className="text-white text-xs font-medium">via AgentScore</p>`
  )

  c = c.replace(
    `                                  const isCreator = selectedSkill.creator?.id &&
                                    pos.account_id?.toLowerCase() === selectedSkill.creator.id.toLowerCase()`,
    `                                  const isCreator = false // creator = FeeProxy address, not user`
  )

  c = c.replace(
    `                      {claim.creator && (
                          Created by {claim.creator.label?.replace('.eth', '') || 'unknown'}`,
    `                      {false && (
                          Created by {claim.creator?.label?.replace('.eth', '') || 'unknown'}`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/skills/page.tsx', c)
  console.log('skills/page.tsx creator patched')
}

// ─────────────────────────────────────────────────────────────────────────────
// claims/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
{
  let c = readFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/claims/page.tsx', 'utf8')

  // Hide creator section in claim detail panel
  c = c.replace(
    `                      {selectedClaim.creator?.id ? (
                        <a href={\`/profile/\${selectedClaim.creator.id}\`} className="bg-[#1E2229] px-2 py-0.5 rounded text-xs hover:bg-[#252B33] hover:text-white transition-colors">
                          {selectedClaim.creator.label || selectedClaim.creator.id.slice(0, 10)}
                        </a>
                      ) : selectedClaim.creator?.label ? (
                        <span className="bg-[#1E2229] px-2 py-0.5 rounded text-xs">{selectedClaim.creator.label}</span>`,
    `                      {false ? (
                        <a href="" className="">-</a>
                      ) : false ? (
                        <span>-</span>`
  )

  // isCreator in claims
  c = c.replace(
    `                                    const isCreator = selectedClaim.creator?.id && pos.account_id?.toLowerCase() === selectedClaim.creator.id.toLowerCase()`,
    `                                    const isCreator = false // creator = FeeProxy address, not user`
  )

  // Bottom creator link in claims
  c = c.replace(
    `                              {selectedClaim.creator?.id ? (
                              <Link href={\`/profile/\${selectedClaim.creator.id}\`} className="text-[#C8963C] text-xs font-medium hover:underline">
                                {selectedClaim.creator.label?.replace('.eth','') || selectedClaim.creator.id.slice(0,10)}`,
    `                              {false ? (
                              <Link href="" className="">
                                {''}`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/claims/page.tsx', c)
  console.log('claims/page.tsx creator patched')
}
