/**
 * The browser side of POST /api/v1/refresh (Etap 9d): after a trust or a withdrawal whose receipt is
 * confirmed, ask the server to refill what that agent's change affects. Fire and forget: a refused
 * or failed call changes nothing (the cache refills on its own, every answer shows its age).
 */
export function requestRefresh(agentId: string): void {
  try {
    void fetch('/api/v1/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentId }),
      keepalive: true,
    }).catch(() => undefined)
  } catch { /* no fetch (an old browser): nothing to do */ }
}
