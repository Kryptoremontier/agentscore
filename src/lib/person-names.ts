/**
 * How a person is named on every surface (Etap 5b): their ENS name when one resolves, else the
 * short hex. The resolver is the indexer's account label — ENS-resolved by Intuition (e.g.
 * "ludarep.eth"), otherwise a short hex it prints itself ("0x2c55...c3B8") — the one the Backers
 * list already used. Shared by the server helper (lib/person-names-server.ts) and the client
 * component (components/shared/PersonName.tsx).
 */

import { truncateWallet } from './attestation-reader'

/** An ENS name (ends in .eth), not the indexer's short-hex fallback label. */
export function isEnsName(label: string | null | undefined): label is string {
  return !!label && /^[^\s]+\.eth$/i.test(label.trim())
}

/** "ludarep.eth", or "0x1392...0006" when no ENS name resolved (or none is known yet). */
export function personName(wallet: string, name?: string | null): string {
  return isEnsName(name) ? name.trim() : truncateWallet(wallet)
}

/** At most this many wallets per names request (one Hasura `_in` read). */
export const NAMES_BATCH = 100
