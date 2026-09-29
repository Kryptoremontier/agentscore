// Server preload for the dead-indexer shot (tests/e2e/resilience.spec.ts): while the file named by
// DEAD_INDEXER_FLAG exists, every GraphQL request the server makes goes to a dead address
// (127.0.0.1:9 — connection refused), as when the indexer is unreachable. Nothing else changes.
//   DEAD_INDEXER_FLAG=/tmp/indexer-dead NODE_OPTIONS="--require ./tests/e2e/dead-indexer.cjs" npx next start -p 3000
const fs = require('fs')

const FLAG = process.env.DEAD_INDEXER_FLAG
const DEAD = 'http://127.0.0.1:9/v1/graphql'
const realFetch = globalThis.fetch

globalThis.fetch = function fetchWithDeadIndexer(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
  if (FLAG && url && url.includes('/v1/graphql') && fs.existsSync(FLAG)) return realFetch(DEAD, init)
  return realFetch(input, init)
}
