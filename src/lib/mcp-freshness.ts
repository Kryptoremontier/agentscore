/**
 * MCP tool answers say how old their data is — the same rule as REST `meta.dataAgeSeconds`
 * (lib/server-cache.ts, lib/api-helpers.ts). Each tool call runs in its own read ledger; a
 * JSON-object answer gains `meta: { dataAgeSeconds, dataReadAt }` (0 / now when read live).
 * Plain-text answers ("Agent not found", errors) are left as they are.
 */

import { currentFreshness, runWithReadLedger } from './server-cache'

interface ToolContent {
  type: string
  text?: string
  [key: string]: unknown
}

export function addFreshnessMeta<C extends ToolContent>(content: C, meta: { dataAgeSeconds: number; dataReadAt: string }): C {
  if (content.type !== 'text' || typeof content.text !== 'string') return content
  let parsed: unknown
  try {
    parsed = JSON.parse(content.text)
  } catch {
    return content
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return content
  const obj = parsed as Record<string, unknown>
  const prior = obj.meta && typeof obj.meta === 'object' ? (obj.meta as Record<string, unknown>) : {}
  return { ...content, text: JSON.stringify({ ...obj, meta: { ...prior, ...meta } }, null, 2) }
}

/** Wrap one tool callback: one ledger per call, freshness added to its JSON answer. */
export function withToolFreshness<A extends unknown[], R extends { content: ToolContent[] }>(
  cb: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args: A) =>
    runWithReadLedger(async () => {
      const result = await cb(...args)
      const { dataAgeSeconds, dataReadAt } = currentFreshness()
      return { ...result, content: result.content.map((c) => addFreshnessMeta(c, { dataAgeSeconds, dataReadAt })) }
    })
}

/**
 * Every tool registered on `server` is wrapped (one place, so a new tool can't miss it).
 * Mutates and returns `server`.
 */
export function withFreshnessOnEveryTool<S extends { registerTool: (...args: never[]) => unknown }>(server: S): S {
  const register = server.registerTool.bind(server) as (...args: unknown[]) => unknown
  ;(server as { registerTool: unknown }).registerTool = (name: unknown, config: unknown, cb: unknown) =>
    register(name, config, withToolFreshness(cb as (...args: unknown[]) => Promise<{ content: ToolContent[] }>))
  return server
}
