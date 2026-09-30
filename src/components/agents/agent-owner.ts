/**
 * Is the connected wallet this agent's registrant? (Etap 6: the Agent Card's "Profile N% complete"
 * bar is a to-do for its owner, not a verdict shown to visitors.) FeeProxy creates the atom and
 * deposits for the receiver in the same transaction (CLAUDE.md "GraphQL quirks"), so the
 * registrant's position on the atom vault carries the atom's own created_at — checked against the
 * positions the modal already read. Or this browser registered it (lib/registrant-store).
 * Not connected, or not known → not the owner: the bar stays hidden.
 */

export interface OwnerInput {
  wallet: string | null | undefined
  atomId: string
  atomCreatedAt: string | null | undefined
  /** The agent's vault positions as read; null = not read. */
  positions: ReadonlyArray<{ term_id?: string | null; account_id?: string | null; created_at?: string | null }> | null
  /** lib/registrant-store isRegisteredByUser for this wallet and atom. */
  registeredHere: boolean
}

export function isAgentOwner(i: OwnerInput): boolean {
  if (!i.wallet) return false
  if (i.registeredHere) return true
  const born = i.atomCreatedAt ? Date.parse(i.atomCreatedAt) : NaN
  if (!Number.isFinite(born) || !i.positions) return false
  const me = i.wallet.toLowerCase()
  return i.positions.some((p) =>
    p.term_id?.toLowerCase() === i.atomId.toLowerCase()
    && p.account_id?.toLowerCase() === me
    && !!p.created_at && Date.parse(p.created_at) === born)
}
