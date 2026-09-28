import { fetchLeaderboardData } from '@/lib/leaderboard-data'
import { currentFreshness, runWithReadLedger } from '@/lib/server-cache'
import { LeaderboardClient } from '@/components/leaderboard/LeaderboardClient'

// Dynamic, over the shared contributor-leaderboard cache (lib/server-cache.ts: complete reads only,
// 300 s). Page-level ISR (`revalidate = 300`) served a page with no age, and made `next build`
// depend on the indexer answering at build time.
export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const { entries, dataAgeSeconds } = await runWithReadLedger(async () => {
    // A failed read is its own state — never "no activity" (REPO_MAP §7 rule 5).
    const entries = await fetchLeaderboardData().catch((err) => {
      console.error('[leaderboard] contributor read failed:', err)
      return null
    })
    return { entries, dataAgeSeconds: currentFreshness().dataAgeSeconds }
  })
  return <LeaderboardClient initialData={entries} dataAgeSeconds={entries ? dataAgeSeconds : null} />
}
