import Link from 'next/link'
import type { Metadata } from 'next'
import { PageBackground } from '@/components/shared/PageBackground'
import { CheckBox } from '@/components/check/CheckBox'
import { CheckResultCard } from '@/components/check/CheckResultCard'
import { CheckShare } from '@/components/check/CheckShare'
import { checkCard } from '@/lib/check-data'
import { encodeForCache } from '@/lib/json-codec'
import { CHECK_TITLE, CHECK_NOT_FOUND, CHECK_BROWSE, CHECK_UNREAD, CHECK_IMAGE_ALT, TIER_UNREAD, OVER_TIME_NOBODY, STORY_SECTIONS } from '@/lib/people-copy'
import { getTrustStory } from '@/lib/trust-story-data'
import { TrustOverTimeCard, TrustOverTimeUnread } from '@/components/trust/TrustOverTimeCard'

/**
 * /check/[id] — one agent's card at an address a person can share (Etap 7 Run B). The same card as
 * /check, read the same way (lib/check-data.ts), with its permalink and "Share on X"; the link
 * previews as the same card (./og — the same data, its age printed on it). Under it (Etap 8b Run B):
 * the landing's trust-over-time card in compact form — the same reader, the same <3-events rule.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const card = await checkCard(params.id)
  if (typeof card === 'string') return { title: `${CHECK_TITLE} · AgentScore` }
  const description = card.line.claim ?? TIER_UNREAD
  // The preview is ./og (a no-store route): the same card, its data's age printed on it.
  const images = [{ url: `/check/${card.id}/og`, width: 1200, height: 630, alt: CHECK_IMAGE_ALT }]
  return {
    title: `${card.name} · ${CHECK_TITLE} · AgentScore`,
    description,
    openGraph: { title: card.name, description, images },
    twitter: { card: 'summary_large_image', title: card.name, description, images },
  }
}

export default async function CheckCardPage({ params }: { params: { id: string } }) {
  const card = await checkCard(params.id)
  const story = typeof card !== 'string' ? await getTrustStory(card.id) : null
  const now = new Date().toISOString()
  return (
    <PageBackground image="wave" opacity={0.2}>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-28 lg:pb-16">
        <CheckBox />
        <div className="mt-8 space-y-4">
          {typeof card !== 'string' ? (
            <CheckResultCard
              encoded={encodeForCache(card)}
              footer={<CheckShare id={card.id} name={card.name} people={card.attesters ? card.attesters.length : null} />}
            />
          ) : card === 'not-found' ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" data-testid="check-notfound">
              <p className="text-white">{CHECK_NOT_FOUND}</p>
              <Link href="/agents" className="mt-3 inline-block text-sm text-[#C8963C] hover:underline">{CHECK_BROWSE}</Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" data-testid="check-unread">
              <p className="text-[#B5BDC6]">{CHECK_UNREAD}</p>
            </div>
          )}
          {typeof card !== 'string' && story && (
            story.status !== 'ok' ? <TrustOverTimeUnread compact />
            : story.events.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#111318]/85 p-4" data-testid="trust-over-time" data-state="none">
                <p className="eyebrow text-[#7A838D]">{STORY_SECTIONS.overTime.label}</p>
                <p className="mt-3 text-sm text-[#B5BDC6]">{OVER_TIME_NOBODY}</p>
              </div>
            ) : (
              <TrustOverTimeCard
                agentId={card.id}
                agentName={card.name}
                events={story.events}
                names={story.names}
                first={story.first}
                people={card.attesters ? card.attesters.length : new Set(story.events.map((e) => e.wallet.toLowerCase())).size}
                tier={card.tier ? { display: card.tier.display, attesters: card.tier.attesters } : null}
                readAt={[card.dataReadAt, story.readAt].sort()[0]}
                now={now}
                compact
              />
            )
          )}
        </div>
      </main>
    </PageBackground>
  )
}
