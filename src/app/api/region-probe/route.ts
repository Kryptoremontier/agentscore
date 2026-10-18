// TEMPORARY (Etap 7a region measurement, never merged): times sequential requests from this
// function's region to the Intuition indexer. Deleted with its branch after the measurement.
export const dynamic = 'force-dynamic'

const URL_ = 'https://testnet.intuition.sh/v1/graphql'
const SMALL = JSON.stringify({ query: '{ atoms(limit: 1) { term_id } }' })

async function time(body: string) {
  const t0 = performance.now()
  const res = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body, cache: 'no-store' })
  await res.text()
  return Math.round(performance.now() - t0)
}

export async function GET() {
  const small: number[] = []
  for (let i = 0; i < 15; i++) small.push(await time(SMALL))
  const sorted = [...small.slice(1)].sort((a, b) => a - b)
  return Response.json({
    region: process.env.VERCEL_REGION ?? null,
    firstMs: small[0],
    warmMedianMs: sorted[Math.floor(sorted.length / 2)],
    warmMinMs: sorted[0],
    smallMs: small,
  })
}
