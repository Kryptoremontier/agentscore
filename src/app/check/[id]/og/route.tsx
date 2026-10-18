import { ImageResponse } from 'next/og'
import { checkCard } from '@/lib/check-data'
import { resolvePersonNames } from '@/lib/person-names-server'
import { personName } from '@/lib/person-names'
import { updatedAgoLabel } from '@/lib/agents-page-types'
import { AGENT_TIER_DISPLAY, AGENT_TIER_LADDER } from '@/lib/agent-tier'
import { SEAL_SLOTS } from '@/components/agents/seal-slots'
import { CHECK_TITLE, CHECK_NOT_FOUND, CHECK_IMAGE_UNREAD, ORIGIN_LABEL, checkImageAge, tierProgress, SEAL_OPEN } from '@/lib/people-copy'

/**
 * GET /check/[id]/og — the /check/[id] link preview (Etap 7 Run B): the same card, drawn from the
 * same read as the page (lib/check-data.ts checkCard) — name, seals, who vouches, tier — with the
 * data's age printed on the image, so a preview a platform keeps still says how old its numbers
 * are. Rendered per request and sent no-store: a route, not the opengraph-image file convention,
 * which Next serves "immutable, max-age=31536000" (a year-old picture beside today's numbers).
 * A failed read draws no numbers at all.
 */
export const dynamic = 'force-dynamic'
const size = { width: 1200, height: 630 }
const headers = { 'cache-control': 'no-store' } // lowercase: replaces next/og's own "immutable" key (a capitalised one would be added beside it)

const BG = '#0A0A0F'
const ACCENT = '#F5A524'
const MUTED = '#7A838D'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, padding: 64, color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28 }}>
        <div style={{ display: 'flex' }}>
          <span style={{ color: 'white', fontWeight: 700 }}>Agent</span>
          <span style={{ color: ACCENT, fontWeight: 700 }}>Score</span>
        </div>
        <span style={{ color: MUTED, fontSize: 24 }}>{CHECK_TITLE}</span>
      </div>
      {children}
    </div>
  )
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const card = await checkCard(params.id)
  if (typeof card === 'string') {
    return new ImageResponse(
      <Frame><div style={{ display: 'flex', marginTop: 180, fontSize: 40, color: '#B5BDC6' }}>{card === 'not-found' ? CHECK_NOT_FOUND : CHECK_IMAGE_UNREAD}</div></Frame>,
      { ...size, headers },
    )
  }

  const attesters = card.attesters
  const names = attesters ? await resolvePersonNames(attesters.map((a) => a.wallet)).catch(() => ({} as Record<string, string | null>)) : {}
  const slots = Array.from({ length: SEAL_SLOTS }, (_, i) => attesters?.[i] ?? null)
  const needed = AGENT_TIER_LADDER.verified.minAttesters

  return new ImageResponse(
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44 }}>
        <div style={{ display: 'flex', fontSize: card.name.length > 28 ? 56 : 76, fontWeight: 800, lineHeight: 1.05 }}>{card.name}</div>
        <div style={{ display: 'flex', fontSize: 24, color: MUTED, marginTop: 10 }}>{ORIGIN_LABEL[card.origin]}</div>
        <div style={{ display: 'flex', fontSize: 40, color: card.line.kind === 'some' ? ACCENT : '#B5BDC6', marginTop: 28, fontWeight: 600 }}>
          {card.line.claim ?? CHECK_IMAGE_UNREAD}
        </div>
      </div>

      {attesters && (
        <div style={{ display: 'flex', gap: 28, marginTop: 34 }}>
          {slots.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, width: 330 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22, display: 'flex', flexShrink: 0,
                background: a ? 'rgba(245,165,36,0.18)' : 'transparent',
                border: a ? `3px solid ${ACCENT}` : '3px dashed rgba(245,165,36,0.4)',
              }} />
              {/* A fixed width each, cut with an ellipsis: a long name or several areas never run into the next seal. */}
              <div style={{ display: 'flex', flexDirection: 'column', width: 260, overflow: 'hidden' }}>
                <span style={{ fontSize: 22, color: a ? 'white' : MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a ? personName(a.wallet, names[a.wallet.toLowerCase()]) : SEAL_OPEN}</span>
                {a && <span style={{ fontSize: 18, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.domains.join(' · ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexGrow: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {card.tier && (
            <span style={{ display: 'flex', padding: '6px 16px', borderRadius: 999, border: `2px solid ${card.tier.display.color}`, color: card.tier.display.color, fontSize: 24 }}>
              {AGENT_TIER_DISPLAY[card.tier.tier].label}
            </span>
          )}
          {card.tier && card.tier.tier !== 'verified' && <span style={{ color: MUTED }}>{tierProgress(card.tier.attesters, needed)}</span>}
        </div>
        <span style={{ color: MUTED, fontSize: 20 }}>{checkImageAge(card.dataReadAt, updatedAgoLabel(card.dataAgeSeconds))}</span>
      </div>
    </Frame>,
    { ...size, headers },
  )
}
