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
    expect(EXPLAINERS.vouch.text).toBe('To trust an agent is to put a little tTRUST behind one claim: this agent is good at this trust context. It’s on-chain, with your wallet on it.')
    // Etap 8a: the tier "?" carries the one line that maps the label to the API value.
    expect(EXPLAINERS.tiers.label).toBe('What do Unverified, Established and Verified mean?')
    expect(EXPLAINERS.tiers.text).toBe('Established (`trusted` in the API): at least 2 people and 0.05 tTRUST. Verified: at least 3 people and 0.1 tTRUST. One wallet can never lift an agent on its own.')
    expect(EXPLAINERS.backing.text).toBe('Capital on the agent itself. It never changes the tier. It is how much tTRUST sits on the agent, not who trusts it.')
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
    expect(html).toContain('aria-label="What does it mean to trust an agent?"')
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

  it('the stat row (modal and profile): vouch and tTRUST in their boxes; the backing score and its "?" under Details (Etap 9)', () => {
    const row = code('components/profile/ProfileStatRow.tsx')
    expect(row).toMatch(/\[STAT_PEOPLE\(1\)\]: 'vouch'/)
    expect(row).toMatch(/\[STAT_STAKE\]: 'ttrust'/)
    expect(row).not.toMatch(/<Explainer term="backing"/)
    expect(code('components/profile/AgentDetails.tsx')).toMatch(/\{backing\}\s*<Explainer term="backing" \/>/)
  })

  it('the tier names: beside the tier chip in the modal and both profile layouts', () => {
    expect(code('app/agents/agents-client.tsx')).toMatch(/<AgentTierChip tier=\{agentTier\} loading=\{!profileLoaded\} \/>\s*<Explainer term="tiers" \/>/)
    expect(code('components/agents/AgentHeader.tsx')).toMatch(/<AgentTierChip[^>]*\/>\s*<Explainer term="tiers" \/>/)
    expect(code('app/agents/[id]/page.tsx')).toMatch(/<AgentTierChip[^>]*\/>\s*<Explainer term="tiers" \/>/)
  })

  it('every surface explains all four', () => {
    const modal = terms(['app/agents/agents-client.tsx', 'components/profile/ProfileStatRow.tsx', 'components/profile/AgentDetails.tsx'])
    const profile = terms(['app/agents/[id]/page.tsx', 'components/agents/AgentHeader.tsx', 'components/profile/ProfileStatRow.tsx', 'components/profile/AgentDetails.tsx'])
    for (const t of ['vouch', 'tiers', 'backing', 'ttrust']) {
      expect(modal.has(t), `modal: ${t}`).toBe(true)
      expect(profile.has(t), `profile: ${t}`).toBe(true)
    }
    // The landing (Etap 8b) explains the words it uses: trust (step 02) and the tier (the card's chip).
    // It no longer prints a backing score or a tTRUST amount, so those two have nothing to sit beside.
    const landing = terms(['components/landing/Hero.tsx', 'components/landing/HowItWorks.tsx', 'components/trust/TrustOverTimeCard.tsx'])
    for (const t of ['vouch', 'tiers']) expect(landing.has(t), `landing: ${t}`).toBe(true)
  })

  it('the landing: trust right after the step that names it; tiers beside the card\'s chip', () => {
    expect(code('components/landing/HowItWorks.tsx')).toMatch(/step\.num === '02' && <Explainer term="vouch"/)
    const card = code('components/trust/TrustOverTimeCard.tsx')
    expect(card.indexOf('<Explainer term="tiers" />')).toBeGreaterThan(card.indexOf('data-testid="trust-card-tier"'))
  })

  it('never a separate FAQ page', () => {
    expect(existsSync(path.join(SRC, 'app/faq'))).toBe(false)
  })
})
