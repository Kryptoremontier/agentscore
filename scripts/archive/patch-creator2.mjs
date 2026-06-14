import { readFileSync, writeFileSync } from 'fs'

// Safe creator hiding — line-by-line replacements only, no regex with gs flag
// Strategy: replace specific JSX elements containing creator display

function patchPage(path) {
  let c = readFileSync(path, 'utf8')

  // 1. Card grid: hide <span> with creator
  // agents: <span className="...bg-[#1e2028]...">{creator.replace('.eth', '')}</span>
  c = c.replace(
    `<span className="text-xs text-[#7A838D] bg-[#1e2028] px-2 py-0.5 rounded inline-block">
                              {creator.replace('.eth', '')}
                            </span>`,
    `{/* creator hidden — shows FeeProxy address when routing via proxy */}`
  )

  // 2. Card list: hide <p> with creator
  c = c.replace(
    `<p className="text-[11px] text-[#7A838D] truncate">{creator.replace('.eth', '')}</p>`,
    `{/* creator hidden */}`
  )

  // 3. isCreator check in positions list
  c = c.replace(
    `const isCreator = selectedAgent.creator?.id &&
                                    pos.account_id?.toLowerCase() === selectedAgent.creator.id.toLowerCase()`,
    `const isCreator = false // creator = FeeProxy address when routing via proxy`
  )
  c = c.replace(
    `const isCreator = selectedSkill.creator?.id &&
                                    pos.account_id?.toLowerCase() === selectedSkill.creator.id.toLowerCase()`,
    `const isCreator = false // creator = FeeProxy address when routing via proxy`
  )
  c = c.replace(
    `const isCreator = selectedClaim.creator?.id && pos.account_id?.toLowerCase() === selectedClaim.creator.id.toLowerCase()`,
    `const isCreator = false // creator = FeeProxy address when routing via proxy`
  )

  return c
}

// ── agents/page.tsx ──────────────────────────────────────────────────────────
{
  let c = patchPage('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/agents/page.tsx')

  // Detail panel creator display — replace entire block with "via AgentScore"
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

  // claim.creator line at bottom of claims list (minor — hide)
  c = c.replace(
    `                      {claim.creator && (
                          Created by {claim.creator.label?.replace('.eth', '') || 'unknown'}`,
    `                      {false && (
                          Created by {claim.creator?.label?.replace('.eth', '') || 'unknown'}`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/agents/page.tsx', c)
  console.log('agents/page.tsx patched')
}

// ── skills/page.tsx ──────────────────────────────────────────────────────────
{
  let c = patchPage('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/skills/page.tsx')

  // Card grid: skills uses same pattern but with "skill" variable name
  c = c.replace(
    `<span className="text-xs text-[#7A838D] bg-[#1e2028] px-2 py-0.5 rounded inline-block">
                              {creator.replace('.eth', '')}
                            </span>`,
    `{/* creator hidden */}`
  )
  c = c.replace(
    `<p className="text-[11px] text-[#7A838D] truncate">{creator.replace('.eth', '')}</p>`,
    `{/* creator hidden */}`
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
    `                      {claim.creator && (
                          Created by {claim.creator.label?.replace('.eth', '') || 'unknown'}`,
    `                      {false && (
                          Created by {claim.creator?.label?.replace('.eth', '') || 'unknown'}`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/skills/page.tsx', c)
  console.log('skills/page.tsx patched')
}

// ── claims/page.tsx ──────────────────────────────────────────────────────────
{
  let c = patchPage('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/claims/page.tsx')

  c = c.replace(
    `                      {selectedClaim.creator?.id ? (
                        <a href={\`/profile/\${selectedClaim.creator.id}\`} className="bg-[#1E2229] px-2 py-0.5 rounded text-xs hover:bg-[#252B33] hover:text-white transition-colors">
                          {selectedClaim.creator.label || selectedClaim.creator.id.slice(0, 10)}
                        </a>
                      ) : selectedClaim.creator?.label ? (
                        <span className="bg-[#1E2229] px-2 py-0.5 rounded text-xs">{selectedClaim.creator.label}</span>`,
    `                      {false ? (<a href="">-</a>
                      ) : false ? (
                        <span>-</span>`
  )

  c = c.replace(
    `                              {selectedClaim.creator?.id ? (
                              <Link href={\`/profile/\${selectedClaim.creator.id}\`} className="text-[#C8963C] text-xs font-medium hover:underline">
                                {selectedClaim.creator.label?.replace('.eth','') || selectedClaim.creator.id.slice(0,10)}`,
    `                              {false ? (
                              <Link href="" className="">
                                {''}`
  )

  writeFileSync('D:/VIBE-CODING/AGENT_SCORE_INTUITION/src/app/claims/page.tsx', c)
  console.log('claims/page.tsx patched')
}
