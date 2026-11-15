/**
 * The footer (Etap 8b): the brand and one short line, then two columns under mono headers —
 * BUILD (Docs, GitHub, llms.txt, MCP) and CONNECT (X, Discord). The contracts and the testnet note
 * stay in the bottom bar. A server component: hover states are CSS, no JavaScript.
 *
 * CONNECT has no "Atlas thread" link: no URL for it exists in the repo, and a link is never
 * guessed. Discord is Intuition's server (its #ecosystem channel, as /docs says), labelled so.
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { FOOTER_BRAND } from '@/lib/people-copy'

const CURRENT_YEAR = new Date().getFullYear()

export const FOOTER_COLUMNS = [
  {
    heading: 'Build',
    items: [
      { label: 'Docs', href: '/docs' },
      { label: 'GitHub', href: 'https://github.com/Kryptoremontier/agentscore', external: true },
      { label: 'llms.txt', href: '/llms.txt' },
      { label: 'MCP', href: '/docs#api' },
    ],
  },
  {
    heading: 'Connect',
    items: [
      { label: 'X', href: 'https://x.com/AgentScoreApp', external: true },
      { label: 'Discord (Intuition #ecosystem)', href: 'https://discord.gg/0xintuition', external: true },
    ],
  },
] as const

const LINK = 'group inline-flex items-center gap-1.5 text-sm text-[#7A838D] hover:text-white transition-colors'

export function Footer() {
  return (
    <footer className="relative overflow-hidden" data-testid="site-footer">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      <div className="absolute inset-0 bg-[#0C0E11]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-14 grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-10">
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center gap-2.5 w-fit">
              <span aria-hidden className="inline-block w-3 h-3 bg-accent" />
              <span className="font-display font-black uppercase tracking-[-0.02em] text-xl text-white">AgentScore</span>
            </Link>
            <p className="text-sm text-[#7A838D] max-w-xs">{FOOTER_BRAND}</p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="eyebrow text-[#B5BDC6]">{col.heading}</h4>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    {'external' in item && item.external ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                        {item.label}
                        <ExternalLink aria-hidden className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </a>
                    ) : (
                      <Link href={item.href} className={LINK}>{item.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-px w-full bg-white/5" />

        <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#4A5260]">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span>© {CURRENT_YEAR} AgentScore</span>
            <span className="flex items-center gap-2">
              <span>Contracts:</span>
              <a href="https://testnet.explorer.intuition.systems/address/0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41" target="_blank" rel="noopener noreferrer" className="hover:text-[#7A838D] transition-colors">FeeProxy ↗</a>
              <span className="opacity-40">|</span>
              <a href="https://testnet.explorer.intuition.systems/address/0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91" target="_blank" rel="noopener noreferrer" className="hover:text-[#7A838D] transition-colors">MultiVault ↗</a>
            </span>
          </div>
          <span>Testnet. Not financial advice.</span>
        </div>
      </div>
    </footer>
  )
}
