import { badgeState } from '@/lib/badge-data'
import { badgeSvg, BADGE_CACHE_OK, BADGE_CACHE_GREY } from '@/lib/badge'

/**
 * GET /badge/<id>.svg — one badge for a README (Etap 9, lib/badge.ts):
 * "AgentScore · {tier label} · N people trust it · as of {read time}". The same read as /check
 * (lib/badge-data.ts → lib/check-data.ts): any id the /check box takes that names exactly one agent. The tier is the
 * tier rule's own answer for the people read — nothing new is computed here.
 *
 * A failed read — the list, or who trusts this agent — is a grey "AgentScore · unknown": never the
 * last numbers, never "0 people". Always 200 with an image: a README shows a broken picture for
 * anything else.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  let id = params.id
  try { id = decodeURIComponent(id) } catch { /* not percent-encoded: as given */ }
  const state = await badgeState(id.replace(/\.svg$/i, ''))
  return new Response(badgeSvg(state), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': state.kind === 'ok' ? BADGE_CACHE_OK : BADGE_CACHE_GREY,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
