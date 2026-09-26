import { describe, it, expect } from 'vitest'
import { isLivePosition, livePositions, liveStakerWallets, countLiveStakers } from '../live-position'
import { isLivePosition as reExported } from '../attestation-reader'

/**
 * Zero-share positions are not backers (thesis §4 rule 5, §8 mine 6). Live
 * 2026-09-26 the /agents card printed "Stakers: 1" for On-Chain Data Analyzer
 * and Agent Avatar Coder while the modal said "Backers: 0": each holds one
 * 0-share row on its atom vault (and one on its counter-vault).
 */

const ATOM = '0xf9508a1016e22fb67a540fefed118b3128dc1c6a56efe8e1f3f409a666f426ec'
const COUNTER = '0x6cd57b2c00000000000000000000000000000000000000000000000000000000'
const W1 = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const W2 = '0x048f2ed104c2B979d8fdFDA692C682cDCCcCE71b'
const row = (term_id: string, account_id: string, shares: string) => ({ term_id, account_id, shares })

describe('isLivePosition — one rule, one module', () => {
  it('attestation-reader re-exports the same function', () => {
    expect(reExported).toBe(isLivePosition)
  })
})

describe('countLiveStakers — the staker count on every agent surface', () => {
  it('On-Chain Data Analyzer (live rows): a 0-share row on the atom + one on the counter → 0 stakers (was 1)', () => {
    const positions = [row(ATOM, W1, '0'), row(COUNTER, W2, '0')]
    expect(countLiveStakers(positions, { atomId: ATOM, counterId: COUNTER })).toBe(0)
  })

  it('OPEN CLAW (live rows): 1 live on the atom + a 0-share row on the counter → 1', () => {
    const positions = [row(ATOM, W1, '335061000000000000'), row(COUNTER, W2, '0')]
    expect(countLiveStakers(positions, { atomId: ATOM, counterId: COUNTER })).toBe(1)
  })

  it('one wallet on both sides, or on two bonding curves, is one staker', () => {
    const positions = [row(ATOM, W1, '5'), row(ATOM, W1.toLowerCase(), '7'), row(COUNTER, W1, '1')]
    expect(countLiveStakers(positions, { atomId: ATOM, counterId: COUNTER })).toBe(1)
  })

  it('an opposer with shares is a staker on the agent (atom vault OR trust counter-vault)', () => {
    expect(countLiveStakers([row(ATOM, W1, '5'), row(COUNTER, W2, '3')], { atomId: ATOM, counterId: COUNTER })).toBe(2)
  })

  it('redeemed then bought back → live again → counts', () => {
    expect(countLiveStakers([row(ATOM, W1, '0'), row(ATOM, W1, '9')], { atomId: ATOM })).toBe(1)
  })

  it('positions on other vaults are not this agent\'s stakers; no counter-vault is fine', () => {
    expect(countLiveStakers([row('0xother', W1, '5'), row(ATOM, W2, '5')], { atomId: ATOM, counterId: null })).toBe(1)
  })

  it('term ids and wallets compare case-insensitively', () => {
    expect(liveStakerWallets([row(ATOM.toUpperCase().replace('0X', '0x'), W1, '1')], [ATOM])).toEqual(new Set([W1.toLowerCase()]))
  })

  it('malformed shares are not live', () => {
    expect(countLiveStakers([row(ATOM, W1, 'not-a-number'), row(ATOM, W2, '')], { atomId: ATOM })).toBe(0)
  })
})

describe('livePositions — rows for position lists', () => {
  it('drops 0-share rows and rows without a wallet, keeps order', () => {
    const rows = [row(ATOM, W1, '3'), row(ATOM, W2, '0'), { term_id: ATOM, account_id: null, shares: '4' }, row(COUNTER, W2, '1')]
    expect(livePositions(rows)).toEqual([row(ATOM, W1, '3'), row(COUNTER, W2, '1')])
  })
})
