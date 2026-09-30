/**
 * What a timeline entry says on screen (Etap 6). The events come from lib/trust-timeline.ts —
 * which REST and MCP serve too, so their words don't change there. A pre-canonical skill claim
 * reads "Skill added: watch"; its raw text (the legacy predicate) stays in the entry's details.
 */

import type { TimelineEvent } from '@/lib/trust-timeline'
import { skillAdded } from '@/lib/people-copy'

export interface TimelineEntryView {
  title: string
  /** The line under the date; null = none. */
  description: string | null
  /** Collapsed under "Details"; null = none. */
  details: string | null
}

export function timelineEntryView(e: TimelineEvent): TimelineEntryView {
  const skill = e.metadata?.skillName
  if (e.type === 'skill_added' && typeof skill === 'string' && skill) {
    return { title: skillAdded(skill), description: null, details: e.description }
  }
  return { title: e.title, description: e.description, details: null }
}
