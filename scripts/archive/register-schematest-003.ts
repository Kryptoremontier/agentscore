/**
 * One-off E2E: register SchemaTest-003 with full metadata, verify Hasura + /card API.
 * Do not commit.
 * Run: node_modules/.bin/vitest run --config scripts/vitest.run.config.ts
 */

import { test } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { intuitionTestnet } from '@0xintuition/protocol'
import { serializeAgentCard, type AgentCardData } from '../src/lib/agent-card'
import { createWriteConfig, registerAgentBatch } from '../src/lib/intuition'
import { effectiveLabel } from '../src/lib/api-data'
import { APP_CONFIG } from '../src/lib/app-config'

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? APP_CONFIG.GRAPHQL_URL
const CARD_API_BASE = process.env.CARD_API_BASE ?? 'http://localhost:3000'

function loadEnvFiles(): void {
  const root = process.cwd()
  for (const name of ['.env.local', '.env.test-wallet.local']) {
    const p = join(root, name)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  }
}

function getPrivateKey(): `0x${string}` {
  const raw =
    process.env.PRIVATE_KEY ??
    process.env.TEST_PRIVATE_KEY ??
    process.env.TEST_WALLET_PRIVATE_KEY
  if (!raw) {
    throw new Error(
      'Missing PRIVATE_KEY, TEST_PRIVATE_KEY, or TEST_WALLET_PRIVATE_KEY in .env.local',
    )
  }
  const key = raw.startsWith('0x') ? raw : `0x${raw}`
  return key as `0x${string}`
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '))
  }
  return json.data as T
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function main(): Promise<void> {
  loadEnvFiles()

  const cardData: AgentCardData = {
    name: 'SchemaTest-003',
    description:
      'Full metadata registration test. Verifies schema.org Thing format, triple creation for endpoints/social, and effectiveLabel() data path.',
    image: '',
    endpoints: {
      website: 'https://agentscore-gilt.vercel.app',
    },
    source: {
      github: 'https://github.com/Kryptoremontier/agentscore',
    },
    social: {
      twitter: 'https://x.com/AgentScoreApp',
    },
  }

  const serialized = serializeAgentCard({
    name: cardData.name,
    description: cardData.description,
    image: cardData.image || undefined,
  })
  console.log('\n=== serializeAgentCard() preview ===')
  console.log(serialized)

  const account = privateKeyToAccount(getPrivateKey())
  const rpcUrl =
    process.env.NEXT_PUBLIC_INTUITION_RPC_URL ??
    'https://testnet.rpc.intuition.systems/http'

  const publicClient = createPublicClient({
    chain: intuitionTestnet,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: intuitionTestnet,
    transport: http(rpcUrl),
  })
  const config = createWriteConfig(walletClient, publicClient)

  console.log('\n=== Registering on-chain (Intuition Testnet) ===')
  console.log('Wallet:', account.address)

  const balance = await publicClient.getBalance({ address: account.address })
  console.log('Balance (wei):', balance.toString())

  const result = await registerAgentBatch(config, cardData, [], undefined, step =>
    console.log('  ', step),
  )

  const onChain = await publicClient.readContract({
    address: config.address,
    abi: (await import('@0xintuition/protocol')).MultiVaultAbi,
    functionName: 'isTermCreated',
    args: [result.termId],
  })
  if (result.transactionHash !== '0x0') {
    const receipt = await publicClient.getTransactionReceipt({
      hash: result.transactionHash,
    })
    console.log('triples receipt status:', receipt.status)
  }
  console.log('isTermCreated(agent):', onChain)

  console.log('\n=== Registration result ===')
  console.log('atom termId:', result.termId)
  console.log('transactionHash (triples tx or 0x0 if none):', result.transactionHash)

  console.log('\nWaiting 20s for indexer…')
  await sleep(20_000)

  type AtomRow = {
    term_id: string
    label: string | null
    data: string | null
  }

  const byId = await gql<{ atoms: AtomRow[] }>(
    `query ($id: String!) {
      atoms(where: { term_id: { _eq: $id } }, limit: 1) {
        term_id label data
      }
    }`,
    { id: result.termId },
  )

  let atom = byId.atoms[0]
  if (!atom) {
    const byLabel = await gql<{ atoms: AtomRow[] }>(
      `query {
        atoms(
          where: {
            _or: [
              { label: { _ilike: "%SchemaTest-003%" } }
              { data: { _ilike: "%SchemaTest-003%" } }
            ]
          }
          order_by: { created_at: desc }
          limit: 5
        ) {
          term_id label data
        }
      }`,
    )
    atom = byLabel.atoms.find(a => a.term_id === result.termId) ?? byLabel.atoms[0]
  }

  type TripleRow = {
    term_id: string
    predicate: { label: string | null; data: string | null } | null
    object: { label: string | null; data: string | null } | null
  }
  let tripleRows: TripleRow[] = []
  try {
    const tripleData = await gql<{ triples: TripleRow[] }>(
      `query ($subject: String!) {
        triples(where: { subject_id: { _eq: $subject } }, limit: 30) {
          term_id
          predicate { label data }
          object { label data }
        }
      }`,
      { subject: result.termId },
    )
    tripleRows = tripleData.triples ?? []
  } catch (e) {
    console.log('Triples query failed:', e)
  }

  console.log('\n=== Hasura atom (raw) ===')
  if (!atom) {
    console.log('NOT FOUND — indexer may need more time')
  } else {
    console.log(JSON.stringify(atom, null, 2))
    console.log('\n=== atom.data (raw string) ===')
    console.log(atom.data ?? '(null)')

    let parsed: Record<string, unknown> | null = null
    if (atom.data) {
      try {
        parsed = JSON.parse(atom.data) as Record<string, unknown>
      } catch {
        console.log('atom.data is not valid JSON')
      }
    }

    console.log('\n=== Checklist (atom.data) ===')
    const checks: [string, boolean][] = []
    if (parsed) {
      const ctx = parsed['@context']
      const typ = parsed['@type']
      checks.push([
        '@context + @type schema.org Thing',
        ctx === 'https://schema.org' && typ === 'Thing',
      ])
      checks.push(['name === SchemaTest-003', parsed.name === 'SchemaTest-003'])
      checks.push([
        'description non-empty',
        typeof parsed.description === 'string' && parsed.description.length > 0,
      ])
      checks.push([
        'url === github (user checklist — serializeAgentCard omits url)',
        parsed.url === 'https://github.com/Kryptoremontier/agentscore',
      ])
    } else {
      checks.push(['parse atom.data', false])
    }
    for (const [label, ok] of checks) {
      console.log(`  [${ok ? 'x' : ' '}] ${label}`)
    }

    const eff = effectiveLabel(atom)
    console.log('\n=== effectiveLabel() ===')
    console.log('returns data path (JSON):', eff.startsWith('{'))
    console.log('preview:', eff.slice(0, 120) + (eff.length > 120 ? '…' : ''))

    const metaTriples = tripleRows.filter(t => {
      const p = t.predicate?.label ?? t.predicate?.data ?? ''
      return /has(Website|Github|Twitter|Api|Mcp)/i.test(p)
    })
    console.log('\n=== Metadata triples (website/github/twitter) ===')
    console.log(
      metaTriples.length
        ? JSON.stringify(metaTriples, null, 2)
        : `(none among ${tripleRows.length} subject triples — indexer lag or schema field mismatch)`,
    )
  }

  const cardUrl = `${CARD_API_BASE}/api/v1/agents/${result.termId}/card`
  console.log('\n=== GET', cardUrl, '===')
  let cardJson: unknown
  try {
    const cardRes = await fetch(cardUrl)
    const text = await cardRes.text()
    console.log('HTTP', cardRes.status)
    try {
      cardJson = JSON.parse(text)
      console.log(JSON.stringify(cardJson, null, 2))
    } catch {
      console.log(text)
    }
    if (cardJson && typeof cardJson === 'object' && 'description' in cardJson) {
      const desc = (cardJson as { description?: string }).description
      console.log('\n  [ ] /card has description:', !!desc && desc.length > 0)
    }
  } catch (err) {
    console.log('Card API failed:', err)
    console.log('Start dev server: npm run dev')
  }

  console.log('\n=== Done ===\n')
}

test(
  'register SchemaTest-003 E2E',
  async () => {
    await main()
  },
  600_000,
)
