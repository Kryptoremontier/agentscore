import { describe, it, expect } from 'vitest'
import { assertNetworkCoherence } from '../app-config'

/**
 * NEXT_PUBLIC_NETWORK is a display label only — NEXT_PUBLIC_GRAPHQL_URL
 * alone decides what gets queried, and NEXT_PUBLIC_CHAIN_ID picks
 * attestation-gate.ts's gating config. A build where these disagree reads
 * (or gates) the WRONG network while claiming to be on the right one — see
 * the file-header note in app-config.ts for the recon that flagged this.
 */

const TESTNET_URL = 'https://testnet.intuition.sh/v1/graphql'
const MAINNET_URL = 'https://mainnet.intuition.sh/v1/graphql'
const TESTNET_CHAIN_ID = '13579'
const MAINNET_CHAIN_ID = '1155'

describe('assertNetworkCoherence — coherent pairs pass silently', () => {
  it('testnet label + testnet URL + testnet chain id', () => {
    expect(() => assertNetworkCoherence('testnet', TESTNET_URL, TESTNET_CHAIN_ID)).not.toThrow()
  })

  it('mainnet label + mainnet URL + mainnet chain id', () => {
    expect(() => assertNetworkCoherence('mainnet', MAINNET_URL, MAINNET_CHAIN_ID)).not.toThrow()
  })

  it('an unrecognized GRAPHQL_URL (local proxy, third network) is not itself an error', () => {
    expect(() => assertNetworkCoherence('testnet', 'http://localhost:8080/graphql', TESTNET_CHAIN_ID)).not.toThrow()
  })

  it('an unset/unrecognized CHAIN_ID is not itself an error', () => {
    expect(() => assertNetworkCoherence('testnet', TESTNET_URL, undefined)).not.toThrow()
    expect(() => assertNetworkCoherence('testnet', TESTNET_URL, '999999')).not.toThrow()
  })
})

describe('assertNetworkCoherence — mismatch throws at boot', () => {
  it('NEXT_PUBLIC_NETWORK="testnet" but NEXT_PUBLIC_GRAPHQL_URL points at mainnet', () => {
    expect(() => assertNetworkCoherence('testnet', MAINNET_URL, TESTNET_CHAIN_ID)).toThrow(/Network mismatch/)
  })

  it('NEXT_PUBLIC_NETWORK="mainnet" but NEXT_PUBLIC_GRAPHQL_URL points at testnet', () => {
    expect(() => assertNetworkCoherence('mainnet', TESTNET_URL, MAINNET_CHAIN_ID)).toThrow(/Network mismatch/)
  })

  it('NEXT_PUBLIC_NETWORK="testnet" but NEXT_PUBLIC_CHAIN_ID is the mainnet chain id', () => {
    expect(() => assertNetworkCoherence('testnet', TESTNET_URL, MAINNET_CHAIN_ID)).toThrow(/Network mismatch/)
  })

  it('the thrown message names both disagreeing values, not a generic error', () => {
    expect(() => assertNetworkCoherence('testnet', MAINNET_URL, TESTNET_CHAIN_ID)).toThrow(
      /NEXT_PUBLIC_NETWORK="testnet"/,
    )
  })
})
