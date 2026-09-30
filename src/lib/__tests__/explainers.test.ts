/**
 * Etap 6 commit 2 — explain at the point of use. Four words a newcomer doesn't know, one short
 * explainer each, on a small "?" next to the word's first use on the modal, the profile and the
 * landing (components/shared/Explainer) — never a separate FAQ page. A real <button> with an
 * aria-label; keyboard-open and Esc-close are exercised against the running app by the local
 * e2e spec (tests/e2e/.local/explain6.spec.ts).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXPLAINERS } from '../people-copy'
import { INTUITION_HUB_URL } from '../intuition-links'
import { Explainer } from '../../components/shared/Explainer'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')

describe('the four explainers — the words from the spec', () => {
  it('vouch, tiers, backing score, tTRUST', () => {
    expect(EXPLAINERS.vouch.text).toBe('A vouch is a person putting a little tTRUST behind one claim: this agent is good at this area. It’s on-chain, with their wallet on it.')
    expect(EXPLAINERS.tiers.text).toBe('Trusted takes 2 different people, Verified takes 3. One wallet can never lift an agent on its own.')
    expect(EXPLAINERS.backing.text).toBe('How much tTRUST sits on the agent itself. Backing is not vouching — it never changes the tier.')
    expect(EXPLAINERS.ttrust.text).toBe('Intuition’s testnet token. It’s free — get it from the Intuition Hub.')
  })

  it('tTRUST links to the Intuition Hub, inside its own sentence', () => {
    expect(EXPLAINERS.ttrust.link).toEqual({ text: 'Intuition Hub', href: INTUITION_HUB_URL })
    expect(EXPLAINERS.ttrust.text).toContain(EXPLAINERS.ttrust.link!.text)
  })

  it('each has a question as its accessible name', () => {
    for (const e of Object.values(EXPLAINERS)) expect(e.label).toMatch(/^What .+\?$/)
  })
})

describe('<Explainer> — a real button, closed until asked', () => {
  it('a <button type="button"> with an aria-label, aria-expanded="false" and no panel yet', () => {
    const html = renderToStaticMarkup(createElement(Explainer, { term: 'vouch' }))
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('aria-label="What is a vouch?"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('data-term="vouch"')
    expect(html).not.toContain('explainer-panel')
  })

  it('opens on click (Enter / Space on a native button), closes on Esc and outside clicks, gives focus back', () => {
    const src = code('components/shared/Explainer.tsx')
    expect(src).toMatch(/onClick=\{toggle\}/)
    expect(src).toMatch(/ev\.key !== 'Escape'/)
    expect(src).toMatch(/close\(true\)/)
    expect(src).toMatch(/addEventListener\('pointerdown'/)
    expect(src).toMatch(/role="dialog"/)
  })
})

describe('where the "?" sits — next to the word, on the modal, the profile and the landing', () => {
  const terms = (files: string[]) => new Set(files.flatMap((f) => [...code(f).matchAll(/<Explainer term="(\w+)"/g)].map((m) => m[1]).concat(
    [...code(f).matchAll(/'(vouch|tiers|backing|ttrust)'/g)].map((m) => m[1]),
  )))

  it('the stat row (modal and profile): vouch and tTRUST in their boxes, the backing score beside it', () => {
    const row = code('components/profile/ProfileStatRow.tsx')
    expect(row).toMatch(/\[STAT_PEOPLE\(1\)\]: 'vouch'/)
    expect(row).toMatch(/\[STAT_STAKE\]: 'ttrust'/)
    expect(row).toMatch(/\{backing\}\s*<Explainer term="backing" \/>/)
  })

  it('the tier names: beside the tier chip in the modal and both profile layouts', () => {
    expect(code('app/agents/page.tsx')).toMatch(/<AgentTierChip tier=\{agentTier\} loading=\{!profileLoaded\} \/>\s*<Explainer term="tiers" \/>/)
    expect(code('components/agents/AgentHeader.tsx')).toMatch(/<AgentTierChip[^>]*\/>\s*<Explainer term="tiers" \/>/)
    expect(code('app/agents/[id]/page.tsx')).toMatch(/<AgentTierChip[^>]*\/>\s*<Explainer term="tiers" \/>/)
  })

  it('every surface explains all four', () => {
    const modal = terms(['app/agents/page.tsx', 'components/profile/ProfileStatRow.tsx'])
    const profile = terms(['app/agents/[id]/page.tsx', 'components/agents/AgentHeader.tsx', 'components/profile/ProfileStatRow.tsx'])
    const landing = terms(['components/landing/Hero.tsx', 'components/landing/ExampleAgentCard.tsx', 'components/landing/HowItWorks.tsx'])
    for (const t of ['vouch', 'tiers', 'backing', 'ttrust']) {
      expect(modal.has(t), `modal: ${t}`).toBe(true)
      expect(profile.has(t), `profile: ${t}`).toBe(true)
      expect(landing.has(t), `landing: ${t}`).toBe(true)
    }
  })

  it('the landing: vouch after its first line, tTRUST right after the word in How it works', () => {
    expect(code('components/landing/Hero.tsx')).toMatch(/\{LANDING_SUB\} <Explainer term="vouch"/)
    expect(code('components/landing/HowItWorks.tsx')).toMatch(/explain: \{ after: 'tTRUST', term: 'ttrust'/)
  })

  it('the example card: a button never inside its link — the name is the (stretched) link', () => {
    const card = code('components/landing/ExampleAgentCard.tsx')
    const link = card.slice(card.indexOf('<Link'), card.indexOf('</Link>'))
    expect(link).not.toContain('<Explainer')
    expect(link).toMatch(/after:absolute after:inset-0/)
    expect(card).toMatch(/<Explainer term="backing" \/>/)
    expect(card).toMatch(/<Explainer term="tiers" \/>/)
  })

  it('never a separate FAQ page', () => {
    expect(existsSync(path.join(SRC, 'app/faq'))).toBe(false)
  })
})
