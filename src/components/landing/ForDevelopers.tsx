'use client'

/**
 * "For developers" (Etap 6): a real agent answer. When the block comes into view it makes one MCP
 * call — get_agent_trust for the landing's example agent (the Hero's, components/landing/hero-agent)
 * — and prints the answer trimmed, with its own field names (components/landing/agent-answer.ts),
 * including meta.dataAgeSeconds: every answer says how old its data is. No answer → says so, never
 * a made-up one. Built from the Features cards' own style.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Code2, ArrowRight } from 'lucide-react'
import { DEV_HEADING, DEV_LINE, DEV_ANSWER_UNREAD, devAnswerCaption, LANDING_CTA_DEVELOPERS } from '@/lib/people-copy'
import { useHeroAgent } from './hero-agent'
import { askAgentTrust, trimAgentTrust, callLine } from './agent-answer'

type Answer = { status: 'waiting' } | { status: 'ok'; json: string } | { status: 'error' }

export function ForDevelopers({ className = '' }: { className?: string }) {
  const hero = useHeroAgent()
  const box = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [answer, setAnswer] = useState<Answer>({ status: 'waiting' })

  // Ask only once the block is near the screen — a visitor who never scrolls here costs no call.
  useEffect(() => {
    const el = box.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setInView(true) }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  useEffect(() => {
    if (!inView || hero === undefined) return
    if (hero === null) { setAnswer({ status: 'error' }); return }
    let cancelled = false
    setAnswer({ status: 'waiting' })
    askAgentTrust(hero.termId).then((a) => {
      if (cancelled) return
      setAnswer(a ? { status: 'ok', json: JSON.stringify(trimAgentTrust(a), null, 2) } : { status: 'error' })
    })
    return () => { cancelled = true }
  }, [inView, hero])

  return (
    <div
      ref={box}
      data-testid="for-developers"
      data-state={answer.status}
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(145deg, #16191E 0%, #1B1F26 100%)', border: '1px solid rgba(200,150,60,0.15)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-70" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,150,60,0.9) 50%, transparent)' }} />
      <div className="relative p-7 grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
        <div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(200,150,60,0.1)', border: '1px solid rgba(200,150,60,0.3)', boxShadow: '0 0 24px rgba(200,150,60,0.2)' }}
          >
            <Code2 className="w-6 h-6 text-[#C8963C]" />
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-display leading-display text-white mb-3">{DEV_HEADING}</h3>
          <p className="text-[#B5BDC6] leading-relaxed text-sm mb-5">{DEV_LINE}</p>
          <Link href="/docs" className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#C8963C] hover:text-[#E8B84B]">
            {LANDING_CTA_DEVELOPERS}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        <div className="min-w-0">
          <pre className="rounded-xl bg-[#0F1113] border border-white/[0.06] p-4 font-mono text-[11px] sm:text-xs leading-relaxed text-[#B5BDC6] overflow-x-auto" data-testid="agent-answer">
            <span className="text-[#C8963C]">{hero ? callLine(hero.termId) : callLine('0x…')}</span>
            {'\n'}
            {answer.status === 'ok' ? answer.json : answer.status === 'waiting' ? '…' : DEV_ANSWER_UNREAD}
          </pre>
          {hero && answer.status === 'ok' && <p className="mt-2 text-xs text-[#7A838D]">{devAnswerCaption(hero.name)}</p>}
        </div>
      </div>
    </div>
  )
}
