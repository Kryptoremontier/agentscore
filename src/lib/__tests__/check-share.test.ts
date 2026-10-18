/**
 * Etap 7 Run B commit 2 — a card people can share: /check/[id] is the card's permalink, the link
 * previews as the same card (Open Graph image from the same read, its age printed on it), and
 * "Share on X" carries "{name}: {N} people vouch on AgentScore. Who vouches for your agent?".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { shareOnXUrl, checkPermalink } from '@/components/check/CheckShare'
import { checkShareText, checkImageAge } from '../people-copy'
import { SITE_URL } from '../site'
import type { CheckCard } from '../check-agent'

const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const KRYPTO = '0x139219107C1eBE569f543C581b3B807Cf6740006'

const checkCard = vi.fn<(id: string) => Promise<CheckCard | 'unread' | 'not-found'>>()
vi.mock('../check-data', () => ({ checkCard: (id: string) => checkCard(id), checkLookup: vi.fn() }))
vi.mock('../person-names-server', () => ({ resolvePersonNames: vi.fn(async () => ({ [KRYPTO.toLowerCase()]: 'kryptoremontier.eth' })) }))

const DACKIE_CARD: CheckCard = {
  id: DACKIE, name: 'Captain Dackie', origin: 'erc8004',
  line: { kind: 'some', claim: '1 person vouches · for Crypto / Onchain', cta: false, attesters: 1, domains: 1 },
  attesters: [{ wallet: KRYPTO, domains: ['Crypto / Onchain'], totalStake: 9_900_000_000_000_000n }],
  tier: null, backing: null, backingTip: '', dataAgeSeconds: 420, dataReadAt: '2026-10-18T18:01:12.000Z',
}

beforeEach(() => checkCard.mockReset())

describe('Share on X', () => {
  it('the post: "{name}: {N} people vouch on AgentScore. Who vouches for your agent?" + the card\'s permalink', () => {
    expect(checkShareText('Luda', 2)).toBe('Luda: 2 people vouch on AgentScore. Who vouches for your agent?')
    expect(checkShareText('Captain Dackie', 1)).toBe('Captain Dackie: 1 person vouches on AgentScore. Who vouches for your agent?')
    const url = new URL(shareOnXUrl('Captain Dackie', 1, DACKIE))
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post')
    expect(url.searchParams.get('text')).toBe(checkShareText('Captain Dackie', 1))
    expect(url.searchParams.get('url')).toBe(`${SITE_URL}/check/${DACKIE}`)
    expect(checkPermalink(DACKIE)).toBe(`/check/${DACKIE}`)
  })

  it('no number to share when who vouches couldn\'t be read: the link only', () => {
    const share = readFileSync('src/components/check/CheckShare.tsx', 'utf8')
    expect(share).toMatch(/\{people !== null && \(/)
    const page = readFileSync('src/app/check/[id]/page.tsx', 'utf8')
    expect(page).toMatch(/people=\{card\.attesters \? card\.attesters\.length : null\}/)
  })

  it('one site URL: metadataBase and share links', () => {
    expect(readFileSync('src/app/layout.tsx', 'utf8')).toMatch(/metadataBase: new URL\(SITE_URL\)/)
  })
})

describe('/check → the card\'s permalink', () => {
  it('one agent found → a redirect to /check/[id]; a pick list links to permalinks', () => {
    const page = readFileSync('src/app/check/page.tsx', 'utf8')
    expect(page).toMatch(/if \(lookup\?\.resolution\.status === 'found'\) redirect\(checkPermalink\(lookup\.resolution\.id\)\)/)
    expect(page).toMatch(/href=\{checkPermalink\(c\.id\)\}/)
  })

  it('the permalink page reads the same card as the image (lib/check-data checkCard)', () => {
    expect(readFileSync('src/app/check/[id]/page.tsx', 'utf8')).toMatch(/await checkCard\(params\.id\)/)
    const og = readFileSync('src/app/check/[id]/og/route.tsx', 'utf8')
    expect(og).toMatch(/await checkCard\(params\.id\)/)
    expect(og).toMatch(/export const dynamic = 'force-dynamic'/)
    const page = readFileSync('src/app/check/[id]/page.tsx', 'utf8')
    expect(page).toMatch(/url: `\/check\/\$\{card\.id\}\/og`/)
    expect(page).toMatch(/openGraph: \{ title: card\.name, description, images \}/)
    expect(og).toMatch(/checkImageAge\(card\.dataReadAt, updatedAgoLabel\(card\.dataAgeSeconds\)\)/)
  })
})

describe('the Open Graph image', () => {
  it('the age line printed on it', () => {
    expect(checkImageAge('2026-10-18T18:01:12.000Z', 'Updated 7 min ago')).toBe('Data read 2026-10-18 18:01 UTC · Updated 7 min ago')
  })

  it('renders a 1200×630 PNG for a card, sent no-store (never a year-old picture beside today\'s numbers)', async () => {
    checkCard.mockResolvedValue(DACKIE_CARD)
    const { GET } = await import('@/app/check/[id]/og/route')
    const res = await GET(new Request('http://localhost/check/x/og'), { params: { id: DACKIE } })
    const png = Buffer.from(await res.arrayBuffer())
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
    expect(checkCard).toHaveBeenCalledWith(DACKIE)
  }, 60_000)

  it('a failed read draws no numbers (and still renders)', async () => {
    checkCard.mockResolvedValue('unread')
    const { GET } = await import('@/app/check/[id]/og/route')
    const res = await GET(new Request('http://localhost/check/x/og'), { params: { id: DACKIE } })
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const og = readFileSync('src/app/check/[id]/og/route.tsx', 'utf8')
    expect(og).toMatch(/card === 'not-found' \? CHECK_NOT_FOUND : CHECK_IMAGE_UNREAD/)
  }, 60_000)
})
