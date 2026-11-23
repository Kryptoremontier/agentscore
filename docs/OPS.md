# Operations

What keeps AgentScore's numbers fresh, and what the owner sets up outside the repository.

## How fresh the API is

Every answer from `/api/v1` carries `meta.dataAgeSeconds` (seconds since the oldest indexer read
behind it) and `meta.dataReadAt` (that read's time). Reads are cached (`lib/server-cache.ts`):

- An entry younger than its TTL (60–300 s) is served as is.
- An entry past its TTL but under its ceiling (24 h for the list and `/stats` parts) is served at
  once, with its real age, and refilled in the background. The refill is kept alive after the
  response by Vercel's `waitUntil` (Etap 9d), so it finishes and the **next** request is fresh.
- No entry, or one past its ceiling: the request waits for a live read.

So an entry is only as fresh as the last request that reached it. With no traffic for 8 hours, the
first request after that answers with data 8 hours old (and says so), and starts the refill. That is
what the owner saw on 2026-11-23 at 20:20 UTC: `dataAgeSeconds: 28881`, read at 12:19, the time of
the previous request.

Three things send requests when no visitor does:

1. **Our own writes** (Etap 9d). After a trust or a withdrawal made in AgentScore, once the receipt
   is confirmed, the browser calls `POST /api/v1/refresh` with the agent id. That refills the
   agent's reads, the tier counts, the attesters count and `/stats` right away (see below).
2. **The warm-cache workflow** (`.github/workflows/warm-cache.yml`), scheduled every 5 minutes.
   GitHub runs scheduled workflows on a best-effort basis: on this repository it ran every **4 to
   9 hours** in November 2026 (runs #155–#165), not every 5 minutes. Treat it as a backstop only.
3. **An outside pinger**, which the owner sets up once (next section). Trusts made outside AgentScore,
   for example in the Intuition portal, never call `/api/v1/refresh`; the pinger is what brings
   them into `/stats` within minutes.

## The outside pinger (set up once, by the owner)

A free uptime service calls two read-only URLs every 10 minutes. No secret, no account on our side,
nothing to deploy. Either service works:

**cron-job.org** (free): create an account, then *Create cronjob* twice:

| Title | URL | Schedule | Method |
|---|---|---|---|
| AgentScore stats | `https://agentscore-gilt.vercel.app/api/v1/stats` | Every 10 minutes | GET |
| AgentScore agents | `https://agentscore-gilt.vercel.app/api/v1/agents/page` | Every 10 minutes | GET |

Leave authentication, headers and body empty. Under *Advanced*, a 30 s timeout is enough; turn on
"notify on failure" if you want an email when the site is down.

**UptimeRobot** (free plan, 5-minute minimum interval): *Add New Monitor* → type *HTTP(s)*, the same
two URLs, *Monitoring Interval* 10 minutes. Same settings: no auth, no headers.

How to check it works: open `https://agentscore-gilt.vercel.app/api/v1/stats` a few times over an
hour. `meta.dataAgeSeconds` should stay under about 900 (10 minutes between pings, plus the 300 s TTL
of the slowest part), instead of growing for hours.

Don't point the pinger at `POST /api/v1/refresh`: it is rate-limited and meant for one agent after a
write. The two GET URLs above are enough.

## `POST /api/v1/refresh`

- Body `{ "agentId": "0x…" }` (a term id; or `?agentId=`). Nothing else is read from the request.
- Answers **202** and starts, after the response, a forced refill of: that agent's vault,
  attestations, trust events and timeline; the AgentScore corpus and the ERC-8004 cohort's
  attestations (the tier counts); the `/stats` counts (attesters) and the 7-day trust events.
- Each refill stores a fresh read only if it is complete. A failed or incomplete read keeps the old
  entry. A key is refreshed at most **once per minute** per server instance.
- **429** (with `Retry-After`) over **6 requests per minute per IP**. **400** for anything that
  isn't a term id. Both limits are in memory, so they apply per server instance.

## Indexer budget

The indexer allows 75 requests per minute per client, and every server-side read shares Vercel's
egress (`docs/audit/rate-limit.md`). The cache keeps the server at about **20 reads/min, flat**
(Etap 4b-cache, `docs/audit/rate-limit.md` "Server steady state"), because entries refill at most
once per TTL whoever asks. The budget stays **≤ 20 req/min steady**:

- **The pinger adds nothing above that.** It refills the same entries, at most once per entry per
  10 minutes. That is slower than every TTL (60–300 s), and a refill already in flight is shared.
  With no other traffic, the pinger alone costs a fraction of the steady state.
- **`/api/v1/refresh`** forces refills, so it is bounded separately: at most one forced refill per
  shared key (corpus, cohort attestations, counts, 7-day events) per minute per instance, plus one
  per agent key, and 6 calls per minute per IP. A refresh of a shared key replaces the TTL refill it
  would have had that minute.
- **The warm-cache workflow**: at most one refill cycle per run, a few runs a day in practice.

If the indexer starts answering 429 (it shows up as `parts.<part>: 'failed'` in `/stats`), lengthen
the pinger to 15 minutes first.
