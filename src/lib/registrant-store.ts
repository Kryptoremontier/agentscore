'use client'

/**
 * Warstwa 1: localStorage mapping registracji atomów/triples.
 *
 * Po przejściu na FeeProxy, creator_id w indekserze = FeeProxy, nie user.
 * Ten moduł zapisuje kto faktycznie rejestrował (receiver w tx FeeProxy).
 *
 * Używany przez:
 * - useUserProfile.ts (profil stats + lista "My Agents")
 * - leaderboard (przez przekazanie jako override do score)
 */

const STORAGE_KEY = 'agentscore_registrations'

export interface RegistrationRecord {
  atomId: string        // termId (lowercase) atoma lub txHash dla triples
  userAddress: string   // adres usera który rejestrował (lowercase)
  type: 'agent' | 'skill' | 'claim'
  timestamp: number
}

function getRegistrations(): RegistrationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveRegistration(
  atomId: string,
  userAddress: string,
  type: 'agent' | 'skill' | 'claim'
): void {
  if (typeof window === 'undefined') return
  try {
    const records = getRegistrations()
    // Deduplikacja po atomId+type
    const exists = records.some(
      r => r.atomId.toLowerCase() === atomId.toLowerCase() && r.type === type
    )
    if (exists) return
    records.push({
      atomId: atomId.toLowerCase(),
      userAddress: userAddress.toLowerCase(),
      type,
      timestamp: Date.now(),
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* ignore */ }
}

export function getUserRegistrations(userAddress: string): RegistrationRecord[] {
  return getRegistrations().filter(
    r => r.userAddress.toLowerCase() === userAddress.toLowerCase()
  )
}

export function getUserRegistrationsByType(
  userAddress: string,
  type: 'agent' | 'skill' | 'claim'
): RegistrationRecord[] {
  return getUserRegistrations(userAddress).filter(r => r.type === type)
}

export function getRegisteredAtomIds(userAddress: string, type: 'agent' | 'skill'): string[] {
  return getUserRegistrationsByType(userAddress, type).map(r => r.atomId)
}

export function isRegisteredByUser(atomId: string, userAddress: string): boolean {
  return getRegistrations().some(
    r =>
      r.atomId.toLowerCase() === atomId.toLowerCase() &&
      r.userAddress.toLowerCase() === userAddress.toLowerCase()
  )
}
