'use client'

/**
 * A person, by name: their ENS name if one resolves, else the short hex (lib/person-names.ts).
 * Renders the hex at once and the name when it arrives — never waits on ENS. `label`: an indexer
 * account label the surface already read (the backers' positions carry one); an ENS label is
 * used as is, without a request.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { isEnsName, personName } from '@/lib/person-names'
import { requestPersonName, knownPersonName, subscribePersonNames, personNamesVersion } from '@/lib/person-names-client'

export function PersonName({ wallet, label, className }: { wallet: string; label?: string | null; className?: string }) {
  useSyncExternalStore(subscribePersonNames, personNamesVersion, () => 0)
  const known = isEnsName(label)
  useEffect(() => {
    if (!known) requestPersonName(wallet)
  }, [wallet, known])
  const name = known ? label : knownPersonName(wallet)
  return <span className={className} title={wallet} data-testid="person-name">{personName(wallet, name)}</span>
}
