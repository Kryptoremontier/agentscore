/**
 * 02 / Trust over time (Etap 8b): the trust-over-time card for one real agent — the one the most
 * distinct people trust, a tie going to the oldest trust event (lib/landing-data.ts). Live, on-chain
 * data with its age; a failed read is the card's honest error, never a placeholder.
 */

import { STORY_SECTIONS, OVER_TIME_HEADING, OVER_TIME_NONE } from '@/lib/people-copy'
import type { LandingData } from '@/lib/landing-data'
import { TrustOverTimeCard, TrustOverTimeUnread } from '@/components/trust/TrustOverTimeCard'
import { StorySection } from './story-parts'

export function TrustOverTime({ story, now }: { story: LandingData['story']; now: string }) {
  return (
    <StorySection id="trust-over-time" section={STORY_SECTIONS.overTime} heading={OVER_TIME_HEADING}>
      {story.status === 'ok' ? (
        <TrustOverTimeCard
          agentId={story.value.card.id}
          agentName={story.value.card.name}
          events={story.value.events}
          names={story.value.names}
          first={story.value.first}
          people={story.value.card.attesters?.length ?? 0}
          tier={story.value.card.tier ? { display: story.value.card.tier.display, attesters: story.value.card.tier.attesters } : null}
          readAt={[story.value.card.dataReadAt, story.value.eventsReadAt].sort()[0]}
          now={now}
        />
      ) : story.status === 'none' ? (
        <p className="text-[#B5BDC6]" data-testid="trust-over-time" data-state="none">{OVER_TIME_NONE}</p>
      ) : (
        <TrustOverTimeUnread />
      )}
    </StorySection>
  )
}
