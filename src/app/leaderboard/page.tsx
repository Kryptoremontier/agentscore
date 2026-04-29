import { fetchLeaderboardData } from '@/lib/leaderboard-data'
import { LeaderboardClient } from '@/components/leaderboard/LeaderboardClient'

export const revalidate = 300

export default async function LeaderboardPage() {
  const entries = await fetchLeaderboardData()
  return <LeaderboardClient initialData={entries} />
}
